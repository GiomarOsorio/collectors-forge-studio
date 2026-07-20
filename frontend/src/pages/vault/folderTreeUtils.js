/**
 * @file Helpers de jerarquía de carpetas del Vault.
 *
 * Compartidos entre `VaultPage` (breadcrumb, picker "mover a…") y `FolderTree`
 * (panel/sheet de navegación, issue #180). El endpoint `getVaultFolders`
 * devuelve la lista plana con `parent_id`; el árbol se construye client-side.
 *
 * @module pages/vault/folderTreeUtils
 */

/**
 * Camino de carpetas desde la raíz hasta `folderId` (raíz excluida).
 *
 * @param {Array<{id:number, parent_id:?number}>} folders
 * @param {?number} folderId
 * @returns {Array} carpetas ordenadas raíz→hoja
 */
export const buildBreadcrumb = (folders, folderId) => {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const path = [];
  let current = folderId != null ? byId.get(folderId) : null;
  while (current) {
    path.unshift(current);
    current = current.parent_id != null ? byId.get(current.parent_id) : null;
  }
  return path;
};

/**
 * IDs de todos los descendientes de `folderId` (hijos, nietos, etc.) — usado
 * para excluir del picker "mover a…" los destinos que el backend
 * (`_assert_not_own_descendant`) siempre rechaza.
 *
 * @param {Array<{id:number, parent_id:?number}>} folders
 * @param {number} folderId
 * @returns {Set<number>}
 */
export const getDescendantIds = (folders, folderId) => {
  const childrenOf = new Map();
  for (const f of folders) {
    if (f.parent_id != null) {
      if (!childrenOf.has(f.parent_id)) childrenOf.set(f.parent_id, []);
      childrenOf.get(f.parent_id).push(f.id);
    }
  }
  const result = new Set();
  const queue = [...(childrenOf.get(folderId) || [])];
  while (queue.length > 0) {
    const id = queue.shift();
    if (result.has(id)) continue;
    result.add(id);
    queue.push(...(childrenOf.get(id) || []));
  }
  return result;
};

/**
 * IDs de los ancestros de `folderId` (para auto-expandir el árbol hasta la
 * carpeta seleccionada). No incluye a `folderId`.
 *
 * @param {Array<{id:number, parent_id:?number}>} folders
 * @param {?number} folderId
 * @returns {number[]}
 */
export const getAncestorIds = (folders, folderId) => {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const ids = [];
  let current = folderId != null ? byId.get(folderId) : null;
  while (current && current.parent_id != null) {
    ids.push(current.parent_id);
    current = byId.get(current.parent_id);
  }
  return ids;
};

/**
 * Construye el árbol anidado desde la lista plana. Cada nodo es
 * `{ folder, children: Node[] }`. Ordena por nombre en cada nivel.
 *
 * @param {Array<{id:number, name:string, parent_id:?number}>} folders
 * @returns {Array<{folder:Object, children:Array}>} raíces
 */
export const buildFolderTree = (folders) => {
  const childrenOf = new Map();
  for (const f of folders) {
    const key = f.parent_id ?? null;
    if (!childrenOf.has(key)) childrenOf.set(key, []);
    childrenOf.get(key).push(f);
  }
  const byName = (a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
  const build = (parentId) =>
    (childrenOf.get(parentId) || [])
      .slice()
      .sort(byName)
      .map((folder) => ({ folder, children: build(folder.id) }));
  return build(null);
};
