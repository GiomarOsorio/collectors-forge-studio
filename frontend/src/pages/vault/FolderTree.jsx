/**
 * @file Árbol de carpetas del Vault (issue #180, ref. bambuddy FolderTreeItem).
 *
 * Navegación persistente adicional a las FolderCards de la galería. El chevron
 * expande/colapsa un nodo SIN navegar; el tap en el nombre selecciona la
 * carpeta y filtra la galería (mismo `currentFolderId` que el breadcrumb). El
 * ⋮ por fila reusa las acciones de `FolderCard` (renombrar / mover / eliminar).
 *
 * Se usa en dos variantes:
 * - `panel`  → columna 240px colapsable a rail (desktop ≥1024).
 * - `sheet`  → dentro de un `MobileSheet`, con filas táctiles de 44px (<1024).
 *
 * Diseño 1:1: `agent-docs/ui-responsive/mockups/vault.html` §7.
 *
 * @module pages/vault/FolderTree
 */

import { useState } from 'react';
import { Archive, ChevronRight, Folder, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { buildFolderTree, getDescendantIds } from './folderTreeUtils';

const ACCENT = '#F43F5E';

/** Menú ⋮ de una fila — renombrar / mover a… / eliminar (solo admin). */
function FolderRowMenu({ folder, folders, sheet, onRename, onMove, onDelete }) {
  const [open, setOpen] = useState(false);
  const excludedIds = getDescendantIds(folders, folder.id);
  const otherFolders = folders.filter((f) => f.id !== folder.id && !excludedIds.has(f.id));
  const btnSize = sheet ? 'w-9 h-9' : 'w-[22px] h-[22px]';
  return (
    <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${btnSize} inline-flex items-center justify-center rounded text-gunmetal hover:text-tech-white hover:bg-white/5 ${
          sheet ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
        aria-label="Opciones de carpeta"
      >
        <MoreVertical size={sheet ? 16 : 13} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surf-card)] shadow-xl py-1">
            <button
              type="button"
              className="w-full text-left px-3 py-1.5 text-xs text-tech-white hover:bg-white/5 flex items-center gap-2"
              onClick={() => { setOpen(false); onRename(folder); }}
            >
              <Pencil size={12} /> Renombrar
            </button>
            {otherFolders.length > 0 && (
              <div className="px-3 py-1.5">
                <span className="block text-[10px] text-gunmetal mb-1">Mover a…</span>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    const val = e.target.value;
                    setOpen(false);
                    if (val === '__root__') onMove(folder, null);
                    else if (val) onMove(folder, Number(val));
                  }}
                  className="w-full bg-[var(--color-surf-card-2)] border border-[var(--color-border-strong)] rounded text-[11px] text-tech-white px-1.5 py-1"
                >
                  <option value="" disabled>— elegir —</option>
                  <option value="__root__">Raíz (Vault)</option>
                  {otherFolders.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
            )}
            <button
              type="button"
              className="w-full text-left px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-500/10 flex items-center gap-2"
              onClick={() => { setOpen(false); onDelete(folder); }}
            >
              <Trash2 size={12} /> Eliminar
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** Una fila del árbol (recursiva). */
function TreeRow({
  node, depth, currentFolderId, expanded, onToggle, onSelect,
  folders, isAdmin, sheet, onRename, onMove, onDelete,
}) {
  const { folder, children } = node;
  const hasChildren = children.length > 0;
  const isExpanded = expanded.has(folder.id);
  const selected = folder.id === currentFolderId;
  const chevBox = sheet ? 'w-8 h-8' : 'w-[18px] h-[18px]';

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(folder.id)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(folder.id); } }}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
        className={`group flex items-center gap-1.5 pr-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
          sheet ? 'min-h-[44px] text-sm' : 'text-[13px]'
        } ${selected ? 'bg-rose-500/15 text-rose-300' : 'text-tech-white hover:bg-white/5'}`}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggle(folder.id); }}
            className={`${chevBox} shrink-0 inline-flex items-center justify-center text-gunmetal hover:text-tech-white`}
            aria-label={isExpanded ? 'Colapsar' : 'Expandir'}
          >
            <ChevronRight size={sheet ? 16 : 12} className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
          </button>
        ) : (
          <span className={`${chevBox} shrink-0`} />
        )}
        <Folder size={sheet ? 15 : 13} className="shrink-0" style={{ color: selected ? ACCENT : `${ACCENT}88` }} />
        <span className="flex-1 min-w-0 truncate" title={folder.name}>{folder.name}</span>
        <span className="shrink-0 mono text-[10.5px] text-gunmetal">{folder.file_count}</span>
        {isAdmin && (
          <FolderRowMenu
            folder={folder} folders={folders} sheet={sheet}
            onRename={onRename} onMove={onMove} onDelete={onDelete}
          />
        )}
      </div>
      {hasChildren && isExpanded && children.map((child) => (
        <TreeRow
          key={child.folder.id}
          node={child} depth={depth + 1}
          currentFolderId={currentFolderId} expanded={expanded} onToggle={onToggle} onSelect={onSelect}
          folders={folders} isAdmin={isAdmin} sheet={sheet}
          onRename={onRename} onMove={onMove} onDelete={onDelete}
        />
      ))}
    </>
  );
}

/**
 * @param {Object} props
 * @param {Array} props.folders - lista plana (id, name, parent_id, file_count)
 * @param {?number} props.currentFolderId
 * @param {number} props.total - total de modelos para "Todos los modelos"
 * @param {(id: ?number) => void} props.onSelect
 * @param {Set<number>} props.expanded - nodos expandidos (persistido por el padre)
 * @param {(id: number) => void} props.onToggle
 * @param {boolean} props.isAdmin
 * @param {(folder: Object) => void} props.onRename
 * @param {(folder: Object, newParentId: ?number) => void} props.onMove
 * @param {(folder: Object) => void} props.onDelete
 * @param {('panel'|'sheet')} [props.variant='panel']
 */
export default function FolderTree({
  folders, currentFolderId, total, onSelect, expanded, onToggle,
  isAdmin, onRename, onMove, onDelete, variant = 'panel',
}) {
  const sheet = variant === 'sheet';
  const tree = buildFolderTree(folders);

  return (
    <div className="flex flex-col gap-0.5">
      {/* Raíz — Todos los modelos */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(null)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(null); } }}
        style={{ paddingLeft: '8px' }}
        className={`flex items-center gap-1.5 pr-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
          sheet ? 'min-h-[44px] text-sm' : 'text-[13px]'
        } ${currentFolderId === null ? 'bg-rose-500/15 text-rose-300' : 'text-tech-white hover:bg-white/5'}`}
      >
        <span className={`${sheet ? 'w-8 h-8' : 'w-[18px] h-[18px]'} shrink-0`} />
        <Archive size={sheet ? 15 : 13} className="shrink-0" style={{ color: currentFolderId === null ? ACCENT : `${ACCENT}88` }} />
        <span className="flex-1 min-w-0 truncate">Todos los modelos</span>
        <span className="shrink-0 mono text-[10.5px] text-gunmetal">{total}</span>
      </div>

      {tree.map((node) => (
        <TreeRow
          key={node.folder.id}
          node={node} depth={0}
          currentFolderId={currentFolderId} expanded={expanded} onToggle={onToggle} onSelect={onSelect}
          folders={folders} isAdmin={isAdmin} sheet={sheet}
          onRename={onRename} onMove={onMove} onDelete={onDelete}
        />
      ))}
    </div>
  );
}
