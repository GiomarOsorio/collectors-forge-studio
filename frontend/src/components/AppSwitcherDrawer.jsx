/**
 * @file Cajón lateral para cambiar entre aplicaciones de TurtleForge Studio.
 *
 * Se desliza desde la izquierda (por encima del sidebar) mostrando todas las
 * aplicaciones disponibles. Si el usuario tiene datos sin guardar y trata de
 * cambiar de app, se le muestra una advertencia de confirmación.
 *
 * @module components/AppSwitcherDrawer
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Home } from 'lucide-react';
import { useDirtyState } from '../context/DirtyStateContext';
import { APPS } from '../config/apps';

/**
 * Cajón lateral de cambio de aplicaciones.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Si el cajón está visible
 * @param {Function} props.onClose - Callback para cerrar el cajón
 * @returns {JSX.Element|null}
 */
export default function AppSwitcherDrawer({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { isDirty, clearAllDirty } = useDirtyState();
  /** Almacena la ruta destino mientras se muestra el diálogo de confirmación */
  const [pendingRoute, setPendingRoute] = useState(null);

  if (!isOpen && pendingRoute === null) return null;

  /**
   * Maneja la selección de una aplicación.
   * Si hay datos sin guardar, pide confirmación antes de navegar.
   *
   * @param {string} route - Ruta de entrada de la app seleccionada
   */
  const handleSelectApp = (route) => {
    if (isDirty) {
      setPendingRoute(route);
    } else {
      onClose();
      navigate(route);
    }
  };

  /** Confirma el cambio de app descartando los datos sin guardar. */
  const handleConfirmSwitch = () => {
    clearAllDirty();
    onClose();
    navigate(pendingRoute);
    setPendingRoute(null);
  };

  /** Cancela el cambio de app y vuelve al cajón. */
  const handleCancelSwitch = () => {
    setPendingRoute(null);
  };

  return (
    <>
      {/* Overlay oscuro (z-[49], encima del sidebar z-40) */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-[49]"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Panel del cajón (z-50) */}
      {isOpen && (
        <div className="fixed inset-y-0 left-0 z-50 w-80 bg-[#0A0E16] border-r border-[#222630] flex flex-col shadow-2xl">
          {/* Encabezado del cajón */}
          <div className="p-6 border-b border-[#222630] flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-tech-white">TurtleForge Studio</h2>
              <p className="text-sm text-gunmetal">Selecciona una aplicación</p>
            </div>
            <button
              onClick={onClose}
              className="tf-btn-ghost"
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>
          </div>

          {/* Grid de aplicaciones */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Botón de regreso al Studio Home */}
            <button
              onClick={() => handleSelectApp('/')}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-[#111520] border border-[#222630] hover:border-forge-teal/40 hover:bg-forge-teal/5 transition-all group mb-5"
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#222630] group-hover:bg-forge-teal/10 transition-colors">
                <Home size={18} className="text-gunmetal group-hover:text-forge-teal transition-colors" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-tech-white text-sm group-hover:text-forge-teal transition-colors">
                  Studio Home
                </p>
                <p className="text-xs text-gunmetal">Lanzador de aplicaciones</p>
              </div>
            </button>

            <p className="text-xs text-gunmetal uppercase tracking-wider mb-3 px-1">Aplicaciones</p>
            <div className="grid grid-cols-2 gap-4">
              {APPS.filter((app) => !app.hidden).map((app) => {
                const Icon = app.icon;
                return (
                  <button
                    key={app.id}
                    onClick={() => handleSelectApp(app.route)}
                    className="flex flex-col items-center gap-3 p-4 rounded-xl bg-[#111520] border border-[#222630] hover:border-forge-teal/40 hover:bg-forge-teal/5 transition-all group text-center"
                  >
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${app.color}20`, border: `1px solid ${app.color}30` }}
                    >
                      <Icon size={24} style={{ color: app.color }} />
                    </div>
                    <div>
                      <p className="font-semibold text-tech-white text-sm group-hover:text-forge-teal transition-colors">
                        {app.name}
                      </p>
                      <p className="text-xs text-gunmetal mt-0.5 leading-tight">{app.shortDescription}</p>
                    </div>
                  </button>
                );
              })}

            </div>
          </div>

          {/* Pie del cajón */}
          <div className="p-4 border-t border-[#222630]">
            <p className="text-xs text-gunmetal text-center">TurtleForge Studio · v1.0</p>
          </div>
        </div>
      )}

      {/* Diálogo de confirmación si hay datos sin guardar */}
      {pendingRoute !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={handleCancelSwitch} />
          <div className="relative bg-[#111520] border border-[#2A2F38] rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-tech-white font-semibold mb-2">¿Cambiar de aplicación?</h3>
            <p className="text-steel text-sm mb-6">
              Tienes datos sin guardar. Si cambias de aplicación, perderás los cambios actuales.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleCancelSwitch}
                className="flex-1 px-4 py-2 rounded-lg border border-[#2A2F38] text-steel hover:text-tech-white hover:border-[#363C47] transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmSwitch}
                className="flex-1 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 transition-colors text-sm font-medium"
              >
                Cambiar de todas formas
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
