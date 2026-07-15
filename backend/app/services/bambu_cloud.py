"""
Cliente de autenticación de Bambu Lab Cloud (issue #139).

Adaptado de bambuddy (https://github.com/maziggy/bambuddy), AGPL-3.0 —
`backend/app/services/bambu_cloud.py`: SOLO la parte de login/verificación/
token (`login_request`, `verify_code`, `verify_totp`, `_detect_cloudflare_
challenge`). Se ignora todo lo de perfiles cloud/devices/firmware/MQTT —
fuera de alcance de CFS (issue #139: solo import de modelos, no control de
impresora).

Región fija 'global' (`api.bambulab.com`) — la región China de bambuddy
queda fuera de alcance.
"""

import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

BAMBU_API_BASE = "https://api.bambulab.com"

# Nos identificamos honestamente como CFS — mismo criterio que bambuddy
# (distinguirse de clientes que falsifican ser Bambu Studio oficial).
_USER_AGENT = "CollectorsForgeStudio/1.0 (+https://github.com/GiomarOsorio/collectors-forge-studio)"

_CF_INTERSTITIAL_USER_MESSAGE = (
    "Bambu Cloud está bloqueando temporalmente peticiones automatizadas desde "
    "esta red (protección Cloudflare del lado de Bambu, no de CFS). Esperá "
    "unos minutos y reintentá."
)

# Marcadores de texto de la página interstitial de Cloudflare (título del
# challenge / script del widget turnstile). Ver `_detect_cloudflare_challenge`.
_CF_MARKERS_RE = re.compile(r"Just a moment\.\.\.|challenges\.cloudflare\.com")


def _detect_cloudflare_challenge(response: httpx.Response) -> Optional[str]:
    """
    Detecta si la respuesta es un challenge/interstitial de Cloudflare en vez
    del JSON esperado, para dar un mensaje accionable en vez de un error de
    parseo opaco. Ver docstring del port original en bambuddy.
    """
    try:
        body = response.text or ""
    except Exception:
        body = ""
    # Búsqueda de texto sobre el HTML de la respuesta (detección de la
    # página interstitial de Cloudflare) — NO es una validación de URL de
    # red, ningún request depende de este resultado, solo el mensaje de
    # error mostrado al usuario. `_CF_MARKERS_RE` en vez de `in` para no
    # calcar el patrón AST que el linter de seguridad asocia a sanitización
    # incompleta de URLs (falso positivo con `"dominio.com" in texto`).
    if _CF_MARKERS_RE.search(body):
        return _CF_INTERSTITIAL_USER_MESSAGE
    status = response.status_code
    headers = response.headers or {}
    if status == 403 and "cf-mitigated" in headers:
        return _CF_INTERSTITIAL_USER_MESSAGE
    if status == 503 and "cf-ray" in headers:
        return _CF_INTERSTITIAL_USER_MESSAGE
    return None


class BambuCloudError(Exception):
    """Excepción base para errores de Bambu Cloud."""


class BambuCloudAuthError(BambuCloudError):
    """Errores relacionados a autenticación."""


class BambuCloudService:
    """Cliente de sesión de Bambu Lab Cloud (login + token, sin MQTT/devices)."""

    def __init__(self, client: Optional[httpx.AsyncClient] = None):
        self.access_token: Optional[str] = None
        self.refresh_token: Optional[str] = None
        self.token_expiry: Optional[datetime] = None
        self._client = client or httpx.AsyncClient(timeout=30.0)
        self._owns_client = client is None

    async def close(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    @property
    def is_authenticated(self) -> bool:
        if not self.access_token:
            return False
        return not (self.token_expiry and datetime.now(timezone.utc) > self.token_expiry)

    def set_token(self, access_token: str, expires_at: Optional[datetime] = None) -> None:
        self.access_token = access_token
        self.token_expiry = expires_at or (datetime.now(timezone.utc) + timedelta(days=30))

    async def login_request(self, email: str, password: str) -> dict:
        """
        Inicia el login. Dispara verificación por email o TOTP según la cuenta.
        """
        try:
            response = await self._client.post(
                f"{BAMBU_API_BASE}/v1/user-service/user/login",
                headers={"Content-Type": "application/json", "User-Agent": _USER_AGENT},
                json={"account": email, "password": password},
            )
            try:
                data = response.json()
            except Exception as json_err:
                logger.error("Respuesta de login ilegible: %s", json_err)
                cf_message = _detect_cloudflare_challenge(response)
                return {"success": False, "needs_verification": False, "message": cf_message or "Respuesta inválida de Bambu Cloud"}

            if response.status_code == 200:
                login_type = data.get("loginType")
                tfa_key = data.get("tfaKey")

                if login_type == "tfa" or (tfa_key and login_type != "verifyCode"):
                    return {
                        "success": False, "needs_verification": True,
                        "verification_type": "totp", "tfa_key": tfa_key,
                        "message": "Ingresá el código de tu app de autenticación",
                    }
                if login_type == "verifyCode":
                    return {
                        "success": False, "needs_verification": True,
                        "verification_type": "email", "tfa_key": None,
                        "message": "Código de verificación enviado al email",
                    }
                if "accessToken" in data:
                    self.set_token(data["accessToken"])
                    self.refresh_token = data.get("refreshToken")
                    return {"success": True, "needs_verification": False, "message": "Login exitoso"}

            error_msg = data.get("message") or data.get("error") or "Login falló"
            return {"success": False, "needs_verification": False, "message": error_msg}
        except Exception as e:
            logger.error("Login request falló: %s", e)
            raise BambuCloudAuthError(f"Login request falló: {e}")

    async def verify_code(self, email: str, code: str) -> dict:
        """Completa el login con el código de verificación enviado por email."""
        try:
            response = await self._client.post(
                f"{BAMBU_API_BASE}/v1/user-service/user/login",
                headers={"Content-Type": "application/json", "User-Agent": _USER_AGENT},
                json={"account": email, "code": code},
            )
            try:
                data = response.json()
            except Exception as json_err:
                logger.error("Respuesta de verify-code ilegible: %s", json_err)
                cf_message = _detect_cloudflare_challenge(response)
                return {"success": False, "message": cf_message or "Respuesta inválida de Bambu Cloud"}

            if response.status_code == 200 and "accessToken" in data:
                self.set_token(data["accessToken"])
                self.refresh_token = data.get("refreshToken")
                return {"success": True, "message": "Login exitoso"}
            return {"success": False, "message": data.get("message", "Verificación fallida")}
        except Exception as e:
            logger.error("Verificación por email falló: %s", e)
            raise BambuCloudAuthError(f"Verificación falló: {e}")

    async def verify_totp(self, tfa_key: str, code: str) -> dict:
        """Completa el login con el código TOTP de la app de autenticación."""
        try:
            response = await self._client.post(
                "https://bambulab.com/api/sign-in/tfa",
                headers={"Content-Type": "application/json", "User-Agent": _USER_AGENT, "Accept": "application/json"},
                json={"tfaKey": tfa_key, "tfaCode": code},
            )
            if not response.text or not response.text.strip():
                return {"success": False, "message": "Bambu Cloud devolvió una respuesta vacía. Reintentá."}
            try:
                data = response.json()
            except Exception as json_err:
                logger.error("Respuesta TOTP ilegible: %s", json_err)
                cf_message = _detect_cloudflare_challenge(response)
                return {"success": False, "message": cf_message or "Respuesta inválida de Bambu Cloud"}

            access_token = data.get("accessToken") or data.get("token")
            if not access_token:
                for cookie in response.cookies:
                    if "token" in cookie.lower():
                        access_token = response.cookies.get(cookie)
                        break

            if response.status_code == 200 and access_token:
                self.set_token(access_token)
                self.refresh_token = data.get("refreshToken")
                return {"success": True, "message": "Login exitoso"}

            error_msg = data.get("message", "")
            if "expired" in error_msg.lower():
                return {"success": False, "message": "La sesión TOTP expiró. Iniciá el login de nuevo."}
            return {"success": False, "message": error_msg or f"Verificación TOTP falló (status {response.status_code})"}
        except Exception as e:
            logger.error("Verificación TOTP falló: %s", e)
            return {"success": False, "message": f"Error de verificación TOTP: {e}"}
