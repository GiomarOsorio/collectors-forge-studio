/**
 * @file Tests de Collapsible y ContextMenu (componentes ui/ nuevos del
 * sistema de temas — issue #126, agent-docs/bambuddy-sync/126-*).
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Trash2 } from 'lucide-react';

import { Collapsible, ContextMenu } from '../components/ui';

// ─── Collapsible ────────────────────────────────────────────────────────────

describe('Collapsible', () => {
  it('no controlado: oculta children por defecto y los muestra al hacer click', () => {
    render(
      <Collapsible summary="Título">
        <p>Contenido oculto</p>
      </Collapsible>,
    );
    expect(screen.queryByText('Contenido oculto')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Título' }));
    expect(screen.getByText('Contenido oculto')).toBeInTheDocument();
  });

  it('defaultOpen=true muestra children desde el inicio', () => {
    render(
      <Collapsible summary="Título" defaultOpen>
        <p>Ya visible</p>
      </Collapsible>,
    );
    expect(screen.getByText('Ya visible')).toBeInTheDocument();
  });

  it('click alterna abierto/cerrado (toggle)', () => {
    render(
      <Collapsible summary="T">
        <p>Body</p>
      </Collapsible>,
    );
    const toggle = screen.getByRole('button', { name: 'T' });
    fireEvent.click(toggle);
    expect(screen.getByText('Body')).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.queryByText('Body')).not.toBeInTheDocument();
  });

  it('Enter y Espacio también alternan (accesibilidad teclado)', () => {
    render(
      <Collapsible summary="T">
        <p>Body</p>
      </Collapsible>,
    );
    const toggle = screen.getByRole('button', { name: 'T' });
    fireEvent.keyDown(toggle, { key: 'Enter' });
    expect(screen.getByText('Body')).toBeInTheDocument();
    fireEvent.keyDown(toggle, { key: ' ' });
    expect(screen.queryByText('Body')).not.toBeInTheDocument();
  });

  it('modo controlado: open prop manda, onToggle se dispara pero no cambia visibilidad solo', () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <Collapsible summary="T" open={false} onToggle={onToggle}>
        <p>Body</p>
      </Collapsible>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'T' }));
    expect(onToggle).toHaveBeenCalledWith(true);
    // El padre no actualizó `open` todavía — sigue cerrado.
    expect(screen.queryByText('Body')).not.toBeInTheDocument();

    rerender(
      <Collapsible summary="T" open={true} onToggle={onToggle}>
        <p>Body</p>
      </Collapsible>,
    );
    expect(screen.getByText('Body')).toBeInTheDocument();
  });
});

// ─── ContextMenu ────────────────────────────────────────────────────────────

describe('ContextMenu', () => {
  const baseItems = [
    { label: 'Renombrar', onClick: vi.fn() },
    { label: 'divider', divider: true },
    { label: 'Eliminar', danger: true, onClick: vi.fn(), icon: Trash2 },
    { label: 'Deshabilitado', disabled: true, onClick: vi.fn() },
  ];

  it('renderiza labels de los items', () => {
    render(<ContextMenu x={10} y={10} items={baseItems} onClose={() => {}} />);
    expect(screen.getByText('Renombrar')).toBeInTheDocument();
    expect(screen.getByText('Eliminar')).toBeInTheDocument();
    expect(screen.getByText('Deshabilitado')).toBeInTheDocument();
  });

  it('click en item ejecuta onClick y luego onClose', () => {
    const onClick = vi.fn();
    const onClose = vi.fn();
    render(
      <ContextMenu
        x={0}
        y={0}
        items={[{ label: 'Acción', onClick }]}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Acción' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('item disabled no dispara onClick ni onClose', () => {
    const onClick = vi.fn();
    const onClose = vi.fn();
    render(
      <ContextMenu
        x={0}
        y={0}
        items={[{ label: 'No-op', disabled: true, onClick }]}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'No-op' }));
    expect(onClick).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('divider renderiza separador sin item clicable', () => {
    render(
      <ContextMenu
        x={0}
        y={0}
        items={[{ label: 'x', divider: true }]}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  });

  it('item danger aplica clase de color rojo', () => {
    render(
      <ContextMenu
        x={0}
        y={0}
        items={[{ label: 'Borrar', danger: true, onClick: () => {} }]}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole('menuitem', { name: 'Borrar' }).className).toContain('text-rose-400');
  });

  it('click fuera del menú dispara onClose', () => {
    const onClose = vi.fn();
    render(
      <div>
        <div data-testid="outside">afuera</div>
        <ContextMenu x={0} y={0} items={baseItems} onClose={onClose} />
      </div>,
    );
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape dispara onClose', () => {
    const onClose = vi.fn();
    render(<ContextMenu x={0} y={0} items={baseItems} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
