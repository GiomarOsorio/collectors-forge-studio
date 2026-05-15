/**
 * @file Configuración global para los tests de Vitest.
 *
 * Importa los matchers de @testing-library/jest-dom para tener
 * aserciones como toBeInTheDocument(), toHaveClass(), etc.
 * También configura mocks globales necesarios para el entorno jsdom.
 */

import '@testing-library/jest-dom';

// Mock de window.matchMedia — jsdom no lo implementa pero react-router y otros lo usan
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock de ResizeObserver — jsdom no lo implementa pero @dnd-kit/core lo usa con `new`.
// Definir como class para que el constructor funcione correctamente.
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// jsdom + vitest 4 a veces dejan localStorage como objeto sin setItem.
// Garantizar un mock en memoria para que componentes que persisten estado
// (StudioSidebar, Dashboard layout, etc.) no exploten en los tests.
const localStorageStore = {};
const localStorageMock = {
  getItem: (key) => (key in localStorageStore ? localStorageStore[key] : null),
  setItem: (key, value) => {
    localStorageStore[key] = String(value);
  },
  removeItem: (key) => {
    delete localStorageStore[key];
  },
  clear: () => {
    for (const k of Object.keys(localStorageStore)) delete localStorageStore[k];
  },
  key: (i) => Object.keys(localStorageStore)[i] ?? null,
  get length() {
    return Object.keys(localStorageStore).length;
  },
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: false,
  configurable: true,
});
