/**
 * @file Tests de `StatsPage` (issue #132) — render de KPIs con datos
 * mockeados, empty state sin datos, export CSV dispara la descarga.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const mockGetOverview = vi.fn();
const mockGetTrends = vi.fn();
const mockDownloadOverview = vi.fn().mockResolvedValue(undefined);

vi.mock('../services/api', () => ({
  getStatsOverview: (...args) => mockGetOverview(...args),
  getStatsTrends: (...args) => mockGetTrends(...args),
  downloadStatsOverviewCsv: (...args) => mockDownloadOverview(...args),
  downloadStatsTrendsCsv: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import StatsPage from '../pages/stats/StatsPage';

function overviewFixture(overrides = {}) {
  return {
    prints_done: 3,
    prints_cancelled: 1,
    success_rate_pct: 75,
    total_hours: 9,
    grams_by_filament_type: [
      { filament_type: 'PLA', grams: 250, cost_cop: 5000 },
      { filament_type: 'PETG', grams: 200, cost_cop: 6000 },
    ],
    by_printer: [{ printer_id: 1, printer_name: 'P2S', prints: 2, hours: 7 }],
    by_user: [{ user_id: 1, username: 'giomar', prints: 3 }],
    failure_breakdown: [{ category: 'warping', count: 1 }],
    material_cost_cop: 11000,
    electricity_cost_cop: 2000,
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <StatsPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockGetOverview.mockReset();
  mockGetTrends.mockReset();
  mockDownloadOverview.mockClear();
});

describe('StatsPage', () => {
  it('renderiza KPIs con datos del overview', async () => {
    mockGetOverview.mockResolvedValue({ data: overviewFixture() });
    mockGetTrends.mockResolvedValue({ data: { bucket: 'day', series: [] } });
    renderPage();
    await waitFor(() => expect(screen.getByText('75.0%')).toBeInTheDocument());
    expect(screen.getByText(/3 listas/)).toBeInTheDocument();
  });

  it('muestra empty state sin impresiones en el rango', async () => {
    mockGetOverview.mockResolvedValue({ data: overviewFixture({ prints_done: 0, prints_cancelled: 0 }) });
    mockGetTrends.mockResolvedValue({ data: { bucket: 'day', series: [] } });
    renderPage();
    await waitFor(() => expect(screen.getByText('Sin datos en el rango seleccionado')).toBeInTheDocument());
  });

  it('exportar overview dispara downloadStatsOverviewCsv', async () => {
    mockGetOverview.mockResolvedValue({ data: overviewFixture() });
    mockGetTrends.mockResolvedValue({ data: { bucket: 'day', series: [] } });
    renderPage();
    await waitFor(() => expect(screen.getByText('75.0%')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Exportar overview CSV/i }));
    await waitFor(() => expect(mockDownloadOverview).toHaveBeenCalled());
  });
});
