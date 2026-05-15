/**
 * @file Pagina de inicio de sesion de Collector's Forge Studio.
 *
 * Sin error previo: redirige automáticamente al flujo OIDC (comportamiento
 * tipo Okta: si el IdP ya tiene sesión activa, el login es transparente).
 * Si hay ?error= en la URL (callback fallido), muestra el error y un botón para reintentar.
 *
 * En modo dev (`import.meta.env.DEV`) se omite el auto-redirect y se muestra
 * un botón extra "Bypass dev" que inyecta un usuario admin falso sin pasar por
 * Authentik. Útil para probar UI cuando el backend no está corriendo localmente.
 *
 * @module pages/Login
 */

import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LogIn, FlaskConical, Loader2 } from 'lucide-react';
import { DEV_BYPASS_TOKEN, DEV_BYPASS_USER, useAuth } from '../context/AuthContext';

const MENSAJES_ERROR = {
  oidc_callback_failed: 'Error al completar el inicio de sesión. Intenta de nuevo.',
  missing_sub:          'El proveedor de identidad no devolvió un identificador de usuario.',
  provisioning_failed:  'Error al crear tu cuenta. Contacta al administrador.',
  user_inactive:        'Tu cuenta está desactivada. Contacta al administrador.',
};

const IS_DEV = import.meta.env.DEV;

/**
 * Componente de la pagina de inicio de sesion via SSO.
 *
 * Producción: redirige automáticamente a /api/auth/oidc/login.
 * Con error previo o en dev: muestra mensaje/UI con botones manuales.
 *
 * @returns {JSX.Element}
 */
export default function Login() {
  const [searchParams] = useSearchParams();
  const error = searchParams.get('error');
  const navigate = useNavigate();
  const { loginUser } = useAuth();

  useEffect(() => {
    if (error) {
      toast.error(MENSAJES_ERROR[error] || 'Error de autenticación');
      return;
    }
    if (IS_DEV) return; // en dev no auto-redirigir: dejamos elegir bypass
    window.location.href = '/api/auth/oidc/login';
  }, [error]);

  const handleDevBypass = () => {
    loginUser(DEV_BYPASS_TOKEN, DEV_BYPASS_USER);
    navigate('/');
  };

  // Producción sin error: spinner mientras se redirige.
  if (!error && !IS_DEV) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-forge-black">
        <div className="flex flex-col items-center gap-4 text-gunmetal">
          <Loader2 size={40} className="animate-spin text-teal-400" />
          <span className="text-sm">Redirigiendo al proveedor de identidad...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-forge-black">
      <div className="tf-card rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Collector's Forge" className="h-20 w-20 object-contain mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-tech-white tracking-tight">Collector's Forge Studio</h1>
          <p className="text-gunmetal mt-2 text-sm">Inicio de sesión</p>
        </div>
        <div className="space-y-3">
          <button
            onClick={() => { window.location.href = '/api/auth/oidc/login'; }}
            className="tf-btn-primary w-full py-3 text-base gap-2 flex items-center justify-center"
          >
            <LogIn size={18} />
            {error ? 'Reintentar inicio de sesión' : 'Iniciar sesión con SSO'}
          </button>
          {IS_DEV && (
            <button
              onClick={handleDevBypass}
              className="w-full py-3 text-base gap-2 flex items-center justify-center rounded-lg border border-amber-400/40 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20 transition-colors"
              title="Inyecta un usuario admin falso sin tocar el backend (sólo dev)"
            >
              <FlaskConical size={18} />
              Bypass dev (admin local)
            </button>
          )}
        </div>
        {IS_DEV && (
          <p className="text-xs text-gunmetal mt-6 text-center">
            Modo dev: el bypass usa un usuario falso. Las llamadas al backend fallarán silenciosamente
            si <code className="text-steel">localhost:8000</code> no está corriendo.
          </p>
        )}
      </div>
    </div>
  );
}
