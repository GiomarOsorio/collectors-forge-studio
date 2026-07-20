/**
 * @file Tests de los helpers de jerarquía de carpetas del Vault (issue #180).
 */

import { describe, it, expect } from 'vitest';
import {
  buildBreadcrumb,
  getDescendantIds,
  getAncestorIds,
  buildFolderTree,
} from '../pages/vault/folderTreeUtils';

const folders = [
  { id: 1, name: 'MakerWorld', parent_id: null, file_count: 3 },
  { id: 2, name: 'Sagas', parent_id: 1, file_count: 2 },
  { id: 3, name: 'Iconos', parent_id: 1, file_count: 1 },
  { id: 4, name: 'Clientes', parent_id: null, file_count: 12 },
  { id: 5, name: 'Boda', parent_id: 4, file_count: 8 },
  { id: 6, name: 'Nieto', parent_id: 2, file_count: 0 },
];

describe('folderTreeUtils', () => {
  it('buildBreadcrumb devuelve el camino raíz→hoja', () => {
    expect(buildBreadcrumb(folders, 6).map((f) => f.id)).toEqual([1, 2, 6]);
    expect(buildBreadcrumb(folders, null)).toEqual([]);
  });

  it('getDescendantIds incluye hijos y nietos', () => {
    expect([...getDescendantIds(folders, 1)].sort()).toEqual([2, 3, 6]);
    expect([...getDescendantIds(folders, 4)]).toEqual([5]);
    expect([...getDescendantIds(folders, 6)]).toEqual([]);
  });

  it('getAncestorIds sube hasta la raíz sin incluir el propio nodo', () => {
    expect(getAncestorIds(folders, 6)).toEqual([2, 1]);
    expect(getAncestorIds(folders, 1)).toEqual([]);
  });

  it('buildFolderTree anida y ordena por nombre', () => {
    const tree = buildFolderTree(folders);
    // Raíces ordenadas: Clientes, MakerWorld
    expect(tree.map((n) => n.folder.name)).toEqual(['Clientes', 'MakerWorld']);
    const makerworld = tree.find((n) => n.folder.id === 1);
    expect(makerworld.children.map((n) => n.folder.name)).toEqual(['Iconos', 'Sagas']);
    // Nieto bajo Sagas
    const sagas = makerworld.children.find((n) => n.folder.id === 2);
    expect(sagas.children.map((n) => n.folder.id)).toEqual([6]);
  });
});
