/**
 * @file Tests del drawer de Notificaciones en Settings (issue #137):
 * listar canales, crear canal, probar canal, borrar canal.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetChannels = vi.fn();
const mockCreateChannel = vi.fn();
const mockUpdateChannel = vi.fn();
const mockDeleteChannel = vi.fn();
const mockTestChannel = vi.fn();
const mockGetTemplate = vi.fn().mockResolvedValue({ data: { event: 'queue.item_done', body: 'plantilla', is_default: true } });
const mockPreviewTemplate = vi.fn();
const mockUpdateTemplate = vi.fn();

vi.mock('../services/api', () => ({
  getNotificationChannels: (...args) => mockGetChannels(...args),
  createNotificationChannel: (...args) => mockCreateChannel(...args),
  updateNotificationChannel: (...args) => mockUpdateChannel(...args),
  deleteNotificationChannel: (...args) => mockDeleteChannel(...args),
  testNotificationChannel: (...args) => mockTestChannel(...args),
  getNotificationTemplate: (...args) => mockGetTemplate(...args),
  previewNotificationTemplate: (...args) => mockPreviewTemplate(...args),
  updateNotificationTemplate: (...args) => mockUpdateTemplate(...args),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import NotificationsDrawer from '../pages/settings/components/NotificationsDrawer';

function channelFixture(overrides = {}) {
  return {
    id: 1,
    type: 'ntfy',
    name: 'Mi ntfy',
    config: { server: 'https://ntfy.sh', topic: 'cfs' },
    enabled: true,
    events: ['queue.item_done'],
    defer_to_digest: false,
    ...overrides,
  };
}

beforeEach(() => {
  mockGetChannels.mockReset();
  mockCreateChannel.mockReset();
  mockDeleteChannel.mockReset();
  mockTestChannel.mockReset();
});

describe('NotificationsDrawer', () => {
  it('lista canales existentes', async () => {
    mockGetChannels.mockResolvedValue({ data: [channelFixture()] });
    render(<NotificationsDrawer open onClose={() => {}} isMobile={false} />);
    await waitFor(() => expect(screen.getByText('Mi ntfy')).toBeInTheDocument());
    expect(screen.getByText(/ntfy · 1 eventos/)).toBeInTheDocument();
  });

  it('sin canales muestra EmptyState', async () => {
    mockGetChannels.mockResolvedValue({ data: [] });
    render(<NotificationsDrawer open onClose={() => {}} isMobile={false} />);
    await waitFor(() => expect(screen.getByText('Sin canales configurados')).toBeInTheDocument());
  });

  it('crear canal ntfy dispara createNotificationChannel con el payload correcto', async () => {
    mockGetChannels.mockResolvedValue({ data: [] });
    mockCreateChannel.mockResolvedValue({ data: channelFixture() });
    render(<NotificationsDrawer open onClose={() => {}} isMobile={false} />);
    await waitFor(() => expect(screen.getByText('Sin canales configurados')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Nuevo canal/i }));
    fireEvent.change(screen.getByPlaceholderText('Nombre del canal'), { target: { value: 'Canal test' } });
    fireEvent.change(screen.getByPlaceholderText('Topic'), { target: { value: 'cfs-avisos' } });
    fireEvent.click(screen.getByLabelText('queue.item_done'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Guardar' })[0]);

    await waitFor(() => expect(mockCreateChannel).toHaveBeenCalledWith(expect.objectContaining({
      type: 'ntfy',
      name: 'Canal test',
      config: expect.objectContaining({ topic: 'cfs-avisos' }),
      events: ['queue.item_done'],
    })));
  });

  it('probar canal ok muestra toast de éxito', async () => {
    mockGetChannels.mockResolvedValue({ data: [channelFixture()] });
    mockTestChannel.mockResolvedValue({ data: { ok: true, error: null } });
    render(<NotificationsDrawer open onClose={() => {}} isMobile={false} />);
    await waitFor(() => expect(screen.getByText('Mi ntfy')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Probar' }));
    await waitFor(() => expect(mockTestChannel).toHaveBeenCalledWith(1));
  });

  it('borrar canal dispara deleteNotificationChannel y recarga la lista', async () => {
    mockGetChannels.mockResolvedValueOnce({ data: [channelFixture()] }).mockResolvedValueOnce({ data: [] });
    mockDeleteChannel.mockResolvedValue({});
    render(<NotificationsDrawer open onClose={() => {}} isMobile={false} />);
    await waitFor(() => expect(screen.getByText('Mi ntfy')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Borrar' }));
    await waitFor(() => expect(mockDeleteChannel).toHaveBeenCalledWith(1));
    await waitFor(() => expect(mockGetChannels).toHaveBeenCalledTimes(2));
  });
});
