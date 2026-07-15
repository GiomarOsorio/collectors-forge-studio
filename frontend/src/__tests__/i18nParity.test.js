/**
 * @file Tests de la función pura de comparación del check de paridad i18n
 * (issue #140, pieza B) — sin tocar filesystem, solo lógica de comparación.
 */

import { describe, it, expect } from 'vitest';
import { compareLocales } from '../../scripts/check-i18n-parity.mjs';

function toMap(obj) {
  return new Map(Object.entries(obj));
}

describe('compareLocales', () => {
  it('sin diferencias no falla', () => {
    const locales = {
      es: toMap({ 'a.b': 'Hola {{name}}', c: 'Chau' }),
      en: toMap({ 'a.b': 'Hello {{name}}', c: 'Bye' }),
    };
    const { failed, reports } = compareLocales(locales);
    expect(failed).toBe(false);
    expect(reports).toEqual([]);
  });

  it('clave faltante en en se reporta', () => {
    const locales = {
      es: toMap({ 'a.b': 'Hola', c: 'Chau' }),
      en: toMap({ 'a.b': 'Hello' }),
    };
    const { failed, reports } = compareLocales(locales);
    expect(failed).toBe(true);
    const missing = reports.find((r) => r.label.includes('faltantes'));
    expect(missing.items).toContain('c');
  });

  it('clave de más en en se reporta', () => {
    const locales = {
      es: toMap({ a: '1' }),
      en: toMap({ a: '1', b: '2' }),
    };
    const { reports } = compareLocales(locales);
    const extra = reports.find((r) => r.label.includes('de más'));
    expect(extra.items).toContain('b');
  });

  it('placeholder distinto se reporta', () => {
    const locales = {
      es: toMap({ greet: 'Hola {{name}}' }),
      en: toMap({ greet: 'Hello {{user}}' }),
    };
    const { failed, reports } = compareLocales(locales);
    expect(failed).toBe(true);
    const mismatch = reports.find((r) => r.label.includes('placeholders'));
    expect(mismatch.items[0]).toContain('greet');
  });

  it('requiere una entrada es de referencia', () => {
    expect(() => compareLocales({ en: toMap({ a: '1' }) })).toThrow();
  });
});
