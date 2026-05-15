/**
 * @file Tests para el hook `useMediaQuery` + atajo `useIsMobile`.
 *
 * Valida que useIsMobile devuelve true cuando matchMedia reporta
 * `(max-width: 1023px)` y false cuando no — esto es lo que decide
 * que pantallas reciben el shell mobile (hero gradient + bottom nav + FAB)
 * vs el shell desktop (sidebar fija + sticky toolbar).
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useIsMobile, useMediaQuery } from '../hooks/useMediaQuery';

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

describe('useMediaQuery', () => {
  beforeEach(() => {
    mockMatchMedia(false);
  });

  it('retorna false cuando la query CSS no coincide', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery('(max-width: 500px)'));
    expect(result.current).toBe(false);
  });

  it('retorna true cuando la query CSS coincide', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery('(max-width: 500px)'));
    expect(result.current).toBe(true);
  });
});

describe('useIsMobile', () => {
  it('es true para viewports ≤ 1023px (debajo de Tailwind lg)', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('es false para viewports ≥ 1024px', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });
});
