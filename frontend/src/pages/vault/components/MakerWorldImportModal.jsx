/**
 * @file Modal wizard "Importar de MakerWorld" (issue #139).
 *
 * Paso 1: pegar URL → resolve (metadata pública, funciona sin credenciales).
 * Paso 2: elegir instancia(s) e importar (requiere Bambu Cloud conectado).
 *
 * `tf-modal-overlay`/`tf-modal` — mismo patrón que `AssignToProjectModal`
 * (#136), sin `<form>` propio.
 *
 * @module pages/vault/components/MakerWorldImportModal
 */

import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  importAllMakerworld,
  importMakerworldInstance,
  makerworldThumbnailUrl,
  resolveMakerworldUrl,
} from '../../../services/api';
import { apiErrorMsg } from '../../../utils/apiError';

const INPUT_CLS =
  'w-full bg-[var(--color-surf-card-2)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-1.5 text-tech-white text-sm focus:outline-none focus:border-amber-500 placeholder:text-gunmetal-dim';

/**
 * @param {Object} props
 * @param {boolean} props.hasCloudAuth - Si hay credenciales Bambu Cloud configuradas.
 * @param {Array} props.folders - Carpetas del Vault (picker de destino).
 * @param {() => void} props.onClose
 * @param {() => void} props.onImported - Recarga la lista de archivos.
 */
export default function MakerWorldImportModal({ hasCloudAuth, folders, onClose, onImported }) {
  const [url, setUrl] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState(null);
  const [selectedProfileId, setSelectedProfileId] = useState(null);
  const [folderId, setFolderId] = useState('');
  const [importing, setImporting] = useState(false);

  const doResolve = async () => {
    if (!url.trim()) return;
    setResolving(true);
    setResolved(null);
    try {
      const res = await resolveMakerworldUrl(url.trim());
      setResolved(res.data);
      const firstAvailable = res.data.instances.find(
        (i) => !res.data.already_imported_model_ids.includes(i.id),
      );
      setSelectedProfileId((firstAvailable || res.data.instances[0])?.profile_id ?? null);
    } catch (err) {
      toast.error(apiErrorMsg(err, 'No se pudo resolver la URL'));
    } finally {
      setResolving(false);
    }
  };

  const doImportOne = async () => {
    if (!resolved) return;
    setImporting(true);
    try {
      await importMakerworldInstance(
        resolved.design_id, selectedProfileId, folderId ? parseInt(folderId, 10) : null,
      );
      toast.success('Modelo importado al Vault');
      onImported();
    } catch (err) {
      toast.error(apiErrorMsg(err, 'No se pudo importar'));
    } finally {
      setImporting(false);
    }
  };

  const doImportAll = async () => {
    if (!resolved) return;
    setImporting(true);
    try {
      const res = await importAllMakerworld(resolved.design_id, folderId ? parseInt(folderId, 10) : null);
      const { imported, failed } = res.data;
      if (imported.length > 0) toast.success(`${imported.length} instancia(s) importada(s)`);
      if (failed.length > 0) toast.error(`${failed.length} instancia(s) fallaron`);
      onImported();
    } catch (err) {
      toast.error(apiErrorMsg(err, 'No se pudo importar todo'));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="tf-modal-overlay" style={{ zIndex: 9999 }}>
      <div className="tf-modal max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <p className="text-tech-white text-sm font-semibold">Importar de MakerWorld</p>
          <button type="button" onClick={onClose} className="text-gunmetal-dim hover:text-tech-white">
            <X size={16} />
          </button>
        </div>

        {!hasCloudAuth && (
          <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-md p-2 mb-3">
            Sin cuenta de Bambu Cloud conectada — podés resolver la metadata, pero para descargar el .3mf
            configurá tu cuenta en Settings → Integraciones.
          </p>
        )}

        <div className="flex gap-2 mb-3">
          <input
            className={INPUT_CLS}
            placeholder="https://makerworld.com/models/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doResolve()}
          />
          <button type="button" className="btn btn-primary btn-sm shrink-0" onClick={doResolve} disabled={resolving}>
            {resolving ? <Loader2 size={13} className="animate-spin" /> : 'Buscar'}
          </button>
        </div>

        {resolved && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              {resolved.images[0] && (
                <img
                  src={makerworldThumbnailUrl(resolved.images[0])}
                  alt={resolved.title}
                  className="w-20 h-20 object-cover rounded-md border border-[var(--color-border-strong)] shrink-0"
                />
              )}
              <div className="min-w-0">
                <p className="text-sm text-tech-white font-medium truncate">{resolved.title}</p>
                {resolved.author && <p className="text-xs text-gunmetal-dim">por {resolved.author}</p>}
              </div>
            </div>

            <div>
              <span className="lbl-eyebrow text-[9px] block mb-1.5">Instancia</span>
              <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                {resolved.instances.map((inst) => {
                  const alreadyImported = resolved.already_imported_model_ids.includes(inst.id);
                  return (
                    <label
                      key={inst.id ?? inst.profile_id}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border cursor-pointer text-xs ${
                        selectedProfileId === inst.profile_id
                          ? 'border-amber-500 bg-amber-500/10'
                          : 'border-[var(--color-border-strong)]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="mw-instance"
                        checked={selectedProfileId === inst.profile_id}
                        onChange={() => setSelectedProfileId(inst.profile_id)}
                      />
                      {inst.thumbnail && (
                        <img
                          src={makerworldThumbnailUrl(inst.thumbnail)}
                          alt=""
                          className="w-8 h-8 object-cover rounded shrink-0"
                        />
                      )}
                      <span className="flex-1 text-tech-white truncate">{inst.title || `Perfil ${inst.profile_id}`}</span>
                      {alreadyImported && <span className="text-[10px] text-emerald-300">ya importado</span>}
                    </label>
                  );
                })}
              </div>
            </div>

            <label className="block">
              <span className="block text-xs text-gunmetal mb-1">Carpeta destino</span>
              <select className={INPUT_CLS} value={folderId} onChange={(e) => setFolderId(e.target.value)}>
                <option value="">MakerWorld (default)</option>
                {(folders || []).map((f) => (
                  <option key={f.id} value={String(f.id)}>{f.name}</option>
                ))}
              </select>
            </label>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={doImportOne}
                disabled={importing || !hasCloudAuth || !selectedProfileId}
              >
                {importing ? <Loader2 size={13} className="animate-spin" /> : 'Importar esta instancia'}
              </button>
              {resolved.instances.length > 1 && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={doImportAll}
                  disabled={importing || !hasCloudAuth}
                >
                  Importar todas ({resolved.instances.length})
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
