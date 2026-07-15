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
 * Estructura de rutas. URLs legacy redirigen al canónico preservando
 * query params (vía `RedirectPreservingSearch`).
 *
 * Públicas:
 * - /login                       → Página de inicio de sesión
 * - /auth/success                → Callback OIDC
 *
 * Protegidas:
 * - /                            → Studio Home (lanzador de apps)
 * - /inventory                   → Inventario (tabs: Filamentos / Insumos /
 *                                  Herr / Consumibles / Compras)
 * - /inventory/purchases         → Pedidos de compra (tabla)
 * - /inventory/prints            → Disponible para venta
 * - /inventory/io                → Importar / Exportar CSV
 * - /inventory/spools            → Bobinas individuales (issue #134)
 * - /cost                        → Dashboard de costos (tabs Cotizaciones / Historial)
 * - /cost/calculator             → Calculadora de costos
 * - /cost/manual                 → Nueva cotización manual
 * - /cost/printers               → Gestión de impresoras
 * - /cost/history                → Historial de cotizaciones internas
 * - /cost/settings               → Tarifa eléctrica & ajustes
 * - /settings                    → Settings (Cuenta + Usuarios admin)
 * - /maintenance                 → Mantenimiento (Dashboard + Historial + CRUD)
 * - /queue                       → Cola de impresión (Activa + Historial + Timeline)
 * - /queue/log                   → Bitácora global de impresiones (issue #131)
 * - /vault                       → Vault de modelos (.3mf / .gcode.3mf)
 * - /vault/upload                → Subir modelo (admin)
 * - /company                     → Compañía (admin — Perfil / Marca / Templates)
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
import { ThemeProvider, useTheme } from './context/ThemeContext';
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
const QueuePage                = lazy(() => import('./pages/queue/QueuePage'));
const PrintLogPage             = lazy(() => import('./pages/queue/PrintLogPage'));
const MaintenancePage          = lazy(() => import('./pages/maintenance/MaintenancePage'));
const VaultPage                = lazy(() => import('./pages/vault/VaultPage'));
const VaultUploadPage          = lazy(() => import('./pages/vault/VaultUploadPage'));
const VaultTrashPage           = lazy(() => import('./pages/vault/VaultTrashPage'));
const ProjectsPage             = lazy(() => import('./pages/projects/ProjectsPage'));
const CompanyPage              = lazy(() => import('./pages/company/CompanyPage'));
const CompanyTemplateEditorPage= lazy(() => import('./pages/company/CompanyTemplateEditorPage'));
const InventoryPurchasesPage   = lazy(() => import('./pages/inventory/InventoryPurchasesPage'));
const InventoryPrintsPage      = lazy(() => import('./pages/inventory/InventoryPrintsPage'));
const InventoryImportExportPage= lazy(() => import('./pages/inventory/InventoryImportExportPage'));
const InventorySpoolsPage      = lazy(() => import('./pages/inventory/InventorySpoolsPage'));
const StatsPage                = lazy(() => import('./pages/stats/StatsPage'));

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
 * de la URL al redirigir. Cuando la ruta destino consume search params,
 * necesitamos conservarlos o el flujo se rompe silenciosamente.
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
        {/* Inventario — `index` es ahora la pantalla canónica con tabs
            internos (filamentos / insumos / herramientas / consumibles /
            compras). Sub-rutas dedicadas para pedidos / prints / I/O.
            Las URLs legacy (/v2 + 5 tabs viejos) redirigen al index. */}
        <Route path="/inventory">
          <Route index               element={<InventoryPage />} />
          <Route path="v2"           element={<RedirectPreservingSearch to="/inventory" />} />
          <Route path="filaments"    element={<RedirectPreservingSearch to="/inventory" />} />
          <Route path="supplies"     element={<RedirectPreservingSearch to="/inventory" />} />
          <Route path="tools"        element={<RedirectPreservingSearch to="/inventory" />} />
          <Route path="consumables"  element={<RedirectPreservingSearch to="/inventory" />} />
          <Route path="stock"        element={<RedirectPreservingSearch to="/inventory" />} />
          <Route path="purchases"    element={<InventoryPurchasesPage />} />
          <Route path="prints"       element={<InventoryPrintsPage />} />
          <Route path="io"           element={<InventoryImportExportPage />} />
          <Route path="spools"       element={<InventorySpoolsPage />} />
        </Route>

        {/* Cost — `index` es el dashboard (tabs Cotizaciones / Historial).
            Sub-rutas para Calculator, Manual, Printers, History y Settings
            (tarifa eléctrica). /cost/quotes y /cost/calculator/v2 redirigen. */}
        <Route path="/cost">
          <Route index               element={<CostPage />} />
          <Route path="v2"           element={<RedirectPreservingSearch to="/cost" />} />
          <Route path="calculator"   element={<CalculatorPage />} />
          <Route path="calculator/v2" element={<RedirectPreservingSearch to="/cost/calculator" />} />
          <Route path="quotes"       element={<RedirectPreservingSearch to="/cost" />} />
          <Route path="manual"       element={<ManualQuotePage />} />
          <Route path="printers"     element={<PrintersPage />} />
          <Route path="history"      element={<HistoryPage />} />
          <Route path="settings"     element={<CostSettingsPage />} />
        </Route>

        {/* Settings — `index` cubre Cuenta + Usuarios (admin) vía drawers.
            /settings/company redirige a /company para editar perfil. */}
        <Route path="/settings">
          <Route index           element={<SettingsPage />} />
          <Route path="v2"       element={<RedirectPreservingSearch to="/settings" />} />
          <Route path="account"  element={<RedirectPreservingSearch to="/settings" />} />
          <Route path="users"    element={<RedirectPreservingSearch to="/settings" />} />
          <Route path="company"  element={<RedirectPreservingSearch to="/company" />} />
        </Route>

        {/* Mantenimiento — `index` con Dashboard + Historial + CRUD logs
            + edición inline de horas vía drawer. URLs legacy redirigen. */}
        <Route path="/maintenance">
          <Route index           element={<MaintenancePage />} />
          <Route path="v2"       element={<RedirectPreservingSearch to="/maintenance" />} />
          <Route path="dashboard" element={<RedirectPreservingSearch to="/maintenance" />} />
          <Route path="logs"     element={<RedirectPreservingSearch to="/maintenance" />} />
          <Route path="printers" element={<RedirectPreservingSearch to="/maintenance" />} />
        </Route>

        {/* Queue — `index` con tabs internos (Activa / Historial). */}
        <Route path="/queue">
          <Route index           element={<QueuePage />} />
          <Route path="v2"       element={<RedirectPreservingSearch to="/queue" />} />
          <Route path="legacy"   element={<RedirectPreservingSearch to="/queue" />} />
          <Route path="history"  element={<RedirectPreservingSearch to="/queue" />} />
          <Route path="log"      element={<PrintLogPage />} />
        </Route>

        {/* Stats — dashboard de analytics de impresión y costos (issue #132). */}
        <Route path="/stats" element={<StatsPage />} />

        {/* Compañía (solo admin) — `index` con drawers integrados
            (Perfil / Marca / Templates list). El editor de templates
            queda como ruta dedicada por su tamaño (textarea HTML grande). */}
        <Route
          path="/company"
          element={<AdminRoute><Outlet /></AdminRoute>}
        >
          <Route index               element={<CompanyPage />} />
          <Route path="v2"           element={<RedirectPreservingSearch to="/company" />} />
          <Route path="profile"      element={<RedirectPreservingSearch to="/company" />} />
          <Route path="branding"     element={<RedirectPreservingSearch to="/company" />} />
          <Route path="templates"    element={<RedirectPreservingSearch to="/company" />} />
          <Route path="templates/new" element={<CompanyTemplateEditorPage />} />
          <Route path="templates/:id" element={<CompanyTemplateEditorPage />} />
        </Route>

        {/* Vault — `index` es la galería; subir es ruta dedicada. */}
        <Route path="/vault">
          <Route index           element={<VaultPage />} />
          <Route path="v2"       element={<RedirectPreservingSearch to="/vault" />} />
          <Route path="legacy"   element={<RedirectPreservingSearch to="/vault" />} />
          <Route path="upload"   element={<VaultUploadPage />} />
          <Route path="upload/v2" element={<RedirectPreservingSearch to="/vault/upload" />} />
          <Route path="trash"   element={<VaultTrashPage />} />
        </Route>

        {/* Proyectos — agrupador de items de la cola de impresión. */}
        <Route path="/projects" element={<ProjectsPage />} />
      </Route>
    </Routes>
  );
}

/**
 * Toaster con estilo reactivo al tema claro/oscuro.
 * Componente separado porque `useTheme()` solo puede llamarse dentro del
 * árbol de `ThemeProvider`, no en `App()` antes de montarlo.
 *
 * @returns {JSX.Element}
 */
function ThemedToaster() {
  const { resolvedMode } = useTheme();
  const isDark = resolvedMode === 'dark';
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: isDark ? '#1A1D25' : '#FFFFFF',
          color: isDark ? '#F2F4F6' : '#171B24',
          border: `1px solid ${isDark ? '#2A2F38' : '#E2E6EC'}`,
        },
        success: { iconTheme: { primary: '#2DD4BF', secondary: isDark ? '#F2F4F6' : '#FFFFFF' } },
      }}
    />
  );
}

/**
 * Componente raíz de Collector's Forge Studio.
 *
 * @returns {JSX.Element}
 */
export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <DirtyStateProvider>
            <ConfirmProvider>
              <AppRoutes />
              <ThemedToaster />
            </ConfirmProvider>
          </DirtyStateProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
