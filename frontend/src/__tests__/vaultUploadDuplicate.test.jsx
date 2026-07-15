/**
 * @file Tests del aviso de duplicado por hash en la subida al Vault (issue #128).
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const mockCheckVaultDuplicate = vi.fn();
const mockGetVaultFolders = vi.fn().mockResolvedValue({ data: [] });

vi.mock('../services/api', () => ({
  checkVaultDuplicate: (...args) => mockCheckVaultDuplicate(...args),
  getVaultFolders: (...args) => mockGetVaultFolders(...args),
  fetchVaultMetadata: vi.fn(),
  getVaultFile: vi.fn(),
  replaceVaultPrint: vi.fn(),
  replaceVaultSource: vi.fn(),
  updateVaultFile: vi.fn(),
  uploadVaultFile: vi.fn(),
}));

vi.mock('../utils/fileHash', () => ({
  hashFile: vi.fn().mockResolvedValue('a'.repeat(64)),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'admin' } }),
}));

vi.mock('../hooks/useMediaQuery', () => ({
  useIsMobile: () => false,
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import VaultUploadPage from '../pages/vault/VaultUploadPage';
import { hashFile } from '../utils/fileHash';

function renderPage() {
  return render(
    <MemoryRouter>
      <VaultUploadPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockCheckVaultDuplicate.mockReset();
  hashFile.mockClear();
});

describe('VaultUploadPage — aviso de duplicado', () => {
  it('elegir un .3mf duplicado muestra el modal de aviso', async () => {
    mockCheckVaultDuplicate.mockResolvedValue({
      data: { duplicate: true, file: { id: 7, name: 'Figura ya subida' } },
    });
    renderPage();
    await waitFor(() => expect(mockGetVaultFolders).toHaveBeenCalled());

    const input = document.querySelector('input[accept=".3mf,.stl"]');
    const file = new File(['contenido'], 'modelo.3mf', { type: 'model/3mf' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(hashFile).toHaveBeenCalledWith(file));
    await waitFor(() => expect(screen.getByText('Archivo duplicado')).toBeInTheDocument());
    expect(screen.getByText(/Figura ya subida/)).toBeInTheDocument();
  });

  it('elegir un archivo sin duplicado no muestra el modal', async () => {
    mockCheckVaultDuplicate.mockResolvedValue({ data: { duplicate: false, file: null } });
    renderPage();
    await waitFor(() => expect(mockGetVaultFolders).toHaveBeenCalled());

    const input = document.querySelector('input[accept=".3mf,.stl"]');
    const file = new File(['contenido'], 'nuevo.3mf', { type: 'model/3mf' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(hashFile).toHaveBeenCalled());
    expect(screen.queryByText('Archivo duplicado')).not.toBeInTheDocument();
  });

  it('"Subir igual" cierra el modal y conserva el archivo', async () => {
    mockCheckVaultDuplicate.mockResolvedValue({
      data: { duplicate: true, file: { id: 7, name: 'Figura ya subida' } },
    });
    renderPage();
    await waitFor(() => expect(mockGetVaultFolders).toHaveBeenCalled());

    const input = document.querySelector('input[accept=".3mf,.stl"]');
    const file = new File(['contenido'], 'modelo.3mf', { type: 'model/3mf' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText('Archivo duplicado')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Subir igual' }));
    expect(screen.queryByText('Archivo duplicado')).not.toBeInTheDocument();
    expect(screen.getByText('modelo.3mf')).toBeInTheDocument();
  });

  it('cerrar el modal (X) quita el archivo elegido', async () => {
    mockCheckVaultDuplicate.mockResolvedValue({
      data: { duplicate: true, file: { id: 7, name: 'Figura ya subida' } },
    });
    renderPage();
    await waitFor(() => expect(mockGetVaultFolders).toHaveBeenCalled());

    const input = document.querySelector('input[accept=".3mf,.stl"]');
    const file = new File(['contenido'], 'modelo.3mf', { type: 'model/3mf' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText('Archivo duplicado')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Cerrar y quitar archivo'));
    expect(screen.queryByText('Archivo duplicado')).not.toBeInTheDocument();
    expect(screen.queryByText('modelo.3mf')).not.toBeInTheDocument();
  });
});
