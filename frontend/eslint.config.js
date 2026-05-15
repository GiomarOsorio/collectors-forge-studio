import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';

/**
 * ESLint config con `no-undef: error` para atrapar imports faltantes
 * (p.ej. `Clock` usado pero no importado, que en el pasado crasheó
 * el drawer en runtime con `ReferenceError: Clock is not defined`).
 *
 * Globs separados para distintos contextos:
 *  - src/: navegador (window, document, fetch, ...)
 *  - **\/*.test.{js,jsx}: + vitest globals (vi, describe, it, expect, ...)
 *  - tests-e2e/: Playwright (test, expect)
 *  - *.config.js, playwright.config.js: Node (process, __dirname, ...)
 */
export default defineConfig([
  globalIgnores(['dist', 'test-results', 'playwright-report']),

  // ── Reglas base + react-hooks + react-refresh para src/ ─────────────────
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // Warn (no error) — refactor incremental. El bloqueo real es no-undef.
      'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
      // **El propósito principal de este config**: atrapar identificadores no
      // definidos en source code (p.ej. Clock importado faltante que crasheaba
      // el drawer en runtime).
      'no-undef': 'error',
      // Reglas del react-compiler de react-hooks v7 — informativas, no críticas.
      // Las degradamos a warning para no bloquear el build con cosas que no son bugs
      // sino sugerencias de optimización.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': 'warn',
    },
  },

  // ── Tests Vitest: globals + ignorar imports auxiliares ─────────────────
  {
    files: ['**/__tests__/**/*.{js,jsx}', '**/*.test.{js,jsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, vi: 'readonly' },
    },
    rules: {
      'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]|^(waitFor|act|beforeEach)$' }],
      'react-refresh/only-export-components': 'off',
    },
  },

  // ── E2E Playwright ─────────────────────────────────────────────────────
  {
    files: ['tests-e2e/**/*.{js,jsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_|^browserName$' }],
      'react-refresh/only-export-components': 'off',
    },
  },

  // ── Archivos de configuración Node ─────────────────────────────────────
  {
    files: ['*.config.{js,mjs,cjs}', 'playwright.config.js', 'vite.config.{js,mjs}'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
]);
