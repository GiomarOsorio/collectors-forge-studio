/**
 * @file Tests del modal "Subir ZIP" del Vault (issue #127).
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUploadVaultZip = vi.fn();

vi.mock('../services/api', () => ({
  uploadVaultZip: (...args) => mockUploadVaultZip(...args),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import UploadZipModal from '../pages/vault/components/UploadZipModal';
import toast from 'react-hot-toast';

beforeEach(() => {
  mockUploadVaultZip.mockReset();
});

describe('UploadZipModal', () => {
  it('el botón Importar queda deshabilitado sin archivo elegido', () => {
    render(<UploadZipModal currentFolderId={null} onClose={() => {}} onImported={() => {}} />);
    expect(screen.getByRole('button', { name: 'Importar' })).toBeDisabled();
  });

  it('elegir archivo y confirmar dispara uploadVaultZip con folderId y createFolder', async () => {
    mockUploadVaultZip.mockResolvedValue({
      data: { files_created: 3, skipped_entries: 1, folders_created: 2 },
    });
    const onImported = vi.fn();
    render(<UploadZipModal currentFolderId={7} onClose={() => {}} onImported={onImported} />);

    const zipFile = new File(['zip-fake'], 'modelos.zip', { type: 'application/zip' });
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [zipFile] } });

    fireEvent.click(screen.getByRole('button', { name: 'Importar' }));

    await waitFor(() => expect(mockUploadVaultZip).toHaveBeenCalledWith(
      zipFile, { folderId: 7, createFolder: true }, expect.any(Function),
    ));
    await waitFor(() => expect(onImported).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('3 archivo(s) importado(s)'));
  });

  it('destildar "crear carpeta" pasa createFolder=false', async () => {
    mockUploadVaultZip.mockResolvedValue({ data: { files_created: 1, skipped_entries: 0, folders_created: 0 } });
    render(<UploadZipModal currentFolderId={null} onClose={() => {}} onImported={() => {}} />);

    fireEvent.click(screen.getByText('Crear carpeta con el nombre del ZIP'));

    const zipFile = new File(['zip-fake'], 'modelos.zip', { type: 'application/zip' });
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [zipFile] } });
    fireEvent.click(screen.getByRole('button', { name: 'Importar' }));

    await waitFor(() => expect(mockUploadVaultZip).toHaveBeenCalledWith(
      zipFile, { folderId: null, createFolder: false }, expect.any(Function),
    ));
  });

  it('error en la subida muestra toast y no llama onImported', async () => {
    mockUploadVaultZip.mockRejectedValue(new Error('boom'));
    const onImported = vi.fn();
    render(<UploadZipModal currentFolderId={null} onClose={() => {}} onImported={onImported} />);

    const zipFile = new File(['zip-fake'], 'modelos.zip', { type: 'application/zip' });
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [zipFile] } });
    fireEvent.click(screen.getByRole('button', { name: 'Importar' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(onImported).not.toHaveBeenCalled();
  });
});
