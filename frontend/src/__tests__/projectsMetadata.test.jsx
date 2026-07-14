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

vi.mock('../services/api', () => ({
  getProjects: (...args) => mockGetProjects(...args),
  createProject: (...args) => mockCreateProject(...args),
  updateProject: vi.fn().mockResolvedValue({ data: {} }),
  deleteProject: vi.fn(),
  getProjectItems: vi.fn().mockResolvedValue({ data: [] }),
  getClientQuotes: (...args) => mockGetClientQuotes(...args),
  uploadProjectCover: (...args) => mockUploadProjectCover(...args),
  getProjectCoverUrl: (id) => `/api/projects/${id}/cover`,
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
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(mockUploadProjectCover).toHaveBeenCalledWith(5, file));
  });
});
