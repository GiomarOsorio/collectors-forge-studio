/**
 * @file Página principal de TurtleForge Studio.
 *
 * Muestra un panel estilo launcher (similar a Okta) con todas las
 * aplicaciones disponibles. Cada app se representa como una tarjeta
 * con ícono, nombre y descripción. Al hacer clic se navega a la app.
 *
 * @module pages/StudioHomePage
 */

import { useNavigate } from 'react-router-dom';
import { APPS } from '../config/apps';

/**
 * Página de inicio de TurtleForge Studio con launcher de aplicaciones.
 *
 * @returns {JSX.Element}
 */
export default function StudioHomePage() {
  const navigate = useNavigate();

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      {/* Bienvenida */}
      <div className="mb-10">
        <h2 className="text-3xl font-bold text-tech-white mb-2">Bienvenido a TurtleForge Studio</h2>
        <p className="text-steel text-lg">Selecciona una aplicación para comenzar.</p>
      </div>

      {/* Grid de aplicaciones */}
      <div>
        <h3 className="text-xs font-semibold text-gunmetal uppercase tracking-widest mb-4">
          Mis aplicaciones
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {APPS.map((app) => {
            const Icon = app.icon;
            return (
              <button
                key={app.id}
                onClick={() => navigate(app.route)}
                className="relative flex flex-col items-center gap-4 p-6 rounded-2xl bg-[#13171c] border border-[#1e2125] hover:border-forge-green/40 hover:bg-forge-green/5 transition-all group text-center"
              >
                {app.badge && (
                  <span className="absolute top-3 right-3 text-xs font-medium px-2 py-0.5 rounded-full bg-forge-green/20 text-forge-green">
                    {app.badge}
                  </span>
                )}
                {/* Ícono */}
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{
                    backgroundColor: `${app.color}18`,
                    border: `1px solid ${app.color}30`,
                  }}
                >
                  <Icon size={32} style={{ color: app.color }} />
                </div>
                {/* Nombre */}
                <div>
                  <p className="font-bold text-tech-white text-base group-hover:text-forge-green transition-colors">
                    {app.name}
                  </p>
                  <p className="text-xs text-gunmetal mt-1 leading-relaxed">{app.description}</p>
                </div>
              </button>
            );
          })}

        </div>
      </div>

</div>
  );
}
