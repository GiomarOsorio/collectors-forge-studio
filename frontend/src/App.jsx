/**
 * @file Componente raiz de la aplicacion Calculator3D.
 *
 * Configura la estructura principal de la aplicacion incluyendo:
 * - React Router (BrowserRouter) para la navegacion del lado del cliente
 * - Proveedor de autenticacion (AuthProvider) para gestionar el estado de sesion
 * - Sistema de notificaciones (Toaster) para mensajes de exito y error
 * - Definicion de todas las rutas de la aplicacion
 * - Guardias de autenticacion (PrivateRoute) para proteger las rutas privadas
 *
 * Estructura de rutas:
 * - /login       -> Pagina de inicio de sesion (publica)
 * - /            -> Calculadora de costos (protegida)
 * - /filaments   -> Gestion de filamentos (protegida)
 * - /printers    -> Gestion de impresoras (protegida)
 * - /history     -> Historial de cotizaciones (protegida)
 * - /supplies    -> Gestion de insumos adicionales (protegida)
 * - /settings    -> Configuracion de la aplicacion (protegida)
 *
 * @module App
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import CalculatorPage from './pages/CalculatorPage';
import ManualQuotePage from './pages/ManualQuotePage';
import QuotesPage from './pages/QuotesPage';
import FilamentsPage from './pages/FilamentsPage';
import PrintersPage from './pages/PrintersPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';
import SuppliesPage from './pages/SuppliesPage';

/**
 * Componente guardia de ruta privada.
 *
 * @description Protege las rutas que requieren autenticacion.
 * Si el usuario no esta autenticado, redirige a /login.
 * Mientras se verifica la sesion, muestra un indicador de carga.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Componentes hijos a renderizar si el usuario esta autenticado
 * @returns {JSX.Element} Los hijos si esta autenticado, o redireccion a /login
 */
function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen" style={{ color: '#4B4F55' }}>Cargando...</div>;
  return user ? children : <Navigate to="/login" />;
}

/**
 * Componente que define la estructura de rutas de la aplicacion.
 *
 * @description Configura todas las rutas usando React Router v6.
 * La ruta /login es publica pero redirige a / si el usuario ya esta autenticado.
 * Todas las demas rutas estan protegidas por PrivateRoute y anidadas
 * dentro del Layout principal (que incluye la barra lateral de navegacion).
 *
 * @returns {JSX.Element|null} Arbol de rutas de la aplicacion, o null mientras carga
 */
function AppRoutes() {
  const { user, loading } = useAuth();

  // No renderizar nada mientras se verifica la sesion para evitar parpadeos
  if (loading) return null;

  return (
    <Routes>
      {/* Ruta publica: redirige a / si ya hay sesion activa */}
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      {/* Rutas protegidas: requieren autenticacion, se renderizan dentro del Layout */}
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<CalculatorPage />} />
        <Route path="quotes" element={<QuotesPage />} />
        <Route path="manual" element={<ManualQuotePage />} />
        <Route path="filaments" element={<FilamentsPage />} />
        <Route path="printers" element={<PrintersPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="supplies" element={<SuppliesPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

/**
 * Componente raiz de la aplicacion Calculator3D.
 *
 * @description Punto de entrada principal que envuelve toda la aplicacion con:
 * - BrowserRouter: habilita la navegacion basada en el historial del navegador
 * - AuthProvider: provee el contexto de autenticacion a toda la aplicacion
 * - AppRoutes: define las rutas y la navegacion
 * - Toaster: sistema de notificaciones posicionado en la esquina superior derecha
 *
 * @returns {JSX.Element} Aplicacion completa envuelta en sus proveedores
 */
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-right" toastOptions={{
          style: { background: '#1a1d21', color: '#F2F4F6', border: '1px solid #2a2d31' },
          success: { iconTheme: { primary: '#3FAF4C', secondary: '#F2F4F6' } },
        }} />
      </AuthProvider>
    </BrowserRouter>
  );
}
