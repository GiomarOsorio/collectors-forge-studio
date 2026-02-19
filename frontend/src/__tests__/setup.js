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

// Mock de ResizeObserver — no disponible en jsdom
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
