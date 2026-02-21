/**
 * @file Página de Importar / Exportar inventario.
 *
 * Permite al usuario descargar todo el inventario de la empresa en formato JSON
 * (backup) y restaurarlo/fusionarlo desde un archivo JSON exportado previamente.
 *
 * Lógica de merge en importación:
 * - inventory_items: si existe el ítem (name + category), suma la cantidad.
 * - printed_items:   si existe el ítem (name), suma la cantidad.
 * - Si no existe, crea el ítem con todos sus campos.
 *
 * @module pages/inventory/InventoryImportExportPage
 */

import { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { Download, Upload, FileJson, CheckCircle, AlertCircle } from 'lucide-react';
import { exportInventory, importInventory } from '../../services/api';

/**
 * Página de importación y exportación de inventario.
 * @returns {JSX.Element}
 */
export default function InventoryImportExportPage() {
  const fileInputRef = useRef(null);

  // Estado de la exportación
  const [exporting, setExporting] = useState(false);

  // Estado de la importación
  const [preview, setPreview] = useState(null);   // { itemCount, printCount, data }
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);     // InventoryImportResult

  // ─── Exportar ────────────────────────────────────────────────────────────

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await exportInventory();
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      const today = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `inventario_${today}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Inventario exportado correctamente');
    } catch {
      toast.error('No se pudo exportar el inventario');
    } finally {
      setExporting(false);
    }
  };

  // ─── Seleccionar archivo ─────────────────────────────────────────────────

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        const itemCount = Array.isArray(data.inventory_items)
          ? data.inventory_items.length
          : 0;
        const printCount = Array.isArray(data.printed_items)
          ? data.printed_items.length
          : 0;
        setPreview({ itemCount, printCount, data });
      } catch {
        toast.error('El archivo no es un JSON válido');
        setPreview(null);
      }
    };
    reader.readAsText(file);
    // Limpiar el input para permitir re-seleccionar el mismo archivo
    e.target.value = '';
  };

  // ─── Importar ────────────────────────────────────────────────────────────

  const handleImport = async () => {
    if (!preview) return;
    setImporting(true);
    try {
      const res = await importInventory(preview.data);
      setResult(res.data);
      setPreview(null);
      toast.success('Importación completada');
    } catch (err) {
      const msg = err.response?.data?.detail || 'No se pudo importar el inventario';
      toast.error(msg);
    } finally {
      setImporting(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-tech-white">Importar / Exportar</h1>
        <p className="text-steel text-sm mt-1">
          Haz un respaldo del inventario o restáuralo desde un archivo JSON.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">

        {/* ── Exportar ── */}
        <div className="bg-[#0d1014] border border-[#1e2125] rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Download size={22} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-tech-white font-semibold">Exportar inventario</h2>
              <p className="text-steel text-xs">Descarga todo el stock e impresiones en formato JSON</p>
            </div>
          </div>

          <p className="text-gunmetal text-sm">
            El archivo incluye todos los ítems de stock (filamentos, insumos, etc.) y los
            ítems del catálogo de impresiones. No incluye imágenes ni contraseñas.
          </p>

          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg font-medium transition-colors"
          >
            <Download size={16} />
            {exporting ? 'Exportando…' : 'Descargar inventario (.json)'}
          </button>
        </div>

        {/* ── Importar ── */}
        <div className="bg-[#0d1014] border border-[#1e2125] rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <Upload size={22} className="text-green-400" />
            </div>
            <div>
              <h2 className="text-tech-white font-semibold">Importar inventario</h2>
              <p className="text-steel text-xs">Fusiona un JSON exportado con el inventario actual</p>
            </div>
          </div>

          <p className="text-gunmetal text-sm">
            Si un ítem ya existe (mismo nombre y categoría), se <strong className="text-steel">suma</strong> la
            cantidad. Si no existe, se crea. La importación es acumulativa y no elimina datos.
          </p>

          {/* Input oculto */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Botón seleccionar archivo */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-[#2a2d31] hover:border-[#3a3d41] text-steel hover:text-tech-white rounded-lg font-medium transition-colors"
          >
            <FileJson size={16} />
            Seleccionar archivo .json
          </button>

          {/* Preview del archivo seleccionado */}
          {preview && (
            <div className="bg-[#1a1d21] border border-[#2a2d31] rounded-lg p-3 space-y-3">
              <p className="text-sm text-steel">
                <span className="text-tech-white font-medium">{preview.itemCount}</span> ítems de stock
                {' · '}
                <span className="text-tech-white font-medium">{preview.printCount}</span> impresiones en el archivo
              </p>
              <button
                onClick={handleImport}
                disabled={importing}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-700 hover:bg-green-600 disabled:opacity-60 text-white rounded-lg font-medium transition-colors"
              >
                <Upload size={16} />
                {importing ? 'Importando…' : 'Importar'}
              </button>
            </div>
          )}

          {/* Resultado de la importación */}
          {result && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 space-y-1">
              <div className="flex items-center gap-2 text-green-400 font-medium text-sm mb-2">
                <CheckCircle size={16} />
                Importación completada
              </div>
              <p className="text-steel text-sm">
                Stock: <span className="text-tech-white">{result.items_created}</span> creados,{' '}
                <span className="text-tech-white">{result.items_merged}</span> fusionados
              </p>
              <p className="text-steel text-sm">
                Impresiones: <span className="text-tech-white">{result.prints_created}</span> creadas,{' '}
                <span className="text-tech-white">{result.prints_merged}</span> fusionadas
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Nota informativa */}
      <div className="flex items-start gap-3 bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
        <AlertCircle size={18} className="text-amber-400 mt-0.5 shrink-0" />
        <p className="text-sm text-steel">
          <strong className="text-amber-400">Nota:</strong> La importación es acumulativa.
          Si importas el mismo archivo varias veces, las cantidades se sumarán cada vez.
          Para restaurar desde un estado limpio, elimina el stock existente antes de importar.
        </p>
      </div>
    </div>
  );
}
