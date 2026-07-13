/**
 * @file Contexto de tema (claro/oscuro/sistema) para Collector's Forge Studio.
 *
 * Persiste la preferencia en localStorage (`cfs-theme`) y aplica la clase
 * `dark` a `<html>` — el resto del theming (colores, superficies, bordes)
 * vive en `index.css` como variables CSS que reaccionan a esa clase.
 *
 * A diferencia de bambuddy, este contexto NO sincroniza con el backend:
 * CFS no tiene configuración de apariencia por-usuario en el servidor, solo
 * preferencia local del navegador.
 *
 * El primer paint ya aplica la clase correcta gracias al script inline en
 * `index.html` (anti-flash) — este contexto solo mantiene el estado en React
 * y reacciona a cambios posteriores (toggle manual, cambio de preferencia
 * del sistema operativo).
 *
 * @module context/ThemeContext
 */

import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

const STORAGE_KEY = 'cfs-theme';

/**
 * Lee la preferencia de tema guardada en localStorage.
 * @returns {'light'|'dark'|'system'}
 */
function readStoredMode() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    /* localStorage no disponible (modo privado, SSR, etc.) */
  }
  return 'dark';
}

/**
 * Lee la preferencia de color del sistema operativo.
 * @returns {'light'|'dark'}
 */
function readSystemPreference() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Proveedor del contexto de tema.
 * Envuelve la aplicación para dar acceso al modo de tema y su toggle
 * a todos los componentes hijos.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children
 */
export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(readStoredMode);
  const [systemPreference, setSystemPreference] = useState(readSystemPreference);

  // Escucha cambios en la preferencia de color del SO mientras mode==='system'.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => setSystemPreference(e.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  /** Modo efectivamente aplicado: 'system' se resuelve a light/dark real. */
  const resolvedMode = mode === 'system' ? systemPreference : mode;

  // Aplica la clase `dark` a <html> y persiste la preferencia.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedMode === 'dark');
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* localStorage no disponible */
    }
  }, [mode, resolvedMode]);

  /**
   * Fija el modo explícitamente.
   * @param {'light'|'dark'|'system'} next
   */
  const setMode = (next) => setModeState(next);

  /** Cicla dark → light → system → dark. */
  const toggleMode = () => {
    setModeState((prev) => {
      if (prev === 'dark') return 'light';
      if (prev === 'light') return 'system';
      return 'dark';
    });
  };

  return (
    <ThemeContext.Provider value={{ mode, resolvedMode, setMode, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook para acceder al contexto de tema.
 * Debe usarse dentro de un árbol envuelto por ThemeProvider.
 *
 * @returns {{ mode: 'light'|'dark'|'system', resolvedMode: 'light'|'dark', setMode: Function, toggleMode: Function }}
 */
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
