/**
 * @file Componente raíz de TurtleForge Studio.
 *
 * Configura la estructura principal de la aplicación:
 * - BrowserRouter para navegación del lado del cliente
 * - AuthProvider para el estado de sesión
 * - DirtyStateProvider para rastrear formularios con datos sin guardar
 * - Toaster para notificaciones
 * - Dos zonas de rutas:
 *     /         → TurtleForge Studio (lanzador de apps)
 *     /cost/*   → Aplicación Cost (calculadora de costos de impresión 3D)
 *
 * Estructura de rutas:
 * - /login              → Página de inicio de sesión (pública)
 * - /                   → TurtleForge Studio Home (protegida)
 * - /cost/calculator    → Calculadora de costos (protegida)
 * - /cost/quotes        → Historial de cotizaciones de cliente (protegida)
 * - /cost/manual        → Nueva cotización de cliente (protegida)
 * - /cost/filaments     → Gestión de filamentos (protegida)
 * - /cost/printers      → Gestión de impresoras (protegida)
 * - /cost/history       → Historial de costos de impresión (protegida)
 * - /cost/supplies      → Gestión de insumos adicionales (protegida)
 * - /cost/settings      → Configuración de la aplicación (protegida)
 *
 * @module App
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DirtyStateProvider } from './context/DirtyStateContext';
import StudioLayout from './components/StudioLayout';
import CostLayout from './components/CostLayout';
import InventoryLayout from './components/InventoryLayout';
import Login from './pages/Login';
import StudioHomePage from './pages/StudioHomePage';
import InventoryStockPage from './pages/inventory/InventoryStockPage';
import InventoryPurchasesPage from './pages/inventory/InventoryPurchasesPage';
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
 * Si el usuario no está autenticado, redirige a /login.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @returns {JSX.Element}
 */
function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen" style={{ color: '#4B4F55' }}>Cargando...</div>;
  return user ? children : <Navigate to="/login" />;
}

/**
 * Árbol de rutas de la aplicación.
 *
 * @returns {JSX.Element|null}
 */
function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return null;

  return (
    <Routes>
      {/* Ruta pública: redirige a /cost/calculator si ya hay sesión */}
      <Route path="/login" element={user ? <Navigate to="/cost/calculator" /> : <Login />} />

      {/* TurtleForge Studio Home: lanzador de aplicaciones */}
      <Route path="/" element={<PrivateRoute><StudioLayout /></PrivateRoute>}>
        <Route index element={<StudioHomePage />} />
      </Route>

      {/* Aplicación Inventario: gestión de stock y pedidos */}
      <Route path="/inventory" element={<PrivateRoute><InventoryLayout /></PrivateRoute>}>
        <Route index element={<Navigate to="/inventory/stock" replace />} />
        <Route path="stock" element={<InventoryStockPage />} />
        <Route path="purchases" element={<InventoryPurchasesPage />} />
      </Route>

      {/* Aplicación Cost: calculadora de costos de impresión 3D */}
      <Route path="/cost" element={<PrivateRoute><CostLayout /></PrivateRoute>}>
        <Route index element={<Navigate to="/cost/calculator" replace />} />
        <Route path="calculator" element={<CalculatorPage />} />
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
 * Componente raíz de TurtleForge Studio.
 *
 * @returns {JSX.Element}
 */
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DirtyStateProvider>
          <AppRoutes />
          <Toaster position="top-right" toastOptions={{
            style: { background: '#1a1d21', color: '#F2F4F6', border: '1px solid #2a2d31' },
            success: { iconTheme: { primary: '#3FAF4C', secondary: '#F2F4F6' } },
          }} />
        </DirtyStateProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
