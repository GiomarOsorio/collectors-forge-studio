/**
 * @file Modal "Ya existe como X" (issue #128) — se muestra cuando el hash
 * SHA-256 client-side de un archivo elegido para subir coincide con un
 * archivo ya presente en el Vault.
 *
 * @module pages/vault/components/DuplicateWarningModal
 */

import { AlertTriangle, X } from 'lucide-react';

/**
 * @param {Object} props
 * @param {string} props.fileName - Nombre del archivo que se está por subir.
 * @param {{id: number, name: string}} props.existing - Archivo duplicado ya en el Vault.
 * @param {() => void} props.onUploadAnyway - Subir igual (ignorar el aviso).
 * @param {() => void} props.onGoToExisting - Ir a editar/ver el archivo existente.
 * @param {() => void} props.onCancel - Cancelar, quitar el archivo elegido.
 */
export default function DuplicateWarningModal({ fileName, existing, onUploadAnyway, onGoToExisting, onCancel }) {
  return (
    <div className="tf-modal-overlay" style={{ zIndex: 10000 }}>
      <div className="tf-modal max-w-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="flex items-center gap-2 text-tech-white text-sm font-semibold">
            <AlertTriangle size={16} className="text-amber-400" /> Archivo duplicado
          </span>
          <button type="button" onClick={onCancel} className="text-gunmetal-dim hover:text-tech-white" aria-label="Cerrar y quitar archivo">
            <X size={16} />
          </button>
        </div>

        <p className="text-xs text-gunmetal mb-4">
          <span className="text-tech-white">{fileName}</span> tiene el mismo contenido que{' '}
          <span className="text-tech-white">"{existing.name}"</span>, ya en el Vault.
        </p>

        <div className="flex flex-col gap-2">
          <button type="button" className="btn btn-ghost btn-sm w-full justify-center" onClick={onGoToExisting}>
            Ir al existente
          </button>
          <button type="button" className="btn btn-primary btn-sm w-full justify-center" onClick={onUploadAnyway}>
            Subir igual
          </button>
        </div>
      </div>
    </div>
  );
}
