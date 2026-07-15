/**
 * @file Tests de TimelineView (Gantt simple de Queue — issue #133).
 *
 * Cubre: mensaje sin impresoras, conteo de "sin programar", y la
 * detección de solapes (dos items del mismo printer con rangos que se
 * cruzan deben resaltarse en rojo; sin cruce, no).
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import TimelineView from '../pages/queue/components/TimelineView';

const PRINTERS = [
  { id: 1, name: 'Impresora A' },
  { id: 2, name: 'Impresora B' },
];

function vaultItem({ id, printerId, scheduledAt, hours = 2, name }) {
  return {
    id,
    status: 'pending',
    scheduled_at: scheduledAt,
    vault: {
      vault_model_id: id,
      name,
      printer_id: printerId,
      printer_name: null,
      filament_id: null,
      filament_name: null,
      print_time_hours: hours,
      quantity: 1,
    },
  };
}

describe('TimelineView', () => {
  it('muestra mensaje cuando no hay impresoras', () => {
    render(<TimelineView items={[]} printers={[]} />);
    expect(screen.getByText(/Sin impresoras registradas/i)).toBeInTheDocument();
  });

  it('renderiza una fila por impresora', () => {
    render(<TimelineView items={[]} printers={PRINTERS} />);
    expect(screen.getByText('Impresora A')).toBeInTheDocument();
    expect(screen.getByText('Impresora B')).toBeInTheDocument();
  });

  it('cuenta items sin scheduled_at o sin printer_id como "sin programar"', () => {
    const items = [
      vaultItem({ id: 1, printerId: 1, scheduledAt: null, name: 'Sin fecha' }),
      vaultItem({ id: 2, printerId: null, scheduledAt: '2026-08-01T10:00:00', name: 'Sin printer' }),
      vaultItem({ id: 3, printerId: 1, scheduledAt: '2026-08-01T10:00:00', name: 'Programado' }),
    ];
    render(<TimelineView items={items} printers={PRINTERS} />);
    expect(screen.getByText(/2 items sin programar/)).toBeInTheDocument();
    expect(screen.getByTitle(/Programado/)).toBeInTheDocument();
  });

  it('NO marca solape cuando los rangos de la misma impresora no se cruzan', () => {
    const items = [
      vaultItem({ id: 1, printerId: 1, scheduledAt: '2026-08-01T08:00:00', hours: 2, name: 'Item A' }),
      vaultItem({ id: 2, printerId: 1, scheduledAt: '2026-08-01T11:00:00', hours: 2, name: 'Item B' }),
    ];
    render(<TimelineView items={items} printers={PRINTERS} />);
    const barA = screen.getByTitle(/Item A/);
    const barB = screen.getByTitle(/Item B/);
    expect(barA.className).not.toContain('border-rose-500');
    expect(barB.className).not.toContain('border-rose-500');
  });

  it('marca solape cuando dos items de la MISMA impresora se cruzan en el tiempo', () => {
    const items = [
      vaultItem({ id: 1, printerId: 1, scheduledAt: '2026-08-01T08:00:00', hours: 3, name: 'Item A' }),
      vaultItem({ id: 2, printerId: 1, scheduledAt: '2026-08-01T09:00:00', hours: 2, name: 'Item B' }),
    ];
    render(<TimelineView items={items} printers={PRINTERS} />);
    const barA = screen.getByTitle(/Item A/);
    const barB = screen.getByTitle(/Item B/);
    expect(barA.className).toContain('border-rose-500');
    expect(barB.className).toContain('border-rose-500');
  });

  it('NO marca solape entre items que se cruzan en el tiempo pero en impresoras DISTINTAS', () => {
    const items = [
      vaultItem({ id: 1, printerId: 1, scheduledAt: '2026-08-01T08:00:00', hours: 3, name: 'Item A' }),
      vaultItem({ id: 2, printerId: 2, scheduledAt: '2026-08-01T09:00:00', hours: 2, name: 'Item B' }),
    ];
    render(<TimelineView items={items} printers={PRINTERS} />);
    const barA = screen.getByTitle(/Item A/);
    const barB = screen.getByTitle(/Item B/);
    expect(barA.className).not.toContain('border-rose-500');
    expect(barB.className).not.toContain('border-rose-500');
  });
});
