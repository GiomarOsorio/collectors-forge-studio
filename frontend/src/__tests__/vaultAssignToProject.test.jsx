/**
 * @file Tests del flujo "Asignar a proyecto" desde Vault (issue #136,
 * sub-ticket 2/3): selección múltiple → modal → addProjectFiles con los
 * ids correctos, incluyendo el flujo de crear un proyecto nuevo inline.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const mockGetVaultFiles = vi.fn();
const mockGetVaultStats = vi.fn().mockResolvedValue({ data: { used_bytes: 0, quota_bytes: 1, percent: 0 } });
const mockGetVaultFolders = vi.fn().mockResolvedValue({ data: [] });
const mockGetVaultTags = vi.fn().mockResolvedValue({ data: [] });
const mockGetProjects = vi.fn();
const mockCreateProject = vi.fn();
const mockAddProjectFiles = vi.fn().mockResolvedValue({ data: [] });

vi.mock('../services/api', () => ({
  getVaultFiles: (...args) => mockGetVaultFiles(...args),
  getVaultStats: (...args) => mockGetVaultStats(...args),
  getVaultFolders: (...args) => mockGetVaultFolders(...args),
  getVaultTags: (...args) => mockGetVaultTags(...args),
  getProjects: (...args) => mockGetProjects(...args),
  createProject: (...args) => mockCreateProject(...args),
  addProjectFiles: (...args) => mockAddProjectFiles(...args),
  createVaultFolder: vi.fn(), createVaultTag: vi.fn(), deleteVaultFile: vi.fn(),
  deleteVaultFolder: vi.fn(), deleteVaultPhoto: vi.fn(), deleteVaultTag: vi.fn(),
  setActiveVaultPlate: vi.fn(), downloadVaultPrint: vi.fn(), downloadVaultSource: vi.fn(),
  getVaultGcodeContent: vi.fn(), getVaultPhotos: vi.fn(), getVaultPrintHistory: vi.fn(),
  updateVaultFile: vi.fn(), updateVaultFolder: vi.fn(), updateVaultTag: vi.fn(), uploadVaultPhotos: vi.fn(),
  getMakerworldAuthStatus: vi.fn().mockResolvedValue({ data: { configured: false } }),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'admin' } }),
}));

import VaultPage from '../pages/vault/VaultPage';

function fakeFile(id, name = `Modelo ${id}.3mf`) {
  return {
    id, name, source_file_name: name, source_file_size: 1024,
    print_file_name: null, print_file_size: null, is_print_ready: false,
    thumbnail_url: null, local_thumbnail_url: null, tags: [], print_count: 0,
    created_at: '2026-01-01T00:00:00',
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <VaultPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockGetVaultFiles.mockReset();
  mockGetProjects.mockReset();
  mockCreateProject.mockReset();
  mockAddProjectFiles.mockClear();
});

describe('VaultPage — Asignar a proyecto', () => {
  it('seleccionar archivos y asignar a un proyecto existente dispara addProjectFiles', async () => {
    mockGetVaultFiles.mockResolvedValue({ data: { items: [fakeFile(1), fakeFile(2)], total: 2 } });
    mockGetProjects.mockResolvedValue({ data: [{ id: 5, name: 'Encargo X' }] });
    renderPage();
    await waitFor(() => expect(screen.getByText('Modelo 1.3mf')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar' }));
    fireEvent.click(screen.getByLabelText('Seleccionar Modelo 1.3mf'));
    fireEvent.click(screen.getByLabelText('Seleccionar Modelo 2.3mf'));

    fireEvent.click(screen.getByRole('button', { name: /asignar a proyecto/i }));
    await waitFor(() => expect(screen.getByText(/Asignar 2 archivos a proyecto/)).toBeInTheDocument());

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Asignar' }));

    await waitFor(() => expect(mockAddProjectFiles).toHaveBeenCalledWith(5, [1, 2]));
  });

  it('crear proyecto nuevo inline y asignar', async () => {
    mockGetVaultFiles.mockResolvedValue({ data: { items: [fakeFile(1)], total: 1 } });
    mockGetProjects.mockResolvedValue({ data: [] });
    mockCreateProject.mockResolvedValue({ data: { id: 9, name: 'Nuevo Encargo' } });
    renderPage();
    await waitFor(() => expect(screen.getByText('Modelo 1.3mf')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar' }));
    fireEvent.click(screen.getByLabelText('Seleccionar Modelo 1.3mf'));
    fireEvent.click(screen.getByRole('button', { name: /asignar a proyecto/i }));
    await waitFor(() => expect(screen.getByText('+ Crear proyecto nuevo')).toBeInTheDocument());

    fireEvent.click(screen.getByText('+ Crear proyecto nuevo'));
    fireEvent.change(screen.getByPlaceholderText(/Encargo boda/), { target: { value: 'Nuevo Encargo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Asignar' }));

    await waitFor(() => expect(mockCreateProject).toHaveBeenCalledWith({ name: 'Nuevo Encargo' }));
    await waitFor(() => expect(mockAddProjectFiles).toHaveBeenCalledWith(9, [1]));
  });
});
