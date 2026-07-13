/**
 * @file Tests del flujo de auto-login/auto-redirect de Login.jsx (issue #143).
 *
 * `IS_DEV` (`import.meta.env.DEV`) se captura una sola vez al nivel de
 * módulo — bajo vitest por defecto es `true` (mismo criterio que Vite:
 * DEV=true salvo mode==='production'), lo que desactivaría justo la rama
 * que queremos probar (`!IS_DEV`). Se stubea a `false` con `vi.stubEnv` y
 * se importa el módulo dinámicamente en cada test (`vi.resetModules()` +
 * `await import(...)`) para que la constante se recalcule con el stub ya
 * aplicado — un `import` estático normal se hoistea antes de que el stub
 * corra y no sirve acá.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  getDevLoginStatus: vi.fn(),
}));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ loginUser: vi.fn() }),
  DEV_BYPASS_TOKEN: 'dev-bypass',
  DEV_BYPASS_USER: { id: 0, username: 'dev', role: 'admin' },
}));

import { getDevLoginStatus } from '../services/api';

async function renderLogin(path = '/login') {
  vi.resetModules();
  vi.stubEnv('DEV', false);
  const { default: Login } = await import('../pages/Login');
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<Login />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Login — auto-redirect dev/prod (issue #143)', () => {
  beforeEach(() => {
    delete window.location;
    window.location = { href: '' };
    vi.unstubAllEnvs();
  });

  it('dev-login habilitado y sin error: auto-redirige a /api/auth/oidc/dev-login', async () => {
    getDevLoginStatus.mockResolvedValue({ data: { enabled: true } });
    await renderLogin('/login');
    await waitFor(() => {
      expect(window.location.href).toBe('/api/auth/oidc/dev-login');
    });
    // Mientras tanto se muestra el spinner "Entrando (dev)…", no el form.
    expect(screen.getByText('Entrando (dev)…')).toBeInTheDocument();
  });

  it('dev-login deshabilitado y sin error: auto-redirige a /api/auth/oidc/login (prod sin cambios)', async () => {
    getDevLoginStatus.mockResolvedValue({ data: { enabled: false } });
    await renderLogin('/login');
    await waitFor(() => {
      expect(window.location.href).toBe('/api/auth/oidc/login');
    });
  });

  it('con ?error=: NO auto-redirige (ni a dev-login ni a Authentik), muestra tarjeta + botón dev', async () => {
    getDevLoginStatus.mockResolvedValue({ data: { enabled: true } });
    await renderLogin('/login?error=oidc_callback_failed');
    await waitFor(() => {
      expect(screen.getByText('Iniciar sesión (dev, sin SSO)')).toBeInTheDocument();
    });
    expect(window.location.href).toBe('');
    expect(screen.getByText('Reintentar inicio de sesión')).toBeInTheDocument();
  });

  it('con ?error= y dev-login deshabilitado: NO auto-redirige, muestra tarjeta sin botón dev', async () => {
    getDevLoginStatus.mockResolvedValue({ data: { enabled: false } });
    await renderLogin('/login?error=user_inactive');
    await waitFor(() => {
      expect(screen.getByText('Reintentar inicio de sesión')).toBeInTheDocument();
    });
    expect(window.location.href).toBe('');
    expect(screen.queryByText('Iniciar sesión (dev, sin SSO)')).not.toBeInTheDocument();
  });
});
