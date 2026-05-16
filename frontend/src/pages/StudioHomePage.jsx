/**
 * @file Página principal de Collector's Forge Studio.
 *
 * Reemplaza el antiguo launcher de tarjetas con el `Dashboard` reconfigurable
 * (drag/resize/hide). Los widgets viven en `components/widgets/`.
 *
 * @module pages/StudioHomePage
 */

import { Home } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Dashboard from '../components/Dashboard';
import MobileAppHeader from '../components/MobileAppHeader';
import { useIsMobile } from '../hooks/useMediaQuery';

/**
 * Página de inicio del Studio con dashboard de widgets.
 *
 * @returns {JSX.Element}
 */
export default function StudioHomePage() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { openSidebar } = useOutletContext() || {};

  if (isMobile) {
    return (
      <div className="flex flex-col">
        <MobileAppHeader
          appName="Studio"
          appIcon={Home}
          appAccent="#2DD4BF"
          title={`Hola${user?.username ? `, ${user.username}` : ''}`}
          onMenu={() => openSidebar?.()}
        />
        <div className="px-4 mt-1">
          <p className="text-steel text-[12.5px] leading-snug mb-3">
            Estado del taller en vivo. Reordena, redimensiona u oculta los widgets a tu gusto.
          </p>
          <Dashboard />
        </div>
      </div>
    );
  }

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
