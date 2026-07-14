/**
 * @file Tests del flujo de impresión de etiquetas de bobinas (issue #135):
 * selección múltiple → modal de plantilla → printSpoolLabels con los ids
 * correctos → abre el PDF (blob) en una pestaña nueva.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const mockGetSpools = vi.fn();
const mockGetSpoolsLowStock = vi.fn().mockResolvedValue({ data: [] });
const mockGetInventoryItems = vi.fn().mockResolvedValue({ data: [] });
const mockPrintSpoolLabels = vi.fn();

vi.mock('../services/api', () => ({
  getSpools: (...args) => mockGetSpools(...args),
  getSpoolsLowStock: (...args) => mockGetSpoolsLowStock(...args),
  getInventoryItems: (...args) => mockGetInventoryItems(...args),
  printSpoolLabels: (...args) => mockPrintSpoolLabels(...args),
  createSpools: vi.fn(),
  updateSpool: vi.fn(),
  deleteSpool: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import InventorySpoolsPage from '../pages/inventory/InventorySpoolsPage';

function spoolFixture(id, overrides = {}) {
  return {
    id,
    inventory_item_id: 1,
    label_code: `SP-${String(id).padStart(4, '0')}`,
    initial_weight_g: 1000,
    remaining_weight_g: 650,
    percent_remaining: 65,
    cost: 25,
    effective_cost_per_kg: 25,
    extra_colors: null,
    visual_effect: null,
    status: 'active',
    opened_at: null,
    finished_at: null,
    notes: null,
    created_at: '2026-07-01T10:00:00',
    updated_at: '2026-07-01T10:00:00',
    inventory_item_name: 'PLA Negro Marca X',
    color_hex: '#111111',
    color_name: 'Carbon Black',
    filament_type: 'PLA',
    filament_brand: 'Marca X',
    filament_subtype: null,
    ...overrides,
  };
}

beforeEach(() => {
  mockGetSpools.mockReset();
  mockPrintSpoolLabels.mockReset();
  global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  global.open = vi.fn();
});

function renderPage() {
  return render(
    <MemoryRouter>
      <InventorySpoolsPage />
    </MemoryRouter>,
  );
}

describe('InventorySpoolsPage — impresión de etiquetas', () => {
  it('seleccionar bobinas muestra la barra de acción con el conteo', async () => {
    mockGetSpools.mockResolvedValue({ data: [spoolFixture(1), spoolFixture(2)] });
    renderPage();
    await waitFor(() => expect(screen.getByText('SP-0001')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Seleccionar SP-0001'));
    expect(screen.getByText('1 bobina seleccionada')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Seleccionar SP-0002'));
    expect(screen.getByText('2 bobinas seleccionadas')).toBeInTheDocument();
  });

  it('imprimir dispara printSpoolLabels con los ids y plantilla correctos y abre el PDF', async () => {
    mockGetSpools.mockResolvedValue({ data: [spoolFixture(1), spoolFixture(2)] });
    mockPrintSpoolLabels.mockResolvedValue({ data: new Blob(['%PDF'], { type: 'application/pdf' }) });
    renderPage();
    await waitFor(() => expect(screen.getByText('SP-0001')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Seleccionar SP-0001'));
    fireEvent.click(screen.getByLabelText('Seleccionar SP-0002'));
    fireEvent.click(screen.getByRole('button', { name: /Imprimir etiquetas/i }));

    await waitFor(() => expect(screen.getByText('Avery 5160 (US Letter)')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /^Imprimir$/i }));

    await waitFor(() => expect(mockPrintSpoolLabels).toHaveBeenCalledWith({
      spool_ids: [1, 2],
      template: 'box_62x29',
      monochrome: false,
    }));
    expect(global.open).toHaveBeenCalledWith('blob:mock-url', '_blank');
  });
});
