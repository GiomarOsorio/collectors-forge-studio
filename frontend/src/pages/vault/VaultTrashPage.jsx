/**
 * @file Página de la app Vault — papelera (soft-delete).
 *
 * Lista los archivos movidos a la papelera desde la galería. Cada fila
 * permite restaurar (vuelve a la galería, en su carpeta original) o
 * borrar para siempre (bytes de MinIO + fila, irreversible). "Vaciar
 * papelera" borra para siempre TODO lo que hay acá — confirma antes.
 *
 * @module pages/vault/VaultTrashPage
 */

import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Archive, ArrowLeft, RotateCcw, Trash, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Card, EmptyState } from '../../components/ui';
import MobileAppHeader from '../../components/MobileAppHeader';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useConfirm } from '../../components/ConfirmDialog';
import { emptyVaultTrash, getVaultTrash, purgeVaultFile, restoreVaultFile } from '../../services/api';
import { getThumbnail } from '../../utils/thumbnail';

const ACCENT = '#F43F5E';

const fmtDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-CO', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

function TrashRow({ file, onRestore, onPurge }) {
  const thumb = getThumbnail(file);
  return (
    <Card className="p-3 flex items-center gap-3">
      <div
        className="w-12 h-12 rounded-md overflow-hidden bg-[var(--color-surf-sidebar)] flex items-center justify-center shrink-0"
        style={{ border: `1px solid ${ACCENT}40` }}
      >
        {thumb ? (
          <img src={thumb} alt={file.name} className="w-full h-full object-cover grayscale opacity-70" />
        ) : (
          <Archive size={18} style={{ color: `${ACCENT}88` }} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-tech-white truncate">{file.name}</p>
        <p className="mono text-[10.5px] text-gunmetal mt-0.5">
          Eliminado el {fmtDate(file.deleted_at)}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => onRestore(file)}>
          Restaurar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={Trash2}
          onClick={() => onPurge(file)}
          className="text-rose-400 hover:text-rose-300"
        >
          Borrar para siempre
        </Button>
      </div>
    </Card>
  );
}

export default function VaultTrashPage() {
  const isMobile = useIsMobile();
  const { openSidebar } = useOutletContext() || {};
  const confirm = useConfirm();

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getVaultTrash({ page: 1, page_size: 100 });
      const data = res.data;
      setFiles(Array.isArray(data) ? data : data?.items || []);
    } catch {
      toast.error('No se pudo cargar la papelera');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleRestore = async (file) => {
    try {
      await restoreVaultFile(file.id);
      toast.success(`"${file.name}" restaurado`);
      await load();
    } catch {
      toast.error('No se pudo restaurar');
    }
  };

  const handlePurge = async (file) => {
    const ok = await confirm(
      `¿Borrar "${file.name}" para siempre? Esto no se puede deshacer — se borran los archivos de almacenamiento también.`,
      'Borrar para siempre',
    );
    if (!ok) return;
    try {
      await purgeVaultFile(file.id);
      toast.success('Archivo borrado permanentemente');
      await load();
    } catch {
      toast.error('No se pudo borrar');
    }
  };

  const handleEmptyTrash = async () => {
    const ok = await confirm(
      `¿Vaciar toda la papelera? Se borran para siempre los ${files.length} archivo(s) — esto no se puede deshacer.`,
      'Vaciar papelera',
    );
    if (!ok) return;
    try {
      await emptyVaultTrash();
      toast.success('Papelera vaciada');
      await load();
    } catch {
      toast.error('No se pudo vaciar la papelera');
    }
  };

  const Header = isMobile ? (
    <MobileAppHeader
      appName="Vault"
      appIcon={Trash}
      appAccent={ACCENT}
      title="Papelera"
      onMenu={() => openSidebar?.()}
    />
  ) : (
    <header className="flex items-center gap-4 px-6 py-3.5 border-b border-[var(--color-border-soft)] bg-[var(--color-surf-sidebar)] sticky top-0 z-20">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span
          className="inline-flex items-center justify-center w-6 h-6 rounded-md shrink-0"
          style={{ background: `${ACCENT}1F`, color: ACCENT, border: `1px solid ${ACCENT}40` }}
        >
          <Trash size={13} />
        </span>
        <Link to="/vault" className="text-sm text-gunmetal hover:text-tech-white">Vault</Link>
        <span className="text-gunmetal-dim shrink-0">›</span>
        <span className="text-sm font-semibold text-tech-white whitespace-nowrap">Papelera</span>
        <span className="mono text-[10px] px-1.5 py-0.5 rounded-sm bg-white/5 border border-[var(--color-border)] text-steel ml-1">
          {files.length}
        </span>
      </div>
      <Link to="/vault" className="btn btn-ghost btn-sm">
        <ArrowLeft size={13} /> Volver al Vault
      </Link>
      {files.length > 0 && (
        <Button variant="ghost" size="sm" icon={Trash2} onClick={handleEmptyTrash} className="text-rose-400 hover:text-rose-300">
          Vaciar papelera
        </Button>
      )}
    </header>
  );

  return (
    <div className="flex flex-col min-h-screen -m-4 md:-m-6 xl:-m-8">
      {Header}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {loading ? (
          <p className="py-16 text-center text-gunmetal text-sm">Cargando papelera…</p>
        ) : files.length === 0 ? (
          <EmptyState
            icon={Trash}
            accent={ACCENT}
            title="Papelera vacía"
            hint="Los archivos que muevas a la papelera desde el Vault aparecen acá."
          />
        ) : (
          <div className="flex flex-col gap-2 max-w-2xl mx-auto">
            {isMobile && files.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                icon={Trash2}
                onClick={handleEmptyTrash}
                className="text-rose-400 hover:text-rose-300 self-end mb-1"
              >
                Vaciar papelera
              </Button>
            )}
            {files.map((f) => (
              <TrashRow key={f.id} file={f} onRestore={handleRestore} onPurge={handlePurge} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
