/**
 * @file Tests de `SchedulesSection` (issue #138) — recordatorios de
 * mantenimiento por intervalo.
 *
 * Cubre: empty state, alta con preset rellenando el form, submit dispara
 * `createMaintenanceSchedule` con el payload correcto, completar dispara
 * `completeMaintenanceSchedule`.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetSchedules = vi.fn();
const mockCreateSchedule = vi.fn().mockResolvedValue({ data: {} });
const mockCompleteSchedule = vi.fn().mockResolvedValue({ data: {} });

vi.mock('../services/api', () => ({
  getMaintenanceSchedules: (...args) => mockGetSchedules(...args),
  createMaintenanceSchedule: (...args) => mockCreateSchedule(...args),
  updateMaintenanceSchedule: vi.fn().mockResolvedValue({ data: {} }),
  deleteMaintenanceSchedule: vi.fn().mockResolvedValue({}),
  completeMaintenanceSchedule: (...args) => mockCompleteSchedule(...args),
}));

vi.mock('../components/ConfirmDialog', () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import SchedulesSection from '../pages/maintenance/components/SchedulesSection';

const PRINTERS = [{ id: 1, name: 'P2S del estudio', current_hours: 120 }];

function scheduleFixture(overrides = {}) {
  return {
    id: 1,
    printer_id: 1,
    printer_name: 'P2S del estudio',
    task_name: 'Lubricar ejes XY',
    description: null,
    interval_type: 'print_hours',
    interval_value: 300,
    last_done_at: '2026-01-01T00:00:00',
    last_done_hours: 0,
    enabled: true,
    created_at: '2026-01-01T00:00:00',
    updated_at: '2026-01-01T00:00:00',
    progress_pct: 83.3,
    status: 'due_soon',
    ...overrides,
  };
}

beforeEach(() => {
  mockGetSchedules.mockReset();
  mockCreateSchedule.mockClear();
  mockCompleteSchedule.mockClear();
});

describe('SchedulesSection', () => {
  it('muestra empty state cuando no hay recordatorios', async () => {
    mockGetSchedules.mockResolvedValue({ data: [] });
    render(<SchedulesSection printers={PRINTERS} isMobile={false} />);
    await waitFor(() => expect(screen.getByText('Sin recordatorios')).toBeInTheDocument());
  });

  it('renderiza un recordatorio con su % de progreso y status', async () => {
    mockGetSchedules.mockResolvedValue({ data: [scheduleFixture()] });
    render(<SchedulesSection printers={PRINTERS} isMobile={false} />);
    await waitFor(() => expect(screen.getByText('Lubricar ejes XY')).toBeInTheDocument());
    expect(screen.getByText('Pronto')).toBeInTheDocument();
    expect(screen.getByText('83%')).toBeInTheDocument();
  });

  it('alta con preset rellena el form y crea con el payload correcto', async () => {
    mockGetSchedules.mockResolvedValue({ data: [] });
    render(<SchedulesSection printers={PRINTERS} isMobile={false} />);
    await waitFor(() => expect(screen.getByText('Sin recordatorios')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Crear el primero' }));
    await waitFor(() => expect(screen.getByText('Nuevo recordatorio')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Cambiar boquilla' }));
    fireEvent.click(screen.getByRole('button', { name: 'Crear recordatorio' }));

    await waitFor(() => expect(mockCreateSchedule).toHaveBeenCalledWith({
      printer_id: 1,
      task_name: 'Cambiar boquilla',
      description: null,
      interval_type: 'print_hours',
      interval_value: 1000,
    }));
  });

  it('completar dispara completeMaintenanceSchedule con el id correcto', async () => {
    mockGetSchedules.mockResolvedValue({ data: [scheduleFixture({ id: 42 })] });
    render(<SchedulesSection printers={PRINTERS} isMobile={false} />);
    await waitFor(() => expect(screen.getByText('Lubricar ejes XY')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Más acciones' }));
    fireEvent.click(screen.getByRole('button', { name: 'Marcar hecho' }));

    await waitFor(() => expect(mockCompleteSchedule).toHaveBeenCalledWith(42));
  });
});
