/**
 * @file Contexto de autenticacion para collectors-forge-studio.
 *
 * Provee un contexto React que gestiona el estado de autenticacion
 * del usuario en toda la aplicacion. Maneja:
 * - Persistencia del token JWT en localStorage
 * - Verificacion automatica de la sesion al cargar la aplicacion
 * - Funciones para iniciar y cerrar sesion
 *
 * @module context/AuthContext
 */

import { createContext, useContext, useState, useEffect } from 'react';
import { getMe } from '../services/api';

/**
 * Contexto de React para el estado de autenticacion.
 * Valor inicial null; se provee a traves de AuthProvider.
 * @type {React.Context<AuthContextValue|null>}
 */
const AuthContext = createContext(null);

/**
 * @typedef {Object} AuthContextValue
 * @property {Object|null} user - Datos del usuario autenticado, o null si no hay sesion
 * @property {boolean} loading - Indica si se esta verificando la sesion (true durante la carga inicial)
 * @property {Function} loginUser - Funcion para iniciar sesion del usuario
 * @property {Function} logout - Funcion para cerrar sesion del usuario
 */

/**
 * Proveedor del contexto de autenticacion.
 * Envuelve la aplicacion para dar acceso al estado de autenticacion
 * a todos los componentes hijos.
 *
 * Al montarse, verifica si existe un token JWT en localStorage.
 * Si existe, valida el token contra el backend (GET /auth/me).
 * Si el token es invalido o ha expirado, lo elimina automaticamente.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Componentes hijos que tendran acceso al contexto
 * @returns {JSX.Element} Proveedor del contexto de autenticacion
 */
export function AuthProvider({ children }) {
  /** @type {[Object|null, Function]} Estado del usuario autenticado */
  const [user, setUser] = useState(null);
  /** @type {[boolean, Function]} Estado de carga mientras se verifica la sesion */
  const [loading, setLoading] = useState(true);

  // Al montar el componente, verifica si hay una sesion activa
  // consultando el endpoint /auth/me con el token almacenado
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      getMe()
        .then((res) => setUser(res.data))
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  /**
   * Almacena el token JWT y establece los datos del usuario en el estado.
   * Se llama despues de un inicio de sesion exitoso.
   *
   * @param {string} token - Token JWT recibido del backend
   * @param {Object} userData - Datos del usuario autenticado
   */
  const loginUser = (token, userData) => {
    localStorage.setItem('token', token);
    setUser(userData);
  };

  /**
   * Cierra la sesion del usuario.
   * Llama al endpoint OIDC para obtener la URL de logout del IdP y redirige.
   * Si falla, simplemente limpia el estado local.
   */
  const logout = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const res = await fetch('/api/auth/oidc/logout', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        localStorage.removeItem('token');
        setUser(null);
        window.location.href = data.logout_url || '/login';
        return;
      }
    } catch {
      // Fallthrough: limpiar estado local aunque el endpoint falle
    }
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook personalizado para acceder al contexto de autenticacion.
 * Debe usarse dentro de un componente hijo de AuthProvider.
 *
 * @returns {AuthContextValue} Objeto con user, loading, loginUser y logout
 *
 * @example
 * const { user, logout } = useAuth();
 * if (user) {
 *   console.log('Usuario autenticado:', user.username);
 * }
 */
export const useAuth = () => useContext(AuthContext);
