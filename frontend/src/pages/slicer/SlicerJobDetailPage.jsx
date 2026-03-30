/**
 * @file Detalle de un trabajo de laminado.
 *
 * Muestra los datos extraídos de un SlicingJob: totales, desglose
 * multi-placa con filamentos y colores, y acciones para usar en
 * la calculadora.
 *
 * @module pages/slicer/SlicerJobDetailPage
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Loader2, CheckCircle, AlertCircle, Clock, Layers,
  ArrowLeft, Calculator, Box,
} from 'lucide-react';
import { getSlicingJob } from '../../services/api';
import api from '../../services/api';
import toast from 'react-hot-toast';
import FilamentMapperModal from '../../components/slicer/FilamentMapperModal';
import GcodeViewerDialog from '../../components/slicer/GcodeViewerDialog';

/**
 * Formatea segundos en un string legible (Xh Ym Zs).
 *
 * @param {number|null} seconds
 * @returns {string}
 */
function formatTime(seconds) {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * Página de detalle de un trabajo de laminado.
 *
 * @returns {JSX.Element}
 */
export default function SlicerJobDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  /** Filamentos a mapear para el modal (null = cerrado). */
  const [mapperData, setMapperData] = useState(null);
  /** Placa a visualizar en 3D (null = cerrado). */
  const [viewerPlate, setViewerPlate] = useState(null);
  /** URLs de thumbnails por plate_number (blob o data URI). */
  const [thumbUrls, setThumbUrls] = useState({});

  useEffect(() => {
    getSlicingJob(id)
      .then((res) => setJob(res.data))
      .catch(() => toast.error('Error al cargar el trabajo'))
      .finally(() => setLoading(false));
  }, [id]);

  // Cargar thumbnails de camas via axios (necesita JWT)
  useEffect(() => {
    if (!job || job.status !== 'done') return;
    const plates = job.plates_data?.length > 0
      ? job.plates_data.map((p) => p.plate_number)
      : [1];

    plates.forEach((pn) => {
      api.get(`/slicer/jobs/${job.id}/plate/${pn}/thumbnail`, { responseType: 'arraybuffer' })
        .then((res) => {
          const contentType = res.headers['content-type'] || 'image/png';
          const base64 = btoa(
            new Uint8Array(res.data).reduce((data, byte) => data + String.fromCharCode(byte), '')
          );
          const dataUri = `data:${contentType};base64,${base64}`;
          setThumbUrls((prev) => ({ ...prev, [pn]: dataUri }));
        })
        .catch(() => {/* Sin thumbnail disponible */});
    });
  }, [job]);

  const hasPlates = job?.plates_data?.length > 1;

  /**
   * Abre el modal de mapeo de filamentos, o navega directo si no hay detalle.
   * @param {Object|null} plate - Placa específica (null = total)
   */
  const goToCalc = (plate = null) => {
    const data = plate || job;

    // Filamentos: de la placa específica, o todos los de todas las placas
    let fils = plate?.filaments || [];
    if (!plate && job.plates_data?.length > 0) {
      fils = job.plates_data.flatMap((p) => p.filaments || []);
    }

    if (fils.length > 0) {
      setMapperData({ filaments: fils, printTimeSeconds: data.print_time_seconds });
    } else {
      const params = new URLSearchParams();
      if (data.filament_weight_g) params.set('weight_grams', data.filament_weight_g);
      if (data.print_time_seconds) {
        params.set('print_time_hours', (data.print_time_seconds / 3600).toFixed(4));
      }
      if (data.filament_type) params.set('filament_type', data.filament_type);
      navigate(`/cost/calculator?${params.toString()}`);
    }
  };

  /** Callback del modal: navega a la calculadora con IDs del inventario. */
  const handleMapperConfirm = ({ primaryId, primaryWeight, extras, printTimeSeconds }) => {
    setMapperData(null);
    const params = new URLSearchParams();
    params.set('inventory_item_id', primaryId);
    params.set('weight_grams', primaryWeight);
    if (printTimeSeconds) {
      params.set('print_time_hours', (printTimeSeconds / 3600).toFixed(4));
    }
    extras.forEach((e, i) => {
      params.set(`extra_id_${i + 1}`, e.inventory_item_id);
      params.set(`extra_weight_${i + 1}`, e.weight_grams);
    });
    navigate(`/cost/calculator?${params.toString()}`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 size={28} className="text-amber-400 animate-spin" />
        <p className="text-steel text-sm">Cargando datos…</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-center py-20 text-gunmetal">
        <AlertCircle size={40} className="mx-auto mb-4 opacity-30" />
        <p className="text-lg font-medium mb-2">Trabajo no encontrado</p>
        <Link to="/slicer/history" className="text-amber-400 hover:underline text-sm">
          Volver al historial
        </Link>
      </div>
    );
  }

  // Agrupar filamentos por tipo+color
  const allFilaments = (job.plates_data || []).flatMap((p) =>
    (p.filaments || []).map((f) => ({ ...f, plate: p.plate_number }))
  );
  const grouped = {};
  allFilaments.forEach((f) => {
    const key = `${f.filament_type}|${f.colour_hex}`;
    if (!grouped[key]) {
      grouped[key] = { ...f, total_weight_g: 0, plates: [] };
    }
    grouped[key].total_weight_g += f.weight_g || 0;
    if (!grouped[key].plates.includes(f.plate)) {
      grouped[key].plates.push(f.plate);
    }
  });
  const filamentGroups = Object.values(grouped);

  return (
    <div className="max-w-3xl mx-auto">
      {/* Navegación */}
      <Link
        to="/slicer/history"
        className="inline-flex items-center gap-1.5 text-steel hover:text-tech-white text-sm mb-4 transition-colors"
      >
        <ArrowLeft size={14} />
        Historial
      </Link>

      {/* Encabezado */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-tech-white">
            {job.original_filename || job.makerworld_url || `Trabajo #${job.id}`}
          </h1>
          <p className="text-gunmetal text-sm mt-1">
            {new Date(job.created_at).toLocaleDateString('es-CO', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
        {job.status === 'done' ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-emerald-400 bg-emerald-400/10">
            <CheckCircle size={12} /> Listo
          </span>
        ) : job.status === 'error' ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-red-400 bg-red-400/10">
            <AlertCircle size={12} /> Error
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-amber-400 bg-amber-400/10">
            <Clock size={12} /> Procesando
          </span>
        )}
      </div>

      {/* Error */}
      {job.status === 'error' && (
        <div className="bg-red-400/5 border border-red-400/20 rounded-xl p-4 mb-6">
          <p className="text-red-400 text-sm">{job.error_message || 'Error desconocido'}</p>
        </div>
      )}

      {/* Datos extraídos */}
      {job.status === 'done' && (
        <div className="space-y-6">
          {/* Vista de camas — sección principal */}
          <div className="bg-[#111520] border border-[#222630] rounded-xl p-6">
            <h2 className="text-steel text-xs font-medium uppercase tracking-wider mb-4">
              {hasPlates ? `${job.plates_data.length} placas` : 'Vista de cama'}
            </h2>
            <div className={`grid gap-4 ${hasPlates ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
              {(hasPlates ? job.plates_data : [{ plate_number: 1 }]).map((plate) => (
                <div
                  key={plate.plate_number}
                  className="bg-[#0A0E16] border border-[#222630] rounded-lg overflow-hidden"
                >
                  {/* Thumbnail de la cama */}
                  <div className="relative aspect-square bg-[#080a0d] flex items-center justify-center">
                    {thumbUrls[plate.plate_number] ? (
                      <img
                        src={thumbUrls[plate.plate_number]}
                        alt={`Cama placa ${plate.plate_number}`}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2 text-gunmetal">
                        <Layers size={32} className="opacity-30" />
                        <span className="text-xs">Sin vista previa</span>
                      </div>
                    )}
                    {/* Botón 3D flotante */}
                    <button
                      onClick={() => setViewerPlate(plate.plate_number)}
                      className="absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#1A1D25]/90 border border-[#2A2F38] text-steel hover:text-tech-white hover:border-[#363C47] transition-colors backdrop-blur-sm"
                      title="Vista 3D interactiva"
                    >
                      <Box size={12} />
                      3D
                    </button>
                  </div>
                  {/* Info de la placa debajo del thumbnail */}
                  <div className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {hasPlates && (
                          <span className="text-tech-white font-semibold text-sm">
                            Placa {plate.plate_number}
                          </span>
                        )}
                        {plate.filaments?.length > 0 && (
                          <div className="flex items-center gap-1">
                            {plate.filaments.map((f, i) => (
                              <div
                                key={i}
                                className="w-3 h-3 rounded-full border border-[#363C47]"
                                style={{ backgroundColor: f.colour_hex || '#888' }}
                                title={`${f.filament_type} ${f.colour_hex}`}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {plate.objects?.length > 0 && (
                      <p className="text-gunmetal text-xs truncate" title={plate.objects.join(', ')}>
                        {plate.objects.join(', ')}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-steel font-medium">
                        {formatTime(plate.print_time_seconds || job.print_time_seconds)}
                      </span>
                      <span className="text-gunmetal">·</span>
                      <span className="text-steel font-medium">
                        {(plate.filament_weight_g || job.filament_weight_g)
                          ? `${Number(plate.filament_weight_g || job.filament_weight_g).toFixed(1)} g`
                          : '—'}
                      </span>
                    </div>
                    {hasPlates && (
                      <button
                        onClick={() => goToCalc(plate)}
                        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs text-amber-400/80 hover:text-amber-400 border border-[#222630] hover:border-amber-400/30 hover:bg-amber-400/5 transition-colors"
                      >
                        <Calculator size={12} />
                        Usar placa {plate.plate_number}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totales (solo multi-placa) */}
          {hasPlates && (
            <div className="bg-[#111520] border border-[#222630] rounded-xl p-6">
              <h2 className="text-steel text-xs font-medium uppercase tracking-wider mb-4">
                Totales
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-[#0A0E16] rounded-lg p-4">
                  <p className="text-gunmetal text-xs mb-1">Tiempo de impresión</p>
                  <p className="text-tech-white font-semibold text-sm">{formatTime(job.print_time_seconds)}</p>
                </div>
                <div className="bg-[#0A0E16] rounded-lg p-4">
                  <p className="text-gunmetal text-xs mb-1">Peso de filamento</p>
                  <p className="text-tech-white font-semibold text-sm">
                    {job.filament_weight_g ? `${Number(job.filament_weight_g).toFixed(2)} g` : '—'}
                  </p>
                </div>
                <div className="bg-[#0A0E16] rounded-lg p-4">
                  <p className="text-gunmetal text-xs mb-1">Filamento</p>
                  <p className="text-tech-white font-semibold text-sm">{job.filament_type || '—'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Datos extraídos (single plate) */}
          {!hasPlates && (
            <div className="bg-[#111520] border border-[#222630] rounded-xl p-6">
              <h2 className="text-steel text-xs font-medium uppercase tracking-wider mb-4">
                Datos extraídos
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-[#0A0E16] rounded-lg p-4">
                  <p className="text-gunmetal text-xs mb-1">Tiempo de impresión</p>
                  <p className="text-tech-white font-semibold text-sm">{formatTime(job.print_time_seconds)}</p>
                </div>
                <div className="bg-[#0A0E16] rounded-lg p-4">
                  <p className="text-gunmetal text-xs mb-1">Peso de filamento</p>
                  <p className="text-tech-white font-semibold text-sm">
                    {job.filament_weight_g ? `${Number(job.filament_weight_g).toFixed(2)} g` : '—'}
                  </p>
                </div>
                <div className="bg-[#0A0E16] rounded-lg p-4">
                  <p className="text-gunmetal text-xs mb-1">Filamento</p>
                  <p className="text-tech-white font-semibold text-sm">{job.filament_type || '—'}</p>
                </div>
                {job.layer_height_mm && (
                  <div className="bg-[#0A0E16] rounded-lg p-4">
                    <p className="text-gunmetal text-xs mb-1">Altura de capa</p>
                    <p className="text-tech-white font-semibold text-sm">{job.layer_height_mm} mm</p>
                  </div>
                )}
                {job.nozzle_temp && (
                  <div className="bg-[#0A0E16] rounded-lg p-4">
                    <p className="text-gunmetal text-xs mb-1">Temp. boquilla</p>
                    <p className="text-tech-white font-semibold text-sm">{job.nozzle_temp} °C</p>
                  </div>
                )}
                {job.bed_temp && (
                  <div className="bg-[#0A0E16] rounded-lg p-4">
                    <p className="text-gunmetal text-xs mb-1">Temp. cama</p>
                    <p className="text-tech-white font-semibold text-sm">{job.bed_temp} °C</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Filamentos detectados */}
          {filamentGroups.length > 0 && (
            <div className="bg-[#111520] border border-[#222630] rounded-xl p-6">
              <h2 className="text-steel text-xs font-medium uppercase tracking-wider mb-4">
                Filamentos detectados
              </h2>
              <div className="space-y-2">
                {filamentGroups.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 bg-[#0A0E16] rounded-lg px-4 py-3">
                    <div
                      className="w-4 h-4 rounded-full border border-[#363C47] shrink-0"
                      style={{ backgroundColor: f.colour_hex || '#888' }}
                      title={f.colour_hex}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-tech-white text-sm font-medium">
                        {f.filament_type || '—'}
                      </span>
                      <span className="text-gunmetal text-xs ml-2">{f.colour_hex}</span>
                    </div>
                    <span className="text-steel text-sm font-mono">
                      {f.total_weight_g.toFixed(1)} g
                    </span>
                    <span className="text-gunmetal text-xs">
                      {f.plates.length === 1
                        ? `placa ${f.plates[0]}`
                        : `${f.plates.length} placas`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Botón principal */}
          <button
            onClick={() => goToCalc()}
            className="w-full py-3 rounded-xl bg-amber-400/15 text-amber-400 border border-amber-400/30 hover:bg-amber-400/25 transition-colors font-medium text-sm flex items-center justify-center gap-2"
          >
            <Calculator size={16} />
            {hasPlates ? 'Usar total en Calculadora' : 'Usar en Calculadora'}
          </button>
        </div>
      )}

      {/* Visor 3D de placa */}
      <GcodeViewerDialog
        open={viewerPlate !== null}
        onClose={() => setViewerPlate(null)}
        jobId={job?.id}
        plateNumber={viewerPlate}
      />

      {/* Modal de mapeo de filamentos */}
      <FilamentMapperModal
        open={!!mapperData}
        onClose={() => setMapperData(null)}
        slicerFilaments={mapperData?.filaments || []}
        printTimeSeconds={mapperData?.printTimeSeconds}
        onConfirm={handleMapperConfirm}
      />
    </div>
  );
}
