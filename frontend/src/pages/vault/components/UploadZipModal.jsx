/**
 * @file Modal "Subir ZIP" (issue #127) — sube un `.zip` y extrae su
 * contenido al Vault, replicando la estructura de subcarpetas.
 *
 * `tf-modal-overlay`/`tf-modal` — mismo patrón que `AssignToProjectModal`/
 * `MakerWorldImportModal`, sin `<form>` propio.
 *
 * @module pages/vault/components/UploadZipModal
 */

import { useState } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadVaultZip } from '../../../services/api';
import { apiErrorMsg } from '../../../utils/apiError';

/**
 * @param {Object} props
 * @param {number|null} props.currentFolderId - Carpeta actual del Vault (destino por default).
 * @param {() => void} props.onClose
 * @param {() => void} props.onImported - Recarga la lista + árbol de carpetas.
 */
export default function UploadZipModal({ currentFolderId, onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [createFolder, setCreateFolder] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const submit = async () => {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    try {
      const res = await uploadVaultZip(
        file,
        { folderId: currentFolderId, createFolder },
        (evt) => {
          if (evt.total) setProgress(Math.round((evt.loaded / evt.total) * 100));
        },
      );
      const { files_created, skipped_entries, folders_created } = res.data;
      toast.success(
        `${files_created} archivo(s) importado(s)`
        + (folders_created ? `, ${folders_created} carpeta(s) creada(s)` : '')
        + (skipped_entries ? `. ${skipped_entries} entrada(s) ignorada(s)` : ''),
      );
      onImported();
    } catch (err) {
      toast.error(apiErrorMsg(err, 'No se pudo importar el ZIP'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="tf-modal-overlay" style={{ zIndex: 9999 }}>
      <div className="tf-modal max-w-md">
        <div className="flex items-center justify-between mb-4">
          <p className="text-tech-white text-sm font-semibold">Subir ZIP</p>
          <button type="button" onClick={onClose} className="text-gunmetal-dim hover:text-tech-white">
            <X size={16} />
          </button>
        </div>

        <p className="text-xs text-gunmetal mb-3">
          Se procesan solo archivos <span className="mono">.3mf</span>, <span className="mono">.stl</span> y{' '}
          <span className="mono">.gcode.3mf</span> dentro del ZIP — el resto se ignora. La estructura de
          subcarpetas se replica como carpetas del Vault.
        </p>

        <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-[var(--color-border-strong)] rounded-md py-6 mb-3 cursor-pointer hover:border-amber-500/50">
          <Upload size={18} className="text-gunmetal" />
          <span className="text-xs text-tech-white">{file ? file.name : 'Elegí un .zip'}</span>
          <input
            type="file"
            accept=".zip"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>

        <label className="flex items-center gap-2 text-xs text-gunmetal cursor-pointer mb-4">
          <input type="checkbox" checked={createFolder} onChange={(e) => setCreateFolder(e.target.checked)} />
          Crear carpeta con el nombre del ZIP
        </label>

        {uploading && (
          <div className="w-full h-1.5 rounded-full bg-[var(--color-surf-card-2)] overflow-hidden mb-3">
            <div className="h-full bg-amber-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}

        <button
          type="button"
          className="btn btn-primary btn-sm w-full justify-center"
          onClick={submit}
          disabled={!file || uploading}
        >
          {uploading ? <Loader2 size={13} className="animate-spin" /> : 'Importar'}
        </button>
      </div>
    </div>
  );
}
