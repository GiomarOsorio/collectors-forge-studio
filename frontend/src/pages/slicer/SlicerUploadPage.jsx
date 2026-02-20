/**
 * @file Página principal del Slicer: subir archivos o URL de MakerWorld.
 *
 * Presenta tres flujos de entrada:
 * 1. Archivo ya laminado (.gcode / .3mf) — parsea metadatos inmediatamente.
 * 2. Modelo STL — se envía al contenedor OrcaSlicer para laminar en background.
 * 3. URL de MakerWorld — extrae estimados del perfil de impresión del modelo.
 *
 * Tras el procesamiento muestra los metadatos extraídos y un botón para
 * pre-llenar la Calculadora de Costos vía URL params.
 *
 * @module pages/slicer/SlicerUploadPage
 */

import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, Link, FileCode, CheckCircle, AlertCircle,
  Clock, Loader, Box,
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

/** Definición de las pestañas de entrada. */
const TABS = [
  {
    id: 'gcode',
    label: 'Archivo laminado',
    icon: FileCode,
    description: '.gcode o .3mf ya procesado',
  },
  {
    id: 'stl',
    label: 'Modelo STL',
    icon: Box,
    description: 'Laminar con OrcaSlicer',
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
export default function SlicerUploadPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('gcode');
  const [loading, setLoading] = useState(false);
  /** @type {[Object|null, Function]} Resultado del trabajo de laminado */
  const [result, setResult] = useState(null);
  const [makerworldUrl, setMakerworldUrl] = useState('');
  const gcodeInputRef = useRef(null);
  const stlInputRef = useRef(null);

  /** Sube un archivo .gcode o .3mf y obtiene los metadatos. */
  const handleGcodeUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post('/slicer/upload-gcode', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data);
      if (res.data.status === 'done') {
        toast.success('Archivo procesado correctamente');
      } else {
        toast.error('No se pudieron extraer datos del archivo');
      }
    } catch {
      toast.error('Error al subir el archivo');
    } finally {
      setLoading(false);
      // Limpiar input para permitir subir el mismo archivo de nuevo
      if (gcodeInputRef.current) gcodeInputRef.current.value = '';
    }
  };

  /** Sube un archivo STL al laminador OrcaSlicer (proceso en background). */
  const handleStlUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post('/slicer/upload-stl', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data);
      toast.success('STL enviado al laminador. Revisa el Historial para ver el resultado.');
    } catch {
      toast.error('Error al subir el STL');
    } finally {
      setLoading(false);
      if (stlInputRef.current) stlInputRef.current.value = '';
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

  /** Navega a la calculadora pre-llenando los campos con los datos extraídos. */
  const handleUseInCalculator = () => {
    if (!result) return;
    const params = new URLSearchParams();
    if (result.filament_weight_g) params.set('weight_grams', result.filament_weight_g);
    if (result.print_time_seconds) {
      params.set('print_time_hours', (result.print_time_seconds / 3600).toFixed(4));
    }
    if (result.filament_type) params.set('filament_type', result.filament_type);
    navigate(`/cost/calculator?${params.toString()}`);
  };

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setResult(null);
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
                  : 'bg-[#13171c] text-steel border border-[#1e2125] hover:text-tech-white'
              }`}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Panel de contenido de la pestaña activa */}
      <div className="bg-[#13171c] border border-[#1e2125] rounded-xl p-6">

        {/* Pestaña: Gcode / 3MF */}
        {activeTab === 'gcode' && (
          <div>
            <h2 className="text-tech-white font-semibold mb-1">Archivo ya laminado</h2>
            <p className="text-gunmetal text-sm mb-6">
              Sube un archivo{' '}
              <code className="text-amber-400 bg-amber-400/10 px-1 rounded">.gcode</code>{' '}
              o{' '}
              <code className="text-amber-400 bg-amber-400/10 px-1 rounded">.3mf</code>{' '}
              generado por Bambu Studio u OrcaSlicer.
              Se extraerán tiempo de impresión, peso y tipo de filamento.
            </p>
            <input
              ref={gcodeInputRef}
              type="file"
              accept=".gcode,.3mf"
              className="hidden"
              onChange={handleGcodeUpload}
            />
            <button
              onClick={() => gcodeInputRef.current?.click()}
              disabled={loading}
              className="w-full border-2 border-dashed border-[#2a2d31] rounded-xl p-12 text-center hover:border-amber-400/40 hover:bg-amber-400/5 transition-all group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader size={36} className="mx-auto mb-3 text-amber-400 animate-spin" />
              ) : (
                <FileCode size={36} className="mx-auto mb-3 text-gunmetal group-hover:text-amber-400 transition-colors" />
              )}
              <p className="text-steel group-hover:text-tech-white transition-colors font-medium text-sm">
                {loading ? 'Procesando...' : 'Haz clic para seleccionar el archivo'}
              </p>
              <p className="text-gunmetal text-xs mt-1">Máximo 250 MB</p>
            </button>
          </div>
        )}

        {/* Pestaña: STL */}
        {activeTab === 'stl' && (
          <div>
            <h2 className="text-tech-white font-semibold mb-1">Modelo STL</h2>
            <p className="text-gunmetal text-sm mb-6">
              Sube un archivo{' '}
              <code className="text-amber-400 bg-amber-400/10 px-1 rounded">.stl</code>{' '}
              para laminarlo automáticamente con OrcaSlicer usando el perfil de la BambuLab P2S.
              El proceso se ejecuta en background — revisa el{' '}
              <a href="/slicer/history" className="text-amber-400 hover:underline">Historial</a>{' '}
              para ver el resultado.
            </p>
            <input
              ref={stlInputRef}
              type="file"
              accept=".stl"
              className="hidden"
              onChange={handleStlUpload}
            />
            <button
              onClick={() => stlInputRef.current?.click()}
              disabled={loading}
              className="w-full border-2 border-dashed border-[#2a2d31] rounded-xl p-12 text-center hover:border-amber-400/40 hover:bg-amber-400/5 transition-all group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader size={36} className="mx-auto mb-3 text-amber-400 animate-spin" />
              ) : (
                <Upload size={36} className="mx-auto mb-3 text-gunmetal group-hover:text-amber-400 transition-colors" />
              )}
              <p className="text-steel group-hover:text-tech-white transition-colors font-medium text-sm">
                {loading ? 'Enviando al laminador...' : 'Haz clic para seleccionar el archivo .stl'}
              </p>
              <p className="text-gunmetal text-xs mt-2 leading-relaxed">
                Perfil: Bambu Lab P2S · 0.4 mm · PLA
              </p>
            </button>
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
                  className="w-full bg-[#0d1014] border border-[#2a2d31] rounded-lg px-4 py-3 text-tech-white text-sm focus:outline-none focus:border-amber-400/50 placeholder-gunmetal"
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
        <div className="mt-6 bg-[#13171c] border border-[#1e2125] rounded-xl p-6">
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                <div className="bg-[#0d1014] rounded-lg p-4">
                  <p className="text-gunmetal text-xs mb-1">Tiempo de impresión</p>
                  <p className="text-tech-white font-semibold text-sm">{formatTime(result.print_time_seconds)}</p>
                </div>
                <div className="bg-[#0d1014] rounded-lg p-4">
                  <p className="text-gunmetal text-xs mb-1">Peso de filamento</p>
                  <p className="text-tech-white font-semibold text-sm">
                    {result.filament_weight_g
                      ? `${Number(result.filament_weight_g).toFixed(2)} g`
                      : '—'}
                  </p>
                </div>
                <div className="bg-[#0d1014] rounded-lg p-4">
                  <p className="text-gunmetal text-xs mb-1">Tipo de filamento</p>
                  <p className="text-tech-white font-semibold text-sm">{result.filament_type || '—'}</p>
                </div>
                {result.layer_height_mm && (
                  <div className="bg-[#0d1014] rounded-lg p-4">
                    <p className="text-gunmetal text-xs mb-1">Altura de capa</p>
                    <p className="text-tech-white font-semibold text-sm">{result.layer_height_mm} mm</p>
                  </div>
                )}
                {result.nozzle_temp && (
                  <div className="bg-[#0d1014] rounded-lg p-4">
                    <p className="text-gunmetal text-xs mb-1">Temp. boquilla</p>
                    <p className="text-tech-white font-semibold text-sm">{result.nozzle_temp} °C</p>
                  </div>
                )}
                {result.bed_temp && (
                  <div className="bg-[#0d1014] rounded-lg p-4">
                    <p className="text-gunmetal text-xs mb-1">Temp. cama</p>
                    <p className="text-tech-white font-semibold text-sm">{result.bed_temp} °C</p>
                  </div>
                )}
              </div>

              <button
                onClick={handleUseInCalculator}
                className="w-full py-3 rounded-lg bg-amber-400/15 text-amber-400 border border-amber-400/30 hover:bg-amber-400/25 transition-colors font-medium text-sm"
              >
                Usar en Calculadora →
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
    </div>
  );
}
