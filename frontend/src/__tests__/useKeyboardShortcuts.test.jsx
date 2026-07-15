/**
 * @file Tests del hook global de atajos de teclado (issue #140, pieza A):
 * secuencia g+letra navega, `?` abre ayuda, `/` enfoca búsqueda, se ignora
 * si el foco está en un input o hay un modal abierto.
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts';

function fireKey(key, target = document.body) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  Object.defineProperty(event, 'target', { value: target, enumerable: true });
  document.dispatchEvent(event);
}

function wrapper({ children }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

beforeEach(() => {
  mockNavigate.mockReset();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('useKeyboardShortcuts', () => {
  it('secuencia g+q navega a /queue', () => {
    renderHook(() => useKeyboardShortcuts(), { wrapper });
    act(() => {
      fireKey('g');
      fireKey('q');
    });
    expect(mockNavigate).toHaveBeenCalledWith('/queue');
  });

  it('secuencia g+v navega a /vault', () => {
    renderHook(() => useKeyboardShortcuts(), { wrapper });
    act(() => {
      fireKey('g');
      fireKey('v');
    });
    expect(mockNavigate).toHaveBeenCalledWith('/vault');
  });

  it('g seguido de tecla no mapeada no navega', () => {
    renderHook(() => useKeyboardShortcuts(), { wrapper });
    act(() => {
      fireKey('g');
      fireKey('z');
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('g expira tras 1s — segunda tecla suelta no navega', () => {
    renderHook(() => useKeyboardShortcuts(), { wrapper });
    act(() => {
      fireKey('g');
      vi.advanceTimersByTime(1001);
      fireKey('q');
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('? abre el modal de ayuda', () => {
    const { result } = renderHook(() => useKeyboardShortcuts(), { wrapper });
    expect(result.current.helpOpen).toBe(false);
    act(() => fireKey('?'));
    expect(result.current.helpOpen).toBe(true);
  });

  it('closeHelp cierra el modal', () => {
    const { result } = renderHook(() => useKeyboardShortcuts(), { wrapper });
    act(() => fireKey('?'));
    expect(result.current.helpOpen).toBe(true);
    act(() => result.current.closeHelp());
    expect(result.current.helpOpen).toBe(false);
  });

  it('/ enfoca el input con data-search-input', () => {
    const input = document.createElement('input');
    input.setAttribute('data-search-input', '');
    document.body.appendChild(input);
    const focusSpy = vi.spyOn(input, 'focus');

    renderHook(() => useKeyboardShortcuts(), { wrapper });
    act(() => fireKey('/'));

    expect(focusSpy).toHaveBeenCalled();
  });

  it('ignora atajos cuando el foco está en un input', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);

    renderHook(() => useKeyboardShortcuts(), { wrapper });
    act(() => {
      fireKey('g', input);
      fireKey('q', input);
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('ignora atajos cuando hay un modal abierto (role=dialog)', () => {
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    document.body.appendChild(dialog);

    renderHook(() => useKeyboardShortcuts(), { wrapper });
    act(() => {
      fireKey('g');
      fireKey('q');
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
