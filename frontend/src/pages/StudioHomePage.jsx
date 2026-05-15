/**
 * @file Página principal de Collector's Forge Studio.
 *
 * Reemplaza el antiguo launcher de tarjetas con el `Dashboard` reconfigurable
 * (drag/resize/hide). Los widgets viven en `components/widgets/`.
 *
 * @module pages/StudioHomePage
 */

import { useAuth } from '../context/AuthContext';
import Dashboard from '../components/Dashboard';

/**
 * Página de inicio del Studio con dashboard de widgets.
 *
 * @returns {JSX.Element}
 */
export default function StudioHomePage() {
  const { user } = useAuth();

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6" style={{ animation: 'fadeInUp 0.35s ease-out both' }}>
        <h2 className="text-2xl md:text-3xl font-bold text-tech-white mb-1">
          Hola{user?.username ? `, ${user.username}` : ''}
        </h2>
        <p className="text-steel text-sm">
          Estado del taller en vivo. Reordena, redimensiona u oculta los widgets a tu gusto.
        </p>
      </div>
      <Dashboard />
    </div>
  );
}
