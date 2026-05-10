/**
 * @file Página principal del Slicer: subir archivos o URL de MakerWorld.
 *
 * Un solo dropzone acepta todos los formatos compatibles con OrcaSlicer.
 * El formato se detecta por extensión y se enruta automáticamente:
 * - .gcode / .3mf (laminado) → parseo inmediato de metadatos.
 * - .stl / .step / .stp / .obj / .amf → laminado con OrcaSlicer en background.
 *
 * @module pages/slicer/SlicerUploadPage
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, Link, FileCode, CheckCircle, AlertCircle,
  Clock, Loader, Box, Layers, ArrowRight,
} from 'lucide-react';
import api, { getSlicingJob } from '../../services/api';
import toast from 'react-hot-toast';
import FilamentMapperModal from '../../components/slicer/FilamentMapperModal';
import GcodeViewerDialog from '../../components/slicer/GcodeViewerDialog';

/** Presets de filamento de OrcaSlicer para la BambuLab P2S. */
const FILAMENT_PRESETS = [
  { label: 'PLA',     value: 'Bambu PLA Basic @BBL P2S' },
  { label: 'PETG',    value: 'Bambu PETG Basic @BBL P2S' },
  { label: 'ABS',     value: 'Bambu ABS @BBL P2S' },
  { label: 'ASA',     value: 'Bambu ASA @BBL P2S' },
  { label: 'TPU',     value: 'Bambu TPU 95A @BBL P2S' },
  { label: 'PLA-CF',  value: 'Bambu PLA-CF @BBL P2S' },
  { label: 'PETG-CF', value: 'Bambu PETG-CF @BBL P2S' },
];

/** Configuraciones por tamaño de boquilla para la BambuLab P2S. */
const NOZZLE_CONFIGS = {
  '0.4': {
    printerPreset: 'Bambu Lab P2S 0.4 nozzle',
    qualities: [
      { label: 'Fino (0.12mm)',          value: '0.12mm Fine @BBL P2S' },
      { label: 'Óptimo (0.16mm)',        value: '0.16mm Optimal @BBL P2S' },
      { label: 'Estándar (0.20mm)',      value: '0.20mm Standard @BBL P2S' },
      { label: 'Borrador (0.24mm)',      value: '0.24mm Draft @BBL P2S' },
      { label: 'Extra borrador (0.28mm)',value: '0.28mm Extra Draft @BBL P2S' },
    ],
    defaultQuality: '0.20mm Standard @BBL P2S',
  },
  '0.2': {
    printerPreset: 'Bambu Lab P2S 0.2 nozzle',
    qualities: [
      { label: 'Extra fino (0.08mm)', value: '0.08mm Extra Fine @BBL P2S' },
      { label: 'Fino (0.12mm)',       value: '0.12mm Fine @BBL P2S' },
      { label: 'Estándar (0.15mm)',   value: '0.15mm Standard @BBL P2S' },
    ],
    defaultQuality: '0.12mm Fine @BBL P2S',
  },
  '0.6': {
    printerPreset: 'Bambu Lab P2S 0.6 nozzle',
    qualities: [
      { label: 'Fino (0.20mm)',     value: '0.20mm Fine @BBL P2S' },
      { label: 'Estándar (0.30mm)',value: '0.30mm Standard @BBL P2S' },
      { label: 'Borrador (0.45mm)',value: '0.45mm Draft @BBL P2S' },
    ],
    defaultQuality: '0.30mm Standard @BBL P2S',
  },
  '0.8': {
    printerPreset: 'Bambu Lab P2S 0.8 nozzle',
    qualities: [
      { label: 'Fino (0.30mm)',     value: '0.30mm Fine @BBL P2S' },
      { label: 'Estándar (0.40mm)',value: '0.40mm Standard @BBL P2S' },
      { label: 'Borrador (0.60mm)',value: '0.60mm Draft @BBL P2S' },
    ],
    defaultQuality: '0.40mm Standard @BBL P2S',
  },
};

/** Extensiones que requieren laminado con OrcaSlicer. */
const SLICEABLE_EXTS = new Set(['.3mf', '.stl', '.step', '.stp', '.obj', '.amf']);

/** Todas las extensiones aceptadas (para el atributo accept del input). */
const ACCEPTED_EXTS = '.gcode,.gcode.3mf,.3mf,.stl,.step,.stp,.obj,.amf';

/** Definición de las pestañas de entrada. */
const TABS = [
  {
    id: 'file',
    label: 'Subir archivo',
    icon: Upload,
    description: 'Todos los formatos soportados',
  },
  {
    id: 'makerworld',
    label: 'MakerWorld',
    icon: Link,
    description: 'URL de modelo',
  },
];

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
 * Página de subida del Slicer.
 *
 * @returns {JSX.Element}
 */
/**
 * Formatea bytes en una cadena legible (KB / MB).
 *
 * @param {number} bytes
 * @returns {string}
 */
function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SlicerUploadPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('file');
  const [loading, setLoading] = useState(false);
  const [filamentPreset, setFilamentPreset] = useState(FILAMENT_PRESETS[0].value);
  const [nozzleSize, setNozzleSize] = useState('0.4');
  const [configPreset, setConfigPreset] = useState(NOZZLE_CONFIGS['0.4'].defaultQuality);

  const handleNozzleChange = (size) => {
    setNozzleSize(size);
    setConfigPreset(NOZZLE_CONFIGS[size].defaultQuality);
  };
  /** @type {[Object|null, Function]} Resultado del trabajo de laminado */
  const [result, setResult] = useState(null);
  const [makerworldUrl, setMakerworldUrl] = useState('');
  /** Archivo seleccionado pero aún no enviado. */
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);
  const pollingRef = useRef(null);
  /** Datos para el modal de mapeo de filamentos (null = cerrado). */
  const [mapperData, setMapperData] = useState(null);
  /** Placa a visualizar en 3D (null = cerrado). */
  const [viewerPlate, setViewerPlate] = useState(null);

  /** Extensión del archivo seleccionado (en minúsculas, con punto). */
  const fileExt = selectedFile
    ? selectedFile.name.slice(selectedFile.name.lastIndexOf('.')).toLowerCase()
    : null;

  /** True si el archivo es .gcode.3mf (ya laminado por BambuStudio). */
  const isGcode3mf = selectedFile
    ? selectedFile.name.toLowerCase().endsWith('.gcode.3mf')
    : false;

  /** True si el archivo seleccionado requiere laminado con OrcaSlicer. */
  const needsSlicing = fileExt !== null && SLICEABLE_EXTS.has(fileExt) && !isGcode3mf;

  /** Detiene el polling activo si existe. */
  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  // Limpia el polling al desmontar el componente
  useEffect(() => () => stopPolling(), []);

  /** Guarda el archivo seleccionado sin enviarlo aún. */
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /** Envía el archivo al endpoint correcto según su extensión. */
  const handleFileSubmit = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append('file', selectedFile);
      let res;

      if (needsSlicing) {
        const params = new URLSearchParams({
          printer_preset: NOZZLE_CONFIGS[nozzleSize].printerPreset,
          filament_preset: filamentPreset,
          config_preset: configPreset,
        });
        res = await api.post(`/slicer/upload-stl?${params}`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        res = await api.post('/slicer/upload-gcode', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      setSelectedFile(null);
      setResult(res.data);

      if (res.data.status === 'pending' || res.data.status === 'slicing') {
        const jobId = res.data.id;
        toast('Laminando en background. Actualizando automáticamente...', { icon: '⏳' });
        pollingRef.current = setInterval(async () => {
          try {
            const poll = await getSlicingJob(jobId);
            setResult(poll.data);
            if (poll.data.status === 'done') {
              stopPolling();
              toast.success('Laminado completado');
            } else if (poll.data.status === 'error') {
              stopPolling();
              toast.error('Error al laminar');
            }
          } catch {
            stopPolling();
          }
        }, 5000);
      } else if (res.data.status === 'done') {
        toast.success('Archivo procesado correctamente');
      } else if (res.data.status === 'error') {
        toast.error('No se pudieron extraer datos del archivo');
      }
    } catch {
      toast.error('Error al subir el archivo');
    } finally {
      setLoading(false);
    }
  };

  /** Consulta MakerWorld por URL para extraer datos de impresión. */
  const handleMakerworld = async (e) => {
    e.preventDefault();
    if (!makerworldUrl.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await api.post('/slicer/makerworld', { url: makerworldUrl.trim() });
      setResult(res.data);
      if (res.data.status === 'done') {
        toast.success('Datos extraídos de MakerWorld');
      } else {
        toast.error('No se pudieron extraer datos de esa URL');
      }
    } catch {
      toast.error('Error al consultar MakerWorld');
    } finally {
      setLoading(false);
    }
  };

  /** True si la respuesta tiene desglose multi-placa. */
  const hasPlates = result?.plates_data?.length > 1;

  /**
   * Navega a la calculadora pre-llenando los campos.
   * Si se pasa una placa específica, usa sus datos; si no, usa los totales.
   */
  const handleUseInCalculator = (plate = null) => {
    if (!result) return;
    const data = plate || result;

    // Filamentos: de la placa específica, o todos los de todas las placas
    let fils = plate?.filaments || [];
    if (!plate && result.plates_data?.length > 0) {
      fils = result.plates_data.flatMap((p) => p.filaments || []);
    }

    // Cambios de color: por placa o suma de todas las placas
    const colorChanges = plate
      ? plate.color_changes || 0
      : (result.plates_data || []).reduce((acc, p) => acc + (p.color_changes || 0), 0);

    if (fils.length > 0) {
      setMapperData({
        filaments: fils,
        printTimeSeconds: data.print_time_seconds,
        colorChanges,
      });
    } else {
      const params = new URLSearchParams();
      if (data.filament_weight_g) params.set('weight_grams', data.filament_weight_g);
      if (data.print_time_seconds) {
        params.set('print_time_hours', (data.print_time_seconds / 3600).toFixed(4));
      }
      if (data.filament_type) params.set('filament_type', data.filament_type);
      if (colorChanges > 0) params.set('color_changes', colorChanges);
      navigate(`/cost/calculator?${params.toString()}`);
    }
  };

  /** Callback del modal: navega a la calculadora con IDs del inventario. */
  const handleMapperConfirm = ({ primaryId, primaryWeight, extras, printTimeSeconds, colorChanges }) => {
    setMapperData(null);
    const params = new URLSearchParams();
    params.set('inventory_item_id', primaryId);
    params.set('weight_grams', primaryWeight);
    if (printTimeSeconds) {
      params.set('print_time_hours', (printTimeSeconds / 3600).toFixed(4));
    }
    if (colorChanges > 0) params.set('color_changes', colorChanges);
    extras.forEach((e, i) => {
      params.set(`extra_id_${i + 1}`, e.inventory_item_id);
      params.set(`extra_weight_${i + 1}`, e.weight_grams);
    });
    navigate(`/cost/calculator?${params.toString()}`);
  };

  const handleTabChange = (tabId) => {
    stopPolling();
    setActiveTab(tabId);
    setResult(null);
    setSelectedFile(null);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-tech-white mb-2">Subir modelo</h1>
      <p className="text-steel text-sm mb-8">
        Extrae datos de laminado para pre-llenar la calculadora de costos automáticamente.
      </p>

      {/* Pestañas */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-amber-400/15 text-amber-400 border border-amber-400/30'
                  : 'bg-[#111520] text-steel border border-[#222630] hover:text-tech-white'
              }`}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Panel de contenido de la pestaña activa */}
      <div className="bg-[#111520] border border-[#222630] rounded-xl p-6">

        {/* Pestaña: Archivo único */}
        {activeTab === 'file' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-tech-white font-semibold mb-1">Subir archivo</h2>
              <p className="text-gunmetal text-sm">
                <code className="text-amber-400 bg-amber-400/10 px-1 rounded">.gcode</code>{' '}
                <code className="text-amber-400 bg-amber-400/10 px-1 rounded">.gcode.3mf</code>{' '}
                extrae metadatos · el resto se lamina con OrcaSlicer:{' '}
                {['.3mf', '.stl', '.step', '.stp', '.obj', '.amf'].map((ext) => (
                  <code key={ext} className="text-amber-400 bg-amber-400/10 px-1 rounded mx-0.5">{ext}</code>
                ))}
              </p>
            </div>

            {/* Configuración de laminado — oculta para .gcode y .gcode.3mf (ya laminados) */}
            {(needsSlicing || !selectedFile) && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gunmetal font-medium mb-1">Boquilla</label>
                  <div className="flex gap-1">
                    {Object.keys(NOZZLE_CONFIGS).map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => handleNozzleChange(size)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                          nozzleSize === size
                            ? 'bg-amber-400/20 text-amber-400 border-amber-400/40'
                            : 'text-steel border-[#2A2F38] hover:border-amber-400/30'
                        }`}
                      >
                        {size}mm
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gunmetal font-medium mb-1">Material</label>
                  <select
                    value={filamentPreset}
                    onChange={(e) => setFilamentPreset(e.target.value)}
                    className="tf-input text-sm py-1.5"
                  >
                    {FILAMENT_PRESETS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gunmetal font-medium mb-1">Calidad</label>
                  <select
                    value={configPreset}
                    onChange={(e) => setConfigPreset(e.target.value)}
                    className="tf-input text-sm py-1.5"
                  >
                    {NOZZLE_CONFIGS[nozzleSize].qualities.map((q) => (
                      <option key={q.value} value={q.value}>{q.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTS}
              className="hidden"
              onChange={handleFileSelect}
            />

            {/* Sin archivo seleccionado: dropzone */}
            {!selectedFile ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="w-full border-2 border-dashed border-[#2A2F38] rounded-xl p-10 text-center hover:border-amber-400/40 hover:bg-amber-400/5 transition-all group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload size={36} className="mx-auto mb-3 text-gunmetal group-hover:text-amber-400 transition-colors" />
                <p className="text-steel group-hover:text-tech-white transition-colors font-medium text-sm">
                  Haz clic para seleccionar el archivo
                </p>
                <p className="text-gunmetal text-xs mt-1">Máximo 250 MB</p>
              </button>
            ) : (
              <div className="space-y-3">
                {/* Info del archivo */}
                <div className="flex items-center gap-3 bg-[#0A0E16] border border-[#2A2F38] rounded-xl px-4 py-3">
                  {needsSlicing
                    ? <Box size={22} className="text-amber-400 shrink-0" />
                    : <FileCode size={22} className="text-amber-400 shrink-0" />
                  }
                  <div className="min-w-0 flex-1">
                    <p className="text-tech-white text-sm font-medium truncate">{selectedFile.name}</p>
                    <p className="text-gunmetal text-xs">
                      {formatFileSize(selectedFile.size)}
                      {' · '}
                      {needsSlicing ? 'Se laminará con OrcaSlicer' : 'Se extraerán metadatos'}
                    </p>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-steel hover:text-tech-white transition-colors shrink-0"
                  >
                    Cambiar
                  </button>
                </div>
                {/* Botón Enviar */}
                <button
                  onClick={handleFileSubmit}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-400/15 text-amber-400 border border-amber-400/30 hover:bg-amber-400/25 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <><Loader size={16} className="animate-spin" /> {needsSlicing ? 'Enviando al laminador...' : 'Procesando...'}</>
                  ) : (
                    <><Upload size={16} /> {needsSlicing ? 'Enviar al laminador' : 'Enviar'}</>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Pestaña: MakerWorld */}
        {activeTab === 'makerworld' && (
          <div>
            <h2 className="text-tech-white font-semibold mb-1">URL de MakerWorld</h2>
            <p className="text-gunmetal text-sm mb-6">
              Pega la URL de un modelo en MakerWorld para obtener un estimado de
              tiempo de impresión y peso de filamento del primer perfil disponible.
            </p>
            <form onSubmit={handleMakerworld} className="space-y-4">
              <div>
                <label className="block text-sm text-steel mb-2">URL del modelo</label>
                <input
                  type="url"
                  value={makerworldUrl}
                  onChange={(e) => setMakerworldUrl(e.target.value)}
                  placeholder="https://makerworld.com/en/models/12345"
                  className="w-full bg-[#0A0E16] border border-[#2A2F38] rounded-lg px-4 py-3 text-tech-white text-sm focus:outline-none focus:border-amber-400/50 placeholder-gunmetal"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !makerworldUrl.trim()}
                className="w-full py-3 rounded-lg bg-amber-400/15 text-amber-400 border border-amber-400/30 hover:bg-amber-400/25 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader size={16} className="animate-spin" />
                ) : (
                  <Link size={16} />
                )}
                {loading ? 'Consultando MakerWorld...' : 'Obtener datos de impresión'}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Panel de resultados */}
      {result && (
        <div className="mt-6 bg-[#111520] border border-[#222630] rounded-xl p-6">
          {/* Encabezado del resultado */}
          <div className="flex items-center gap-3 mb-5">
            {result.status === 'done' ? (
              <CheckCircle size={20} className="text-emerald-400 shrink-0" />
            ) : result.status === 'pending' || result.status === 'slicing' ? (
              <Clock size={20} className="text-amber-400 shrink-0" />
            ) : (
              <AlertCircle size={20} className="text-red-400 shrink-0" />
            )}
            <h3 className="text-tech-white font-semibold">
              {result.status === 'done'
                ? 'Datos extraídos correctamente'
                : result.status === 'error'
                ? 'Error al procesar el archivo'
                : 'Procesando en background...'}
            </h3>
          </div>

          {/* Metadatos extraídos */}
          {result.status === 'done' && (
            <>
              {/* Totales generales */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                <div className="bg-[#0A0E16] rounded-lg p-4">
                  <p className="text-gunmetal text-xs mb-1">Tiempo total</p>
                  <p className="text-tech-white font-semibold text-sm">{formatTime(result.print_time_seconds)}</p>
                </div>
                <div className="bg-[#0A0E16] rounded-lg p-4">
                  <p className="text-gunmetal text-xs mb-1">Peso total</p>
                  <p className="text-tech-white font-semibold text-sm">
                    {result.filament_weight_g
                      ? `${Number(result.filament_weight_g).toFixed(2)} g`
                      : '—'}
                  </p>
                </div>
                <div className="bg-[#0A0E16] rounded-lg p-4">
                  <p className="text-gunmetal text-xs mb-1">Filamento</p>
                  <p className="text-tech-white font-semibold text-sm">{result.filament_type || '—'}</p>
                </div>
                {result.layer_height_mm && (
                  <div className="bg-[#0A0E16] rounded-lg p-4">
                    <p className="text-gunmetal text-xs mb-1">Altura de capa</p>
                    <p className="text-tech-white font-semibold text-sm">{result.layer_height_mm} mm</p>
                  </div>
                )}
                {result.nozzle_temp && (
                  <div className="bg-[#0A0E16] rounded-lg p-4">
                    <p className="text-gunmetal text-xs mb-1">Temp. boquilla</p>
                    <p className="text-tech-white font-semibold text-sm">{result.nozzle_temp} °C</p>
                  </div>
                )}
                {result.bed_temp && (
                  <div className="bg-[#0A0E16] rounded-lg p-4">
                    <p className="text-gunmetal text-xs mb-1">Temp. cama</p>
                    <p className="text-tech-white font-semibold text-sm">{result.bed_temp} °C</p>
                  </div>
                )}
              </div>

              {/* Desglose multi-placa */}
              {hasPlates && (
                <div className="mb-6 space-y-4">
                  {/* Filamentos detectados */}
                  {(() => {
                    const allFilaments = result.plates_data.flatMap((p) =>
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
                    const filaments = Object.values(grouped);
                    if (filaments.length === 0) return null;

                    return (
                      <div>
                        <h4 className="text-steel text-xs font-medium uppercase tracking-wider mb-3">
                          Filamentos detectados
                        </h4>
                        <div className="space-y-2">
                          {filaments.map((f, i) => (
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
                    );
                  })()}

                  {/* Cards por placa */}
                  <div>
                    <h4 className="text-steel text-xs font-medium uppercase tracking-wider mb-3">
                      {result.plates_data.length} placas encontradas
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {result.plates_data.map((plate) => (
                        <div
                          key={plate.plate_number}
                          className="bg-[#0A0E16] border border-[#222630] rounded-lg p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Layers size={14} className="text-amber-400" />
                              <span className="text-tech-white font-semibold text-sm">
                                Placa {plate.plate_number}
                              </span>
                            </div>
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

                          {/* Objetos de la placa */}
                          {plate.objects?.length > 0 && (
                            <p className="text-gunmetal text-xs truncate" title={plate.objects.join(', ')}>
                              {plate.objects.join(', ')}
                            </p>
                          )}

                          {/* Datos de la placa */}
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-gunmetal">Tiempo</span>
                              <p className="text-steel font-medium">{formatTime(plate.print_time_seconds)}</p>
                            </div>
                            <div>
                              <span className="text-gunmetal">Peso</span>
                              <p className="text-steel font-medium">
                                {plate.filament_weight_g
                                  ? `${Number(plate.filament_weight_g).toFixed(1)} g`
                                  : '—'}
                              </p>
                            </div>
                            {plate.filaments?.length > 0 && plate.filaments.map((f, i) => (
                              <div key={i} className="col-span-2 flex items-center gap-2">
                                <div
                                  className="w-2.5 h-2.5 rounded-full border border-[#363C47]"
                                  style={{ backgroundColor: f.colour_hex || '#888' }}
                                />
                                <span className="text-gunmetal">
                                  {f.filament_type} — {f.weight_g?.toFixed(1) || '?'} g
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Botón usar placa en calculadora */}
                          <div className="flex gap-2">
                            {result?.id && (
                              <button
                                onClick={() => setViewerPlate(plate.plate_number)}
                                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs text-steel hover:text-tech-white border border-[#222630] hover:border-[#363C47] hover:bg-[#1A1D25] transition-colors"
                                title="Vista 3D"
                              >
                                3D
                              </button>
                            )}
                            <button
                              onClick={() => handleUseInCalculator(plate)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs text-amber-400/80 hover:text-amber-400 border border-[#222630] hover:border-amber-400/30 hover:bg-amber-400/5 transition-colors"
                            >
                              Usar placa {plate.plate_number} <ArrowRight size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Botón total */}
              <button
                onClick={() => handleUseInCalculator()}
                className="w-full py-3 rounded-lg bg-amber-400/15 text-amber-400 border border-amber-400/30 hover:bg-amber-400/25 transition-colors font-medium text-sm"
              >
                {hasPlates ? 'Usar total en Calculadora →' : 'Usar en Calculadora →'}
              </button>
            </>
          )}

          {/* Estado de error */}
          {result.status === 'error' && (
            <p className="text-red-400 text-sm">
              {result.error_message || 'No se pudieron extraer datos del archivo.'}
            </p>
          )}

          {/* Estado de procesamiento (STL en OrcaSlicer) */}
          {(result.status === 'pending' || result.status === 'slicing') && (
            <div className="text-center py-4">
              <Loader size={24} className="mx-auto mb-3 text-amber-400 animate-spin" />
              <p className="text-steel text-sm">
                El STL está siendo laminado por OrcaSlicer.{' '}
                <a href="/slicer/history" className="text-amber-400 hover:underline">
                  Ve al Historial
                </a>{' '}
                para ver el resultado cuando esté listo.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Visor 3D de placa */}
      <GcodeViewerDialog
        open={viewerPlate !== null}
        onClose={() => setViewerPlate(null)}
        jobId={result?.id}
        plateNumber={viewerPlate}
      />

      {/* Modal de mapeo de filamentos */}
      <FilamentMapperModal
        open={!!mapperData}
        onClose={() => setMapperData(null)}
        slicerFilaments={mapperData?.filaments || []}
        printTimeSeconds={mapperData?.printTimeSeconds}
        colorChanges={mapperData?.colorChanges || 0}
        onConfirm={handleMapperConfirm}
      />
    </div>
  );
}
