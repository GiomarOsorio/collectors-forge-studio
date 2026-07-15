/**
 * @file Tests del modal de aviso de duplicado (issue #128).
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DuplicateWarningModal from '../pages/vault/components/DuplicateWarningModal';

describe('DuplicateWarningModal', () => {
  it('muestra el nombre del archivo nuevo y el existente', () => {
    render(
      <DuplicateWarningModal
        fileName="pieza.3mf"
        existing={{ id: 3, name: 'Pieza original' }}
        onUploadAnyway={() => {}}
        onGoToExisting={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText('pieza.3mf')).toBeInTheDocument();
    expect(screen.getByText(/Pieza original/)).toBeInTheDocument();
  });

  it('"Subir igual" dispara onUploadAnyway', () => {
    const onUploadAnyway = vi.fn();
    render(
      <DuplicateWarningModal
        fileName="pieza.3mf"
        existing={{ id: 3, name: 'Pieza original' }}
        onUploadAnyway={onUploadAnyway}
        onGoToExisting={() => {}}
        onCancel={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Subir igual' }));
    expect(onUploadAnyway).toHaveBeenCalled();
  });

  it('"Ir al existente" dispara onGoToExisting', () => {
    const onGoToExisting = vi.fn();
    render(
      <DuplicateWarningModal
        fileName="pieza.3mf"
        existing={{ id: 3, name: 'Pieza original' }}
        onUploadAnyway={() => {}}
        onGoToExisting={onGoToExisting}
        onCancel={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ir al existente' }));
    expect(onGoToExisting).toHaveBeenCalled();
  });

  it('el botón cerrar dispara onCancel', () => {
    const onCancel = vi.fn();
    render(
      <DuplicateWarningModal
        fileName="pieza.3mf"
        existing={{ id: 3, name: 'Pieza original' }}
        onUploadAnyway={() => {}}
        onGoToExisting={() => {}}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByLabelText('Cerrar y quitar archivo'));
    expect(onCancel).toHaveBeenCalled();
  });
});
