/**
 * @file Pagina de inicio de sesion de Collector's Forge Studio.
 *
 * Si no hay error previo, redirige automáticamente al flujo OIDC (comportamiento
 * tipo Okta: si el IdP ya tiene sesión activa, el login es transparente).
 * Si hay ?error= en la URL (callback fallido), muestra el error y un botón para reintentar.
 *
 * @module pages/Login
 */

import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LogIn, Loader2 } from 'lucide-react';

const MENSAJES_ERROR = {
  oidc_callback_failed: 'Error al completar el inicio de sesión. Intenta de nuevo.',
  missing_sub:          'El proveedor de identidad no devolvió un identificador de usuario.',
  provisioning_failed:  'Error al crear tu cuenta. Contacta al administrador.',
  user_inactive:        'Tu cuenta está desactivada. Contacta al administrador.',
};

/**
 * Componente de la pagina de inicio de sesion via SSO.
 *
 * Sin error previo: redirige automáticamente a /api/auth/oidc/login.
 * Con error previo: muestra mensaje y botón para reintentar.
 *
 * @returns {JSX.Element} Pantalla de carga (auto-redirect) o pantalla de error con botón
 */
export default function Login() {
  const [searchParams] = useSearchParams();
  const error = searchParams.get('error');

  useEffect(() => {
    if (error) {
      toast.error(MENSAJES_ERROR[error] || 'Error de autenticación');
    } else {
      // Sin error previo: redirigir automáticamente al IdP.
      // Si Authentik ya tiene sesión activa, el login es transparente.
      window.location.href = '/api/auth/oidc/login';
    }
  }, [error]);

  // Sin error: mostrar spinner mientras se redirige
  if (!error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-forge-black">
        <div className="flex flex-col items-center gap-4 text-gunmetal">
          <Loader2 size={40} className="animate-spin text-teal-400" />
          <span className="text-sm">Redirigiendo al proveedor de identidad...</span>
        </div>
      </div>
    );
  }

  // Con error: mostrar mensaje y botón para reintentar manualmente
  return (
    <div className="min-h-screen flex items-center justify-center bg-forge-black">
      <div className="tf-card rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Collector's Forge" className="h-20 w-20 object-contain mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-tech-white tracking-tight">Collector's Forge Studio</h1>
          <p className="text-gunmetal mt-2 text-sm">Inicio de sesión</p>
        </div>
        <button
          onClick={() => { window.location.href = '/api/auth/oidc/login'; }}
          className="tf-btn-primary w-full py-3 text-base gap-2 flex items-center justify-center"
        >
          <LogIn size={18} />
          Reintentar inicio de sesión
        </button>
      </div>
    </div>
  );
}
