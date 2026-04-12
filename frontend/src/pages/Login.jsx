/**
 * @file Pagina de inicio de sesion de Collector's Forge Studio.
 *
 * Presenta un botón de SSO que inicia el flujo OIDC con PKCE.
 * El backend maneja todo el intercambio de tokens; el frontend solo redirige.
 *
 * @module pages/Login
 */

import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LogIn } from 'lucide-react';

/**
 * Componente de la pagina de inicio de sesion via SSO.
 *
 * @returns {JSX.Element} Pantalla de login con botón SSO
 */
export default function Login() {
  const [searchParams] = useSearchParams();

  // Mostrar error si el callback OIDC redirigió con ?error=
  useEffect(() => {
    const error = searchParams.get('error');
    if (error) {
      const mensajes = {
        oidc_callback_failed: 'Error al completar el inicio de sesión. Intenta de nuevo.',
        missing_sub:          'El proveedor de identidad no devolvió un identificador de usuario.',
        provisioning_failed:  'Error al crear tu cuenta. Contacta al administrador.',
        user_inactive:        'Tu cuenta está desactivada. Contacta al administrador.',
      };
      toast.error(mensajes[error] || 'Error de autenticación');
    }
  }, [searchParams]);

  /**
   * Inicia el flujo OIDC redirigiendo al backend.
   * El backend generará state/nonce/PKCE y redirigirá al proveedor de identidad.
   */
  const handleSSOLogin = () => {
    window.location.href = '/api/auth/oidc/login';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-forge-black">
      <div className="tf-card rounded-2xl p-8 w-full max-w-md shadow-2xl">
        {/* Encabezado con logo, nombre y descripcion */}
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Collector's Forge" className="h-20 w-20 object-contain mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-tech-white tracking-tight">Collector's Forge Studio</h1>
          <p className="text-gunmetal mt-2 text-sm">Inicio de sesión</p>
        </div>
        {/* Botón SSO */}
        <button
          onClick={handleSSOLogin}
          className="tf-btn-primary w-full py-3 text-base gap-2 flex items-center justify-center"
        >
          <LogIn size={18} />
          Iniciar sesión con SSO
        </button>
      </div>
    </div>
  );
}
