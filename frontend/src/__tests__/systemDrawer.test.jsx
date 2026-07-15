/**
 * @file Tests del drawer de Sistema en Settings (issue #140, pieza C).
 */

import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetSystemInfo = vi.fn();
const mockGetSystemLogs = vi.fn();

vi.mock('../services/api', () => ({
  getSystemInfo: (...args) => mockGetSystemInfo(...args),
  getSystemLogs: (...args) => mockGetSystemLogs(...args),
}));

import SystemDrawer from '../pages/settings/components/SystemDrawer';

const INFO_FIXTURE = {
  version: 'abc123def456',
  uptime_seconds: 3725,
  db: {
    size_pretty: '45 MB',
    top_tables: [{ name: 'print_queue', size_pretty: '10 MB', size_bytes: 10485760 }],
  },
  minio: { used_bytes: 5242880 },
  counts: { model_files: 12, queue_items_done: 34, client_quotes: 5, spools: 8 },
  migrations: { current: 'abc123', head: 'abc123', up_to_date: true },
};

beforeEach(() => {
  mockGetSystemInfo.mockReset();
  mockGetSystemLogs.mockReset();
  mockGetSystemLogs.mockResolvedValue({ data: [] });
});

describe('SystemDrawer', () => {
  it('muestra versión, uptime, BD, MinIO, conteos y migraciones al día', async () => {
    mockGetSystemInfo.mockResolvedValue({ data: INFO_FIXTURE });
    render(<SystemDrawer open onClose={() => {}} isMobile={false} />);

    await waitFor(() => expect(screen.getByText('abc123def456')).toBeInTheDocument());
    expect(screen.getByText('1h 2m')).toBeInTheDocument();
    expect(screen.getByText('45 MB')).toBeInTheDocument();
    expect(screen.getByText('print_queue')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText(/al día/)).toBeInTheDocument();
  });

  it('migraciones desactualizadas muestra badge rojo', async () => {
    mockGetSystemInfo.mockResolvedValue({
      data: { ...INFO_FIXTURE, migrations: { current: 'old', head: 'new', up_to_date: false } },
    });
    render(<SystemDrawer open onClose={() => {}} isMobile={false} />);
    await waitFor(() => expect(screen.getByText(/desactualizada/)).toBeInTheDocument());
  });

  it('carga logs al abrir', async () => {
    mockGetSystemInfo.mockResolvedValue({ data: INFO_FIXTURE });
    mockGetSystemLogs.mockResolvedValue({
      data: [{ ts: '2026-07-15T10:00:00', level: 'ERROR', logger: 'app', msg: 'algo falló' }],
    });
    render(<SystemDrawer open onClose={() => {}} isMobile={false} />);
    await waitFor(() => expect(screen.getByText('algo falló')).toBeInTheDocument());
    expect(mockGetSystemLogs).toHaveBeenCalledWith('', 200);
  });
});
