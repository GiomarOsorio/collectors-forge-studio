/**
 * @file Historial de trabajos de laminado con polling automático.
 *
 * Muestra todos los trabajos de laminado del usuario (SlicingJob) en una tabla
 * paginada. Para trabajos en estado 'pending' o 'slicing' realiza polling
 * automático cada 4 segundos para detectar cuando terminan.
 *
 * Acciones disponibles por trabajo:
 * - "Calcular": pre-llena la Calculadora con los datos extraídos (solo estado 'done').
 * - Eliminar: elimina el trabajo y el archivo asociado.
 *
 * @module pages/slicer/SlicerHistoryPage
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader, CheckCircle, AlertCircle, Clock,
  Trash2, ArrowRight, RefreshCw,
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const PER_PAGE = 15;

/**
 * Formatea segundos en un string legible.
 *
 * @param {number|null} seconds
 * @returns {string}
 */
function formatTime(seconds) {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}

/**
 * Insignia de estado de un trabajo de laminado.
 *
 * @param {{ status: string }} props
 * @returns {JSX.Element}
 */
function StatusBadge({ status }) {
  const config = {
    done:    { label: 'Listo',     icon: CheckCircle, color: 'text-emerald-400 bg-emerald-400/10', spin: false },
    error:   { label: 'Error',     icon: AlertCircle, color: 'text-red-400 bg-red-400/10',         spin: false },
    pending: { label: 'En espera', icon: Clock,        color: 'text-amber-400 bg-amber-400/10',    spin: false },
    slicing: { label: 'Laminando', icon: Loader,       color: 'text-amber-400 bg-amber-400/10',    spin: true  },
  };
  const cfg = config[status] || config['pending'];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      <Icon size={11} className={cfg.spin ? 'animate-spin' : ''} />
      {cfg.label}
    </span>
  );
}

/**
 * Etiqueta legible para la fuente de un trabajo.
 *
 * @param {string} source
 * @returns {string}
 */
function sourceLabel(source) {
  const labels = {
    upload_gcode: '.gcode',
    upload_3mf:   '.3mf',
    upload_stl:   'STL',
    makerworld:   'MakerWorld',
  };
  return labels[source] || source;
}

/**
 * Página de historial de laminados.
 *
 * @returns {JSX.Element}
 */
export default function SlicerHistoryPage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  /**
   * Carga los trabajos de laminado del backend.
   *
   * @param {boolean} [silent=false] - Si es true, no muestra indicador de carga
   */
  const fetchJobs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get(`/slicer/jobs?page=${page}&per_page=${PER_PAGE}`);
      setJobs(res.data.items);
      setTotal(res.data.total);
    } catch {
      if (!silent) toast.error('Error al cargar el historial');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [page]);

  // Carga inicial y cuando cambia de página
  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  // Polling automático cuando hay trabajos activos
  useEffect(() => {
    const hasActive = jobs.some(
      (j) => j.status === 'pending' || j.status === 'slicing',
    );
    if (!hasActive) return;
    const interval = setInterval(() => fetchJobs(true), 4000);
    return () => clearInterval(interval);
  }, [jobs, fetchJobs]);

  /** Elimina un trabajo y refresca la lista. */
  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este trabajo de laminado?')) return;
    try {
      await api.delete(`/slicer/jobs/${id}`);
      toast.success('Trabajo eliminado');
      fetchJobs();
    } catch {
      toast.error('Error al eliminar');
    }
  };

  /** Navega a la calculadora con los datos del trabajo como URL params. */
  const handleUseInCalculator = (job) => {
    const params = new URLSearchParams();
    if (job.filament_weight_g) params.set('weight_grams', job.filament_weight_g);
    if (job.print_time_seconds) {
      params.set('print_time_hours', (job.print_time_seconds / 3600).toFixed(4));
    }
    if (job.filament_type) params.set('filament_type', job.filament_type);
    navigate(`/cost/calculator?${params.toString()}`);
  };

  const totalPages = Math.ceil(total / PER_PAGE);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader size={32} className="text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-tech-white">Historial de laminados</h1>
          <p className="text-steel text-sm mt-1">
            {total} trabajo{total !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => fetchJobs()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#2a2d31] text-steel hover:text-tech-white hover:border-[#3a3d41] transition-colors text-sm"
        >
          <RefreshCw size={14} />
          Actualizar
        </button>
      </div>

      {/* Estado vacío */}
      {jobs.length === 0 ? (
        <div className="text-center py-20 text-gunmetal">
          <Clock size={40} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium mb-2">Sin historial</p>
          <p className="text-sm">
            Sube un archivo en{' '}
            <a href="/slicer/upload" className="text-amber-400 hover:underline">
              Subir modelo
            </a>{' '}
            para comenzar.
          </p>
        </div>
      ) : (
        <>
          {/* Tabla de trabajos */}
          <div className="overflow-x-auto rounded-xl border border-[#1e2125]">
            <table className="w-full min-w-[650px]">
              <thead>
                <tr className="border-b border-[#1e2125] text-gunmetal text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Archivo / Fuente</th>
                  <th className="text-left px-4 py-3">Tipo</th>
                  <th className="text-left px-4 py-3">Estado</th>
                  <th className="text-right px-4 py-3">Tiempo</th>
                  <th className="text-right px-4 py-3">Peso</th>
                  <th className="text-right px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr
                    key={job.id}
                    className="border-b border-[#1e2125] hover:bg-[#1a1d21] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="text-tech-white text-sm font-medium truncate max-w-[180px]">
                        {job.original_filename || job.makerworld_url || `Job #${job.id}`}
                      </p>
                      <p className="text-gunmetal text-xs">
                        {new Date(job.created_at).toLocaleDateString('es-CO', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-steel text-sm">{sourceLabel(job.source)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-steel text-sm">
                      {formatTime(job.print_time_seconds)}
                    </td>
                    <td className="px-4 py-3 text-right text-steel text-sm">
                      {job.filament_weight_g
                        ? `${Number(job.filament_weight_g).toFixed(1)} g`
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {job.status === 'done' && (
                          <button
                            onClick={() => handleUseInCalculator(job)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-400/10 text-amber-400 border border-amber-400/20 hover:bg-amber-400/20 transition-colors text-xs font-medium whitespace-nowrap"
                          >
                            <ArrowRight size={12} />
                            Calcular
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(job.id)}
                          className="p-1.5 rounded-lg text-gunmetal hover:text-red-400 hover:bg-red-400/10 transition-colors"
                          title="Eliminar trabajo"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-steel">
              <span>
                Página {page} de {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg border border-[#2a2d31] hover:border-[#3a3d41] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-lg border border-[#2a2d31] hover:border-[#3a3d41] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
