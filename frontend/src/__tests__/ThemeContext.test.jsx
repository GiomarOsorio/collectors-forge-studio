/**
 * @file Tests de ThemeContext (claro/oscuro/sistema) — issue #126.
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThemeProvider, useTheme } from '../context/ThemeContext';

function mockMatchMedia(matches) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function wrapper({ children }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

describe('ThemeContext', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.className = '';
    mockMatchMedia(false);
  });

  it('modo default es dark sin preferencia previa en localStorage', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.mode).toBe('dark');
    expect(result.current.resolvedMode).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('lee el modo persistido en localStorage al montar', () => {
    window.localStorage.setItem('cfs-theme', 'light');
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.mode).toBe('light');
    expect(result.current.resolvedMode).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('setMode actualiza resolvedMode, clase dark en <html> y localStorage', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => result.current.setMode('light'));
    expect(result.current.mode).toBe('light');
    expect(result.current.resolvedMode).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(window.localStorage.getItem('cfs-theme')).toBe('light');
  });

  it('modo system resuelve según la preferencia del SO (matchMedia)', () => {
    window.localStorage.setItem('cfs-theme', 'system');
    mockMatchMedia(true); // SO prefiere dark
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.mode).toBe('system');
    expect(result.current.resolvedMode).toBe('dark');
  });

  it('toggleMode cicla dark → light → system → dark', () => {
    window.localStorage.setItem('cfs-theme', 'dark');
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.mode).toBe('dark');
    act(() => result.current.toggleMode());
    expect(result.current.mode).toBe('light');
    act(() => result.current.toggleMode());
    expect(result.current.mode).toBe('system');
    act(() => result.current.toggleMode());
    expect(result.current.mode).toBe('dark');
  });

  it('useTheme fuera de ThemeProvider lanza error', () => {
    // Silencia el console.error que React imprime por el throw durante el render.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useTheme())).toThrow(
      'useTheme must be used within ThemeProvider',
    );
    spy.mockRestore();
  });
});
