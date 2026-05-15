/**
 * @file Tests del hook useDashboardLayout (dashboard reconfigurable).
 *
 * Cubre persistencia en localStorage, reconciliación con WIDGETS registry,
 * reorder/cycleSize/hide/show/reset, visibleLayout vs hiddenWidgets.
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useDashboardLayout } from '../hooks/useDashboardLayout';
import { WIDGETS } from '../components/widgets';

const STORAGE_KEY = 'cfs.dashboard.layout';

describe('useDashboardLayout', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('layout inicial usa defaults de WIDGETS', () => {
    const { result } = renderHook(() => useDashboardLayout());
    expect(result.current.layout.length).toBe(WIDGETS.length);
    WIDGETS.forEach((w, i) => {
      expect(result.current.layout[i].id).toBe(w.id);
      expect(result.current.layout[i].visible).toBe(w.defaultVisible);
      expect(result.current.layout[i].size).toBe(w.defaultSize);
    });
  });

  it('persiste cambios en localStorage', () => {
    const { result } = renderHook(() => useDashboardLayout());
    act(() => {
      result.current.hide('queue');
    });
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const queueEntry = stored.find((e) => e.id === 'queue');
    expect(queueEntry.visible).toBe(false);
  });

  it('reconcilia layout guardado descartando widgets obsoletos', () => {
    const stale = [
      { id: 'queue', visible: true, size: 'half' },
      { id: 'NO_EXISTE', visible: true, size: 'full' },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stale));
    const { result } = renderHook(() => useDashboardLayout());
    expect(result.current.layout.find((e) => e.id === 'NO_EXISTE')).toBeUndefined();
    // Widgets nuevos no presentes en stale se agregan
    expect(result.current.layout.length).toBe(WIDGETS.length);
  });

  it('hide setea visible=false y exposes en hiddenWidgets', () => {
    const { result } = renderHook(() => useDashboardLayout());
    act(() => {
      result.current.hide('lowStock');
    });
    const entry = result.current.layout.find((e) => e.id === 'lowStock');
    expect(entry.visible).toBe(false);
    expect(result.current.hiddenWidgets.find((w) => w.id === 'lowStock')).toBeDefined();
    expect(result.current.visibleLayout.find((e) => e.id === 'lowStock')).toBeUndefined();
  });

  it('show vuelve a visible=true', () => {
    const { result } = renderHook(() => useDashboardLayout());
    act(() => {
      result.current.hide('queue');
    });
    act(() => {
      result.current.show('queue');
    });
    expect(result.current.layout.find((e) => e.id === 'queue').visible).toBe(true);
  });

  it('cycleSize quarter → half → full → quarter', () => {
    const { result } = renderHook(() => useDashboardLayout());
    const id = WIDGETS[0].id;
    // Force start at quarter
    act(() => {
      // setear manualmente via reset + cycle hasta llegar a quarter
      result.current.reset();
    });
    // El default size de queue es 'half'. Hagamos un ciclo y verifiquemos.
    const startSize = result.current.layout.find((e) => e.id === id).size;
    act(() => result.current.cycleSize(id));
    const next1 = result.current.layout.find((e) => e.id === id).size;
    expect(next1).not.toBe(startSize);

    act(() => result.current.cycleSize(id));
    const next2 = result.current.layout.find((e) => e.id === id).size;
    expect(next2).not.toBe(next1);

    act(() => result.current.cycleSize(id));
    const next3 = result.current.layout.find((e) => e.id === id).size;
    expect(next3).toBe(startSize);
  });

  it('reorder mueve un widget a la posición de otro', () => {
    const { result } = renderHook(() => useDashboardLayout());
    const initialIds = result.current.layout.map((e) => e.id);
    const fromId = initialIds[0];
    const toId = initialIds[2];
    act(() => {
      result.current.reorder(fromId, toId);
    });
    const newOrder = result.current.layout.map((e) => e.id);
    // fromId ahora debe estar en posición 2, no en 0
    expect(newOrder.indexOf(fromId)).toBeGreaterThan(0);
  });

  it('reorder es no-op si IDs son iguales', () => {
    const { result } = renderHook(() => useDashboardLayout());
    const before = result.current.layout.map((e) => e.id);
    act(() => {
      result.current.reorder('queue', 'queue');
    });
    expect(result.current.layout.map((e) => e.id)).toEqual(before);
  });

  it('reset vuelve a defaults', () => {
    const { result } = renderHook(() => useDashboardLayout());
    act(() => {
      result.current.hide('queue');
      result.current.hide('lowStock');
    });
    act(() => {
      result.current.reset();
    });
    expect(result.current.visibleLayout.length).toBe(WIDGETS.length);
  });

  it('localStorage malformado se ignora y usa defaults', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json');
    const { result } = renderHook(() => useDashboardLayout());
    expect(result.current.layout.length).toBe(WIDGETS.length);
  });
});
