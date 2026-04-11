/**
 * @file Pagina de éxito de autenticación OIDC.
 *
 * El backend redirige aquí tras el callback OIDC exitoso, pasando el JWT local
 * como query param ?token=. Esta página guarda el token y carga los datos del
 * usuario antes de navegar a la pantalla principal.
 *
 * @module pages/AuthSuccess
 */

import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMe } from '../services/api';
import { Loader2 } from 'lucide-react';

/**
 * Componente intermediario que completa el login OIDC en el cliente.
 *
 * @returns {JSX.Element} Pantalla de carga mientras se procesa el token
 */
export default function AuthSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginUser } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (error) {
      navigate(`/login?error=${error}`, { replace: true });
      return;
    }

    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    // Guardar token y cargar datos del usuario
    localStorage.setItem('token', token);
    getMe()
      .then((res) => {
        loginUser(token, res.data);
        navigate('/', { replace: true });
      })
      .catch(() => {
        localStorage.removeItem('token');
        navigate('/login?error=oidc_callback_failed', { replace: true });
      });
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex items-center justify-center bg-forge-black">
      <div className="flex flex-col items-center gap-4 text-gunmetal">
        <Loader2 size={40} className="animate-spin text-teal-400" />
        <span className="text-sm">Iniciando sesión...</span>
      </div>
    </div>
  );
}
