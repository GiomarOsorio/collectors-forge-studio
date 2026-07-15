/**
 * @file Tests del wizard de import de MakerWorld (issue #139):
 * resolve → elegir instancia → importar; y del drawer de login Bambu Cloud.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockResolve = vi.fn();
const mockImportOne = vi.fn();
const mockImportAll = vi.fn();
const mockAuthStatus = vi.fn();
const mockLogin = vi.fn();
const mockVerify = vi.fn();
const mockLogout = vi.fn();

vi.mock('../services/api', () => ({
  resolveMakerworldUrl: (...args) => mockResolve(...args),
  importMakerworldInstance: (...args) => mockImportOne(...args),
  importAllMakerworld: (...args) => mockImportAll(...args),
  makerworldThumbnailUrl: (url) => `/api/makerworld/thumbnail?url=${encodeURIComponent(url)}`,
  getMakerworldAuthStatus: (...args) => mockAuthStatus(...args),
  loginMakerworld: (...args) => mockLogin(...args),
  verifyMakerworld: (...args) => mockVerify(...args),
  logoutMakerworld: (...args) => mockLogout(...args),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn(), __esModule: true, default: vi.fn() },
}));

import MakerWorldImportModal from '../pages/vault/components/MakerWorldImportModal';
import IntegrationsDrawer from '../pages/settings/components/IntegrationsDrawer';

beforeEach(() => {
  mockResolve.mockReset();
  mockImportOne.mockReset();
  mockImportAll.mockReset();
  mockAuthStatus.mockReset();
  mockLogin.mockReset();
  mockVerify.mockReset();
  mockLogout.mockReset();
});

describe('MakerWorldImportModal', () => {
  it('resolver una URL muestra título, instancias y permite importar', async () => {
    mockResolve.mockResolvedValue({
      data: {
        design_id: 123,
        title: 'Figura genial',
        author: 'Autora X',
        images: [],
        instances: [{ id: 1, profile_id: 55, title: '0.2mm', thumbnail: null }],
        already_imported_model_ids: [],
      },
    });
    mockImportOne.mockResolvedValue({ data: {} });

    render(<MakerWorldImportModal hasCloudAuth folders={[]} onClose={() => {}} onImported={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText(/makerworld.com\/models/), {
      target: { value: 'https://makerworld.com/models/123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    await waitFor(() => expect(screen.getByText('Figura genial')).toBeInTheDocument());
    expect(mockResolve).toHaveBeenCalledWith('https://makerworld.com/models/123');

    fireEvent.click(screen.getByRole('button', { name: /Importar esta instancia/ }));
    await waitFor(() => expect(mockImportOne).toHaveBeenCalledWith(123, 55, null));
  });

  it('sin credenciales el botón de importar queda deshabilitado', async () => {
    mockResolve.mockResolvedValue({
      data: {
        design_id: 123, title: 'X', author: null, images: [],
        instances: [{ id: 1, profile_id: 9, title: 'p', thumbnail: null }],
        already_imported_model_ids: [],
      },
    });
    render(<MakerWorldImportModal hasCloudAuth={false} folders={[]} onClose={() => {}} onImported={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText(/makerworld.com\/models/), {
      target: { value: 'https://makerworld.com/models/123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    await waitFor(() => expect(screen.getByText('X')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Importar esta instancia/ })).toBeDisabled();
  });

  it('importar todas dispara importAllMakerworld', async () => {
    mockResolve.mockResolvedValue({
      data: {
        design_id: 5, title: 'Multi', author: null, images: [],
        instances: [
          { id: 1, profile_id: 10, title: 'a', thumbnail: null },
          { id: 2, profile_id: 20, title: 'b', thumbnail: null },
        ],
        already_imported_model_ids: [],
      },
    });
    mockImportAll.mockResolvedValue({ data: { imported: [{ ok: true }], failed: [] } });
    render(<MakerWorldImportModal hasCloudAuth folders={[]} onClose={() => {}} onImported={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText(/makerworld.com\/models/), { target: { value: 'https://makerworld.com/models/5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(screen.getByText('Multi')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Importar todas/ }));
    await waitFor(() => expect(mockImportAll).toHaveBeenCalledWith(5, null));
  });
});

describe('IntegrationsDrawer', () => {
  it('sin conectar muestra el form de login', async () => {
    mockAuthStatus.mockResolvedValue({ data: { configured: false } });
    render(<IntegrationsDrawer open onClose={() => {}} isMobile={false} />);
    await waitFor(() => expect(screen.getByPlaceholderText('Email de Bambu')).toBeInTheDocument());
  });

  it('login exitoso directo muestra conectado', async () => {
    mockAuthStatus
      .mockResolvedValueOnce({ data: { configured: false } })
      .mockResolvedValueOnce({ data: { configured: true, email_masked: 'g***@x.com' } });
    mockLogin.mockResolvedValue({ data: { status: 'ok', message: 'Login exitoso' } });
    render(<IntegrationsDrawer open onClose={() => {}} isMobile={false} />);
    await waitFor(() => expect(screen.getByPlaceholderText('Email de Bambu')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText('Email de Bambu'), { target: { value: 'g@x.com' } });
    fireEvent.change(screen.getByPlaceholderText('Contraseña'), { target: { value: 'pw' } });
    fireEvent.click(screen.getByRole('button', { name: 'Conectar' }));

    await waitFor(() => expect(screen.getByText(/Conectado como/)).toBeInTheDocument());
  });

  it('login que pide código muestra el input de verificación', async () => {
    mockAuthStatus.mockResolvedValue({ data: { configured: false } });
    mockLogin.mockResolvedValue({ data: { status: 'verify_code', message: 'Código enviado' } });
    render(<IntegrationsDrawer open onClose={() => {}} isMobile={false} />);
    await waitFor(() => expect(screen.getByPlaceholderText('Email de Bambu')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText('Email de Bambu'), { target: { value: 'g@x.com' } });
    fireEvent.change(screen.getByPlaceholderText('Contraseña'), { target: { value: 'pw' } });
    fireEvent.click(screen.getByRole('button', { name: 'Conectar' }));

    await waitFor(() => expect(screen.getByPlaceholderText('Código')).toBeInTheDocument());
  });

  it('desconectar dispara logoutMakerworld', async () => {
    mockAuthStatus.mockResolvedValue({ data: { configured: true, email_masked: 'g***@x.com' } });
    mockLogout.mockResolvedValue({});
    render(<IntegrationsDrawer open onClose={() => {}} isMobile={false} />);
    await waitFor(() => expect(screen.getByText(/Conectado como/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Desconectar' }));
    await waitFor(() => expect(mockLogout).toHaveBeenCalled());
  });
});
