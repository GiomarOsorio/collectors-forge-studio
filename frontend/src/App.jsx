/**
 * @file Componente raíz de Collector's Forge Studio.
 *
 * Configura la estructura principal de la aplicación:
 * - BrowserRouter para navegación del lado del cliente
 * - AuthProvider para el estado de sesión
 * - DirtyStateProvider para rastrear formularios con datos sin guardar
 * - Toaster para notificaciones
 * - Dos zonas de rutas:
 *     /         → Collector's Forge Studio (lanzador de apps)
 *     /cost/*   → Aplicación Cost (calculadora de costos de impresión 3D)
 *
 * Estructura de rutas (rutas canónicas; las versiones legacy redirigen):
 *
 * Públicas:
 * - /login                       → Página de inicio de sesión
 * - /auth/success                → Callback OIDC
 *
 * Protegidas:
 * - /                            → Studio Home (lanzador de apps)
 * - /inventory/v2                → Inventario (tabs internos: Filamentos /
 *                                  Insumos / Herr / Consumibles / Compras)
 * - /inventory/purchases         → Pedidos de compra (tabla)
 * - /inventory/prints            → Disponible para venta
 * - /inventory/io                → Importar / Exportar CSV
 * - /cost/v2                     → Cost dashboard (tabs Cotizaciones / Historial)
 * - /cost/calculator             → Calculadora de costos
 * - /cost/manual                 → Nueva cotización manual
 * - /cost/printers               → Gestión de impresoras
 * - /cost/history                → Historial de cotizaciones internas
 * - /cost/settings               → Tarifa eléctrica & ajustes
 * - /settings/v2                 → Settings (Cuenta + Usuarios admin)
 * - /slicer/v2                   → Slicer (Upload / Historial / detalle vía drawer)
 * - /maintenance/v2              → Mantenimiento (Dashboard + Historial + CRUD)
 * - /queue/v2                    → Cola (Activa + Historial)
 * - /vault                       → Vault de modelos (.3mf / .gcode.3mf)
 * - /vault/upload/v2             → Subir modelo (admin)
 * - /company/v2                  → Compañía (admin — Perfil / Marca / Templates)
 * - /company/templates/new       → Crear template Liquid (admin)
 * - /company/templates/:id       → Editar template Liquid (admin)
 *
 * @module App
 */

import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DirtyStateProvider } from './context/DirtyStateContext';
import { ConfirmProvider } from './components/ConfirmDialog';
import AppLayout from './components/AppLayout';
import Login from './pages/Login';
import AuthSuccess from './pages/AuthSuccess';

const StudioHomePage           = lazy(() => import('./pages/StudioHomePage'));
const CalculatorPage           = lazy(() => import('./pages/CalculatorPage'));
const ManualQuotePage          = lazy(() => import('./pages/ManualQuotePage'));
const PrintersPage             = lazy(() => import('./pages/PrintersPage'));
const HistoryPage              = lazy(() => import('./pages/HistoryPage'));
const CostSettingsPage         = lazy(() => import('./pages/CostSettingsPage'));
const SettingsPage             = lazy(() => import('./pages/settings/SettingsPage'));
const InventoryPage            = lazy(() => import('./pages/inventory/InventoryPage'));
const CostPage                 = lazy(() => import('./pages/cost/CostPage'));
const SlicerPage               = lazy(() => import('./pages/slicer/SlicerPage'));
const QueuePage                = lazy(() => import('./pages/queue/QueuePage'));
const MaintenancePage          = lazy(() => import('./pages/maintenance/MaintenancePage'));
const VaultPage                = lazy(() => import('./pages/vault/VaultPage'));
const VaultUploadPage          = lazy(() => import('./pages/vault/VaultUploadPage'));
const CompanyPage              = lazy(() => import('./pages/company/CompanyPage'));
const CompanyTemplateEditorPage= lazy(() => import('./pages/company/CompanyTemplateEditorPage'));
const InventoryPurchasesPage   = lazy(() => import('./pages/inventory/InventoryPurchasesPage'));
const InventoryPrintsPage      = lazy(() => import('./pages/inventory/InventoryPrintsPage'));
const InventoryImportExportPage= lazy(() => import('./pages/inventory/InventoryImportExportPage'));

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
 * Componente guardia de ruta administrativa.
 * Si el usuario no tiene rol 'admin', redirige a /.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @returns {JSX.Element}
 */
function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen" style={{ color: '#4B4F55' }}>Cargando...</div>;
  if (!user) return <Navigate to="/login" />;
  return user.role === 'admin' ? children : <Navigate to="/" />;
}

/**
 * Redirect que preserva los query params del request original.
 *
 * Diferente de `<Navigate to="/x" replace />`: ese descarta el `?foo=bar`
 * de la URL al redirigir. Cuando la ruta destino consume search params
 * (ej. `/cost/calculator?weight_grams=245`), necesitamos conservarlos
 * o el flujo se rompe silenciosamente.
 *
 * @param {{ to: string }} props - Path destino sin query.
 */
function RedirectPreservingSearch({ to }) {
  const { search } = useLocation();
  return <Navigate to={{ pathname: to, search }} replace />;
}

/**
 * Árbol de rutas de la aplicación.
 *
 * @returns {JSX.Element|null}
 */
function AppRoutes() {
  const { user, loading, clearAuth } = useAuth();
  const navigate = useNavigate();

  // M-05: Redirigir via React Router cuando el interceptor de Axios detecta 401.
  // Así se respeta DirtyStateContext en lugar de hacer un reload completo.
  useEffect(() => {
    const handler = () => {
      clearAuth();
      navigate('/login', { replace: true });
    };
    window.addEventListener('auth:unauthorized', handler);
    return () => window.removeEventListener('auth:unauthorized', handler);
  }, [navigate, clearAuth]);

  if (loading) return null;

  return (
    <Routes>
      {/* Rutas públicas */}
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/auth/success" element={<AuthSuccess />} />

      {/* Layout único con sidebar global. Todas las apps comparten StudioSidebar. */}
      <Route element={<PrivateRoute><AppLayout /></PrivateRoute>}>
        {/* Home: dashboard de Collector's Forge Studio */}
        <Route path="/" element={<StudioHomePage />} />

        {/* Inventario — los 5 tabs viejos (filaments/supplies/tools/
            consumables/stock) se absorbieron en los tabs internos de
            InventoryPage v2. Mantenemos redirects para bookmarks. */}
        <Route path="/inventory">
          <Route index element={<Navigate to="/inventory/v2" replace />} />
          <Route path="v2" element={<InventoryPage />} />
          <Route path="filaments"   element={<RedirectPreservingSearch to="/inventory/v2" />} />
          <Route path="supplies"    element={<RedirectPreservingSearch to="/inventory/v2" />} />
          <Route path="tools"       element={<RedirectPreservingSearch to="/inventory/v2" />} />
          <Route path="consumables" element={<RedirectPreservingSearch to="/inventory/v2" />} />
          <Route path="stock"       element={<RedirectPreservingSearch to="/inventory/v2" />} />
          <Route path="purchases" element={<InventoryPurchasesPage />} />
          <Route path="prints"    element={<InventoryPrintsPage />} />
          <Route path="io"        element={<InventoryImportExportPage />} />
        </Route>

        {/* Cost — QuotesPage V1 absorbida por CostPage V2 (tab Cotizaciones).
            CalculatorPageV2 era incompleto y se borró; queda solo la V1
            funcional en /cost/calculator. Redirect /cost/calculator/v2 → V1
            mientras se hace el visual refresh completo en un PR futuro. */}
        <Route path="/cost">
          <Route index element={<Navigate to="/cost/v2" replace />} />
          <Route path="v2" element={<CostPage />} />
          <Route path="calculator/v2" element={<RedirectPreservingSearch to="/cost/calculator" />} />
          <Route path="calculator" element={<CalculatorPage />} />
          <Route path="quotes" element={<RedirectPreservingSearch to="/cost/v2" />} />
          <Route path="manual" element={<ManualQuotePage />} />
          <Route path="printers" element={<PrintersPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="settings" element={<CostSettingsPage />} />
        </Route>

        {/* Settings — V1 (Cuenta / Empresa / Usuarios) reemplazadas por
            SettingsPage con drawers integrados. /settings/company
            redirige a /company/v2 (Fase 6 ya tenía el ProfileFormDrawer). */}
        <Route path="/settings">
          <Route index element={<Navigate to="/settings/v2" replace />} />
          <Route path="v2" element={<SettingsPage />} />
          <Route path="account" element={<Navigate to="/settings/v2" replace />} />
          <Route path="users"   element={<Navigate to="/settings/v2" replace />} />
          <Route path="company" element={<Navigate to="/company/v2" replace />} />
        </Route>

        {/* Slicer — Upload/History/JobDetail absorbidos por tabs+drawer
            de SlicerPage v2. Redirects para bookmarks viejos. */}
        <Route path="/slicer">
          <Route index element={<Navigate to="/slicer/v2" replace />} />
          <Route path="v2" element={<SlicerPage />} />
          <Route path="upload"   element={<RedirectPreservingSearch to="/slicer/v2" />} />
          <Route path="history"  element={<RedirectPreservingSearch to="/slicer/v2" />} />
          <Route path="jobs/:id" element={<RedirectPreservingSearch to="/slicer/v2" />} />
        </Route>

        {/* Mantenimiento — V2 reemplaza por completo Dashboard/Logs/Printers V1
            (el CRUD vive ahora dentro del MaintenancePage vía LogFormDrawer
            + edición inline de current_hours en el drawer de impresora). */}
        <Route path="/maintenance">
          <Route index element={<Navigate to="/maintenance/v2" replace />} />
          <Route path="v2" element={<MaintenancePage />} />
          <Route path="dashboard" element={<Navigate to="/maintenance/v2" replace />} />
          <Route path="logs" element={<Navigate to="/maintenance/v2" replace />} />
          <Route path="printers" element={<Navigate to="/maintenance/v2" replace />} />
        </Route>

        {/* Queue — V1 (QueuePage + QueueHistoryPage) absorbidas por tabs
            internos de la v2 (Activa / Historial). Redirects para bookmarks. */}
        <Route path="/queue">
          <Route index element={<Navigate to="/queue/v2" replace />} />
          <Route path="v2" element={<QueuePage />} />
          <Route path="legacy"  element={<RedirectPreservingSearch to="/queue/v2" />} />
          <Route path="history" element={<RedirectPreservingSearch to="/queue/v2" />} />
        </Route>

        {/* Compañía (solo admin) — Profile/Branding/Templates list reemplazadas
            por CompanyPage (drawers integrados). El editor de templates
            sigue como ruta dedicada por su tamaño (textarea HTML grande). */}
        <Route
          path="/company"
          element={<AdminRoute><Outlet /></AdminRoute>}
        >
          <Route index element={<Navigate to="/company/v2" replace />} />
          <Route path="v2" element={<CompanyPage />} />
          <Route path="profile"       element={<Navigate to="/company/v2" replace />} />
          <Route path="branding"      element={<Navigate to="/company/v2" replace />} />
          <Route path="templates"     element={<Navigate to="/company/v2" replace />} />
          <Route path="templates/new" element={<CompanyTemplateEditorPage />} />
          <Route path="templates/:id" element={<CompanyTemplateEditorPage />} />
        </Route>

        {/* Vault — V1 (galería + upload) reemplazada por V2. Las rutas
            legacy redirigen a v2 para preservar bookmarks viejos. */}
        <Route path="/vault">
          <Route index element={<VaultPage />} />
          <Route path="v2" element={<VaultPage />} />
          <Route path="legacy" element={<Navigate to="/vault" replace />} />
          <Route path="upload" element={<Navigate to="/vault/upload/v2" replace />} />
          <Route path="upload/v2" element={<VaultUploadPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

/**
 * Componente raíz de Collector's Forge Studio.
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
