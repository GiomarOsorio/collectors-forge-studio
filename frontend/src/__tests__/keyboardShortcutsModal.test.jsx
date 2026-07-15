/**
 * @file Tests del modal de ayuda de atajos (issue #140, pieza A).
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import KeyboardShortcutsModal from '../components/KeyboardShortcutsModal';

describe('KeyboardShortcutsModal', () => {
  it('lista los atajos de navegación y generales', () => {
    render(<KeyboardShortcutsModal onClose={() => {}} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByText('g').length).toBeGreaterThan(0);
    expect(screen.getByText('q')).toBeInTheDocument();
    expect(screen.getByText('?')).toBeInTheDocument();
    expect(screen.getByText('/')).toBeInTheDocument();
  });

  it('click afuera cierra', () => {
    const onClose = vi.fn();
    render(<KeyboardShortcutsModal onClose={onClose} />);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalled();
  });

  it('Escape cierra', () => {
    const onClose = vi.fn();
    render(<KeyboardShortcutsModal onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('botón X cierra', () => {
    const onClose = vi.fn();
    render(<KeyboardShortcutsModal onClose={onClose} />);
    // Sin provider de i18n en tests, t() devuelve la clave cruda.
    fireEvent.click(screen.getByLabelText('common.close'));
    expect(onClose).toHaveBeenCalled();
  });
});
