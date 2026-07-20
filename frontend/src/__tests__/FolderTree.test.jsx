/**
 * @file Tests del componente FolderTree del Vault (issue #180) —
 * expand/colapsa, selección y acciones de fila.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FolderTree from '../pages/vault/FolderTree';

const folders = [
  { id: 1, name: 'MakerWorld', parent_id: null, file_count: 3 },
  { id: 2, name: 'Sagas', parent_id: 1, file_count: 2 },
  { id: 3, name: 'Clientes', parent_id: null, file_count: 12 },
];

function setup(overrides = {}) {
  const props = {
    folders,
    currentFolderId: null,
    total: 32,
    expanded: new Set(),
    onToggle: vi.fn(),
    onSelect: vi.fn(),
    isAdmin: true,
    onRename: vi.fn(),
    onMove: vi.fn(),
    onDelete: vi.fn(),
    variant: 'panel',
    ...overrides,
  };
  render(<FolderTree {...props} />);
  return props;
}

describe('FolderTree', () => {
  it('renderiza la raíz y las carpetas de primer nivel', () => {
    setup();
    expect(screen.getByText('Todos los modelos')).toBeInTheDocument();
    expect(screen.getByText('MakerWorld')).toBeInTheDocument();
    expect(screen.getByText('Clientes')).toBeInTheDocument();
  });

  it('oculta los hijos si el nodo está colapsado', () => {
    setup({ expanded: new Set() });
    expect(screen.queryByText('Sagas')).not.toBeInTheDocument();
  });

  it('muestra los hijos cuando el padre está en expanded', () => {
    setup({ expanded: new Set([1]) });
    expect(screen.getByText('Sagas')).toBeInTheDocument();
  });

  it('click en el nombre selecciona (raíz → null, carpeta → id)', () => {
    const props = setup();
    fireEvent.click(screen.getByText('MakerWorld'));
    expect(props.onSelect).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByText('Todos los modelos'));
    expect(props.onSelect).toHaveBeenCalledWith(null);
  });

  it('click en el chevron expande/colapsa sin seleccionar', () => {
    const props = setup();
    fireEvent.click(screen.getByLabelText('Expandir'));
    expect(props.onToggle).toHaveBeenCalledWith(1);
    expect(props.onSelect).not.toHaveBeenCalled();
  });

  it('el menú ⋮ dispara renombrar (admin)', () => {
    const props = setup();
    // El árbol ordena alfabéticamente: la primera fila con menú es "Clientes".
    const clientes = folders.find((f) => f.name === 'Clientes');
    fireEvent.click(screen.getAllByLabelText('Opciones de carpeta')[0]);
    fireEvent.click(screen.getByText('Renombrar'));
    expect(props.onRename).toHaveBeenCalledWith(clientes);
  });

  it('sin admin no muestra el menú de acciones', () => {
    setup({ isAdmin: false });
    expect(screen.queryByLabelText('Opciones de carpeta')).not.toBeInTheDocument();
  });
});
