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
 * - /login                    → Página de inicio de sesión (pública)
 * - /                         → TurtleForge Studio Home (protegida)
 * - /cost/calculator          → Calculadora de costos (protegida)
 * - /cost/quotes              → Historial de cotizaciones de cliente (protegida)
 * - /cost/manual              → Nueva cotización de cliente (protegida)
 * - /cost/printers            → Gestión de impresoras (protegida)
 * - /cost/history             → Historial de costos de impresión (protegida)
 * - /cost/settings            → Configuración de la aplicación (protegida)
 * - /inventory/filaments      → Filamentos del inventario (protegida)
 * - /inventory/supplies       → Insumos y accesorios del inventario (protegida)
 * - /inventory/stock          → Todo el stock del inventario (protegida)
 * - /inventory/purchases      → Pedidos de compra (protegida)
 * - /inventory/prints         → Inventario de impresiones 3D (protegida)
 * - /slicer/upload            → Subir modelo STL / .gcode / .3mf o URL MakerWorld (protegida)
 * - /slicer/history           → Historial de trabajos de laminado (protegida)
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
import SlicerLayout from './components/SlicerLayout';
import Login from './pages/Login';
import StudioHomePage from './pages/StudioHomePage';
import InventoryStockPage from './pages/inventory/InventoryStockPage';
import InventoryPurchasesPage from './pages/inventory/InventoryPurchasesPage';
import CalculatorPage from './pages/CalculatorPage';
import ManualQuotePage from './pages/ManualQuotePage';
import QuotesPage from './pages/QuotesPage';
import PrintersPage from './pages/PrintersPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';
import InventoryFilamentsPage from './pages/inventory/InventoryFilamentsPage';
import InventorySuppliesPage from './pages/inventory/InventorySuppliesPage';
import InventoryPrintsPage from './pages/inventory/InventoryPrintsPage';
import SlicerUploadPage from './pages/slicer/SlicerUploadPage';
import SlicerHistoryPage from './pages/slicer/SlicerHistoryPage';

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
      {/* Ruta pública: redirige al dashboard si ya hay sesión */}
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />

      {/* TurtleForge Studio Home: lanzador de aplicaciones */}
      <Route path="/" element={<PrivateRoute><StudioLayout /></PrivateRoute>}>
        <Route index element={<StudioHomePage />} />
      </Route>

      {/* Aplicación Inventario: gestión de stock y pedidos */}
      <Route path="/inventory" element={<PrivateRoute><InventoryLayout /></PrivateRoute>}>
        <Route index element={<Navigate to="/inventory/stock" replace />} />
        <Route path="filaments" element={<InventoryFilamentsPage />} />
        <Route path="supplies" element={<InventorySuppliesPage />} />
        <Route path="stock" element={<InventoryStockPage />} />
        <Route path="purchases" element={<InventoryPurchasesPage />} />
        <Route path="prints" element={<InventoryPrintsPage />} />
      </Route>

      {/* Aplicación Cost: calculadora de costos de impresión 3D */}
      <Route path="/cost" element={<PrivateRoute><CostLayout /></PrivateRoute>}>
        <Route index element={<Navigate to="/cost/calculator" replace />} />
        <Route path="calculator" element={<CalculatorPage />} />
        <Route path="quotes" element={<QuotesPage />} />
        <Route path="manual" element={<ManualQuotePage />} />
        <Route path="printers" element={<PrintersPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Aplicación Slicer: laminado de modelos 3D */}
      <Route path="/slicer" element={<PrivateRoute><SlicerLayout /></PrivateRoute>}>
        <Route index element={<Navigate to="/slicer/upload" replace />} />
        <Route path="upload" element={<SlicerUploadPage />} />
        <Route path="history" element={<SlicerHistoryPage />} />
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
