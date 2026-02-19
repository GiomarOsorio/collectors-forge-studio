/**
 * @file Pagina de inicio de sesion de Calculator3D.
 *
 * Presenta un formulario de autenticacion con campos de usuario y contrasena.
 * Al enviar el formulario, se autentica contra el backend (JWT),
 * obtiene los datos del usuario y actualiza el contexto de autenticacion.
 * En caso de exito, redirige a la pagina principal de la calculadora.
 *
 * @module pages/Login
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login, getMe } from '../services/api';
import toast from 'react-hot-toast';

/**
 * Componente de la pagina de inicio de sesion.
 *
 * @description Renderiza un formulario centrado en pantalla con los campos
 * de usuario y contrasena. Gestiona el flujo completo de autenticacion:
 * 1. Envia las credenciales al endpoint de login
 * 2. Almacena el token JWT recibido
 * 3. Obtiene los datos del usuario autenticado
 * 4. Actualiza el contexto de autenticacion global
 * 5. Redirige a la pagina principal
 *
 * Muestra notificaciones de error si las credenciales son incorrectas.
 *
 * @returns {JSX.Element} Formulario de inicio de sesion
 */
export default function Login() {
  /** @type {[string, Function]} Nombre de usuario ingresado */
  const [username, setUsername] = useState('');
  /** @type {[string, Function]} Contrasena ingresada */
  const [password, setPassword] = useState('');
  /** @type {[boolean, Function]} Estado de carga durante el proceso de autenticacion */
  const [loading, setLoading] = useState(false);
  const { loginUser } = useAuth();
  const navigate = useNavigate();

  /**
   * Maneja el envio del formulario de login.
   * Realiza la autenticacion en dos pasos: primero obtiene el token JWT
   * y luego consulta los datos del usuario autenticado.
   *
   * @param {React.FormEvent<HTMLFormElement>} e - Evento del formulario
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Paso 1: Autenticar y obtener el token JWT
      const res = await login(username, password);
      localStorage.setItem('token', res.data.access_token);
      // Paso 2: Obtener los datos del usuario con el token recien obtenido
      const userRes = await getMe();
      // Paso 3: Actualizar el contexto global de autenticacion
      loginUser(res.data.access_token, userRes.data);
      navigate('/');
    } catch {
      toast.error('Usuario o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-forge-black">
      <div className="tf-card rounded-2xl p-8 w-full max-w-md shadow-2xl">
        {/* Encabezado con el nombre y descripcion de la aplicacion */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-tech-white tracking-tight">TurtleForge Cost</h1>
          <p className="text-gunmetal mt-2 text-sm">TurtleForge Studio</p>
        </div>
        {/* Formulario de autenticacion */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="tf-label">Usuario</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
              className="tf-input py-3" required />
          </div>
          <div>
            <label className="tf-label">Contraseña</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="tf-input py-3" required />
          </div>
          <button type="submit" disabled={loading}
            className="tf-btn-primary w-full py-3 text-base">
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
