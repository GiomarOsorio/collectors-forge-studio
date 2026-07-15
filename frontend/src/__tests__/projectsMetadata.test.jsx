/**
 * @file Tests de metadata de proyectos (issue #136, sub-ticket 1/3):
 * color, external_url, client_quote_id, foto de portada.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const mockGetProjects = vi.fn();
const mockCreateProject = vi.fn().mockResolvedValue({ data: {} });
const mockGetClientQuotes = vi.fn();
const mockUploadProjectCover = vi.fn();
const mockGetProjectFiles = vi.fn().mockResolvedValue({ data: [] });
const mockRemoveProjectFile = vi.fn().mockResolvedValue({});
const mockExportProject = vi.fn().mockResolvedValue(undefined);
const mockImportProject = vi.fn();

vi.mock('../services/api', () => ({
  getProjects: (...args) => mockGetProjects(...args),
  createProject: (...args) => mockCreateProject(...args),
  updateProject: vi.fn().mockResolvedValue({ data: {} }),
  deleteProject: vi.fn(),
  getProjectItems: vi.fn().mockResolvedValue({ data: [] }),
  getClientQuotes: (...args) => mockGetClientQuotes(...args),
  uploadProjectCover: (...args) => mockUploadProjectCover(...args),
  getProjectCoverUrl: (id) => `/api/projects/${id}/cover`,
  getProjectFiles: (...args) => mockGetProjectFiles(...args),
  removeProjectFile: (...args) => mockRemoveProjectFile(...args),
  exportProject: (...args) => mockExportProject(...args),
  importProject: (...args) => mockImportProject(...args),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import ProjectsPage from '../pages/projects/ProjectsPage';

function renderPage() {
  return render(
    <MemoryRouter>
      <ProjectsPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockGetProjects.mockReset();
  mockCreateProject.mockClear();
  mockGetClientQuotes.mockReset();
  mockUploadProjectCover.mockReset();
  mockGetProjectFiles.mockReset();
  mockRemoveProjectFile.mockClear();
  mockExportProject.mockClear();
  mockImportProject.mockReset();
});

describe('ProjectsPage — metadata', () => {
  it('crear con color + link externo + cotización dispara el payload correcto', async () => {
    mockGetProjects.mockResolvedValue({ data: [] });
    mockGetClientQuotes.mockResolvedValue({ data: [{ id: 7, client_name: 'Ana Gómez' }] });
    renderPage();
    await waitFor(() => expect(screen.getByText('Sin proyectos todavía')).toBeInTheDocument());

    const newProjectButtons = screen.getAllByRole('button', { name: /nuevo proyecto/i });
    fireEvent.click(newProjectButtons[newProjectButtons.length - 1]);
    await waitFor(() => expect(screen.getByText('Cotización vinculada')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(/Encargo boda/), { target: { value: 'Encargo X' } });
    fireEvent.change(screen.getByPlaceholderText(/makerworld.com/), { target: { value: 'https://makerworld.com/models/1' } });

    await waitFor(() => expect(screen.getByText(/COT-0007/)).toBeInTheDocument());
    fireEvent.change(screen.getByDisplayValue('Sin cotización vinculada'), { target: { value: '7' } });

    fireEvent.click(screen.getByLabelText('Color #F59E0B'));
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));

    await waitFor(() => expect(mockCreateProject).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Encargo X',
      external_url: 'https://makerworld.com/models/1',
      client_quote_id: 7,
      color: '#F59E0B',
    })));
  });

  it('muestra el badge de cotización vinculada en la card', async () => {
    mockGetProjects.mockResolvedValue({
      data: [{
        id: 1, name: 'Encargo Y', status: 'active', total_items: 0,
        pending_count: 0, printing_count: 0, done_count: 0, cancelled_count: 0,
        color: '#3B82F6', external_url: null, has_cover: false,
        client_quote_code: 'COT-0003', client_quote_client_name: 'Juan',
      }],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('COT-0003')).toBeInTheDocument());
  });

  it('subir portada dispara uploadProjectCover con el archivo', async () => {
    mockGetProjects.mockResolvedValue({
      data: [{
        id: 5, name: 'Encargo Z', status: 'active', total_items: 0,
        pending_count: 0, printing_count: 0, done_count: 0, cancelled_count: 0,
        color: null, external_url: null, has_cover: false,
      }],
    });
    mockGetClientQuotes.mockResolvedValue({ data: [] });
    mockUploadProjectCover.mockResolvedValue({ data: { has_cover: true } });
    renderPage();
    await waitFor(() => expect(screen.getByText('Encargo Z')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Opciones de proyecto'));
    fireEvent.click(screen.getByText('Editar'));
    await waitFor(() => expect(screen.getByText('Editar proyecto')).toBeInTheDocument());

    const file = new File(['fake'], 'cover.png', { type: 'image/png' });
    const input = screen.getByLabelText('Subir foto de portada');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(mockUploadProjectCover).toHaveBeenCalledWith(5, file));
  });

  it('abrir el detalle muestra archivos vinculados y quitar dispara removeProjectFile', async () => {
    mockGetProjects.mockResolvedValue({
      data: [{
        id: 3, name: 'Encargo W', status: 'active', total_items: 0,
        pending_count: 0, printing_count: 0, done_count: 0, cancelled_count: 0,
        color: null, external_url: null, has_cover: false,
      }],
    });
    mockGetProjectFiles.mockResolvedValue({
      data: [{ id: 20, name: 'Pieza.3mf', local_thumbnail_url: null, is_print_ready: true }],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Encargo W')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Encargo W'));
    await waitFor(() => expect(screen.getByText('Archivos vinculados (1)')).toBeInTheDocument());
    expect(screen.getByText('Pieza.3mf')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Quitar Pieza.3mf del proyecto'));
    await waitFor(() => expect(mockRemoveProjectFile).toHaveBeenCalledWith(3, 20));
  });

  it('exportar desde el menú de la card dispara exportProject', async () => {
    mockGetProjects.mockResolvedValue({
      data: [{
        id: 8, name: 'Encargo Export', status: 'active', total_items: 0,
        pending_count: 0, printing_count: 0, done_count: 0, cancelled_count: 0,
        color: null, external_url: null, has_cover: false,
      }],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Encargo Export')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Opciones de proyecto'));
    fireEvent.click(screen.getByText('Exportar'));

    await waitFor(() => expect(mockExportProject).toHaveBeenCalledWith(8, 'Encargo Export'));
  });

  it('importar un ZIP dispara importProject y recarga la lista', async () => {
    mockGetProjects.mockResolvedValue({ data: [] });
    mockImportProject.mockResolvedValue({ data: {} });
    renderPage();
    await waitFor(() => expect(screen.getByText('Sin proyectos todavía')).toBeInTheDocument());

    const zipFile = new File(['zip-fake'], 'proyecto.zip', { type: 'application/zip' });
    const input = screen.getByLabelText('Importar proyecto (ZIP)');
    fireEvent.change(input, { target: { files: [zipFile] } });

    await waitFor(() => expect(mockImportProject).toHaveBeenCalledWith(zipFile));
    await waitFor(() => expect(mockGetProjects).toHaveBeenCalledTimes(2)); // carga inicial + reload post-import
  });
});
