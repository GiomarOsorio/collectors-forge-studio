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
 * - /settings/account         → Configuración de cuenta (protegida)
 * - /settings/company         → Perfil de empresa (protegida)
 * - /settings/users           → Gestión de usuarios (protegida)
 * - /inventory/filaments      → Filamentos del inventario (protegida)
 * - /inventory/supplies       → Insumos y accesorios del inventario (protegida)
 * - /inventory/tools          → Herramientas y suplementos del inventario (protegida)
 * - /inventory/consumables    → Consumibles de la impresora (protegida)
 * - /inventory/stock          → Todo el stock del inventario (protegida)
 * - /inventory/purchases      → Pedidos de compra (protegida)
 * - /inventory/prints         → Inventario de impresiones 3D (protegida)
 * - /inventory/io             → Importar / Exportar inventario (protegida)
 * - /slicer/upload            → Subir modelo STL / .gcode / .3mf o URL MakerWorld (protegida)
 * - /slicer/history           → Historial de trabajos de laminado (protegida)
 * - /maintenance/dashboard    → Estado general de mantenimiento (protegida)
 * - /maintenance/logs         → Historial de registros de mantenimiento (protegida)
 * - /maintenance/printers     → Gestión de impresoras de mantenimiento (protegida)
 * - /queue/                   → Cola de impresión activa (protegida)
 * - /queue/history            → Historial de trabajos completados/cancelados (protegida)
 * - /company/profile          → Perfil de empresa (protegida)
 * - /company/branding         → Marca y colores PDF (protegida)
 * - /company/templates        → Lista de templates Liquid (protegida)
 * - /company/templates/new    → Crear template (protegida)
 * - /company/templates/:id    → Editar template (protegida)
 * - /vault                    → Galería de modelos .3mf (protegida)
 * - /vault/upload             → Subir modelo .3mf (protegida, solo admins)
 *
 * @module App
 */

import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DirtyStateProvider } from './context/DirtyStateContext';
import { ConfirmProvider } from './components/ConfirmDialog';
import StudioLayout from './components/StudioLayout';
import CostLayout from './components/CostLayout';
import InventoryLayout from './components/InventoryLayout';
import SlicerLayout from './components/SlicerLayout';
import SettingsLayout from './components/SettingsLayout';
import MaintenanceLayout from './components/MaintenanceLayout';
import QueueLayout from './components/QueueLayout';
import CompanyLayout from './components/CompanyLayout';
import VaultLayout from './components/VaultLayout';
import Login from './pages/Login';

const StudioHomePage           = lazy(() => import('./pages/StudioHomePage'));
const CalculatorPage           = lazy(() => import('./pages/CalculatorPage'));
const ManualQuotePage          = lazy(() => import('./pages/ManualQuotePage'));
const QuotesPage               = lazy(() => import('./pages/QuotesPage'));
const PrintersPage             = lazy(() => import('./pages/PrintersPage'));
const HistoryPage              = lazy(() => import('./pages/HistoryPage'));
const SettingsPage             = lazy(() => import('./pages/SettingsPage'));
const CuentaPage               = lazy(() => import('./pages/settings/CuentaPage'));
const EmpresaPage              = lazy(() => import('./pages/settings/EmpresaPage'));
const UsuariosPage             = lazy(() => import('./pages/settings/UsuariosPage'));
const InventoryStockPage       = lazy(() => import('./pages/inventory/InventoryStockPage'));
const InventoryPurchasesPage   = lazy(() => import('./pages/inventory/InventoryPurchasesPage'));
const InventoryFilamentsPage   = lazy(() => import('./pages/inventory/InventoryFilamentsPage'));
const InventorySuppliesPage    = lazy(() => import('./pages/inventory/InventorySuppliesPage'));
const InventoryToolsPage       = lazy(() => import('./pages/inventory/InventoryToolsPage'));
const InventoryPrintsPage      = lazy(() => import('./pages/inventory/InventoryPrintsPage'));
const InventoryConsumablesPage  = lazy(() => import('./pages/inventory/InventoryConsumablesPage'));
const InventoryImportExportPage= lazy(() => import('./pages/inventory/InventoryImportExportPage'));
const SlicerUploadPage         = lazy(() => import('./pages/slicer/SlicerUploadPage'));
const SlicerHistoryPage        = lazy(() => import('./pages/slicer/SlicerHistoryPage'));
const SlicerJobDetailPage      = lazy(() => import('./pages/slicer/SlicerJobDetailPage'));
const MaintenanceDashboardPage = lazy(() => import('./pages/maintenance/MaintenanceDashboardPage'));
const MaintenanceLogsPage      = lazy(() => import('./pages/maintenance/MaintenanceLogsPage'));
const MaintenancePrintersPage  = lazy(() => import('./pages/maintenance/MaintenancePrintersPage'));
const QueuePage                = lazy(() => import('./pages/queue/QueuePage'));
const QueueHistoryPage         = lazy(() => import('./pages/queue/QueueHistoryPage'));
const CompanyProfilePage       = lazy(() => import('./pages/company/CompanyProfilePage'));
const CompanyBrandingPage      = lazy(() => import('./pages/company/CompanyBrandingPage'));
const CompanyTemplatesPage     = lazy(() => import('./pages/company/CompanyTemplatesPage'));
const CompanyTemplateEditorPage= lazy(() => import('./pages/company/CompanyTemplateEditorPage'));
const VaultPage                = lazy(() => import('./pages/vault/VaultPage'));
const VaultUploadPage          = lazy(() => import('./pages/vault/VaultUploadPage'));

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
  const navigate = useNavigate();

  // M-05: Redirigir via React Router cuando el interceptor de Axios detecta 401.
  // Así se respeta DirtyStateContext en lugar de hacer un reload completo.
  useEffect(() => {
    const handler = () => navigate('/login', { replace: true });
    window.addEventListener('auth:unauthorized', handler);
    return () => window.removeEventListener('auth:unauthorized', handler);
  }, [navigate]);

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
        <Route path="tools" element={<InventoryToolsPage />} />
        <Route path="consumables" element={<InventoryConsumablesPage />} />
        <Route path="stock" element={<InventoryStockPage />} />
        <Route path="purchases" element={<InventoryPurchasesPage />} />
        <Route path="prints" element={<InventoryPrintsPage />} />
        <Route path="io" element={<InventoryImportExportPage />} />
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

      {/* Aplicación Configuración: cuenta, empresa y usuarios */}
      <Route path="/settings" element={<PrivateRoute><SettingsLayout /></PrivateRoute>}>
        <Route index element={<Navigate to="/settings/account" replace />} />
        <Route path="account" element={<CuentaPage />} />
        <Route path="company" element={<EmpresaPage />} />
        <Route path="users" element={<UsuariosPage />} />
      </Route>

      {/* Aplicación Slicer: laminado de modelos 3D */}
      <Route path="/slicer" element={<PrivateRoute><SlicerLayout /></PrivateRoute>}>
        <Route index element={<Navigate to="/slicer/upload" replace />} />
        <Route path="upload" element={<SlicerUploadPage />} />
        <Route path="history" element={<SlicerHistoryPage />} />
        <Route path="jobs/:id" element={<SlicerJobDetailPage />} />
      </Route>

      {/* Aplicación Mantenimiento: historial de mantenimiento de impresoras */}
      <Route path="/maintenance" element={<PrivateRoute><MaintenanceLayout /></PrivateRoute>}>
        <Route index element={<Navigate to="/maintenance/dashboard" replace />} />
        <Route path="dashboard" element={<MaintenanceDashboardPage />} />
        <Route path="logs" element={<MaintenanceLogsPage />} />
        <Route path="printers" element={<MaintenancePrintersPage />} />
      </Route>

      {/* Aplicación Queue: cola de impresión */}
      <Route path="/queue" element={<PrivateRoute><QueueLayout /></PrivateRoute>}>
        <Route index element={<QueuePage />} />
        <Route path="history" element={<QueueHistoryPage />} />
      </Route>

      {/* Aplicación Compañía: perfil, marca y templates PDF */}
      <Route path="/company" element={<PrivateRoute><CompanyLayout /></PrivateRoute>}>
        <Route index element={<Navigate to="/company/profile" replace />} />
        <Route path="profile"       element={<CompanyProfilePage />} />
        <Route path="branding"      element={<CompanyBrandingPage />} />
        <Route path="templates"     element={<CompanyTemplatesPage />} />
        <Route path="templates/new" element={<CompanyTemplateEditorPage />} />
        <Route path="templates/:id" element={<CompanyTemplateEditorPage />} />
      </Route>

      {/* Aplicación Vault: archivo de modelos .3mf */}
      <Route path="/vault" element={<PrivateRoute><VaultLayout /></PrivateRoute>}>
        <Route index element={<VaultPage />} />
        <Route path="upload" element={<VaultUploadPage />} />
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
          <ConfirmProvider>
            <AppRoutes />
            <Toaster position="top-right" toastOptions={{
            style: { background: '#1A1D25', color: '#F2F4F6', border: '1px solid #2A2F38' },
            success: { iconTheme: { primary: '#2DD4BF', secondary: '#F2F4F6' } },
          }} />
          </ConfirmProvider>
        </DirtyStateProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
