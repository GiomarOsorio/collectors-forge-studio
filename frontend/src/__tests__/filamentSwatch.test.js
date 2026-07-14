/**
 * @file Tests de utils/filamentSwatch.js (port de bambuddy, issue #134).
 * Cubre los 4 modos de `buildColorLayer` + tokens inválidos de `parseStops`.
 */

import { describe, expect, it } from 'vitest';
import { buildColorLayer, parseStops, toCssHex } from '../utils/filamentSwatch';

describe('toCssHex', () => {
  it('normaliza hex de 6 caracteres sin #', () => {
    expect(toCssHex('ff0000')).toBe('#ff0000');
  });

  it('acepta # inicial y hex de 8 caracteres', () => {
    expect(toCssHex('#ff0000aa')).toBe('#ff0000aa');
  });

  it('rechaza longitud inválida', () => {
    expect(toCssHex('fff')).toBeNull();
    expect(toCssHex('ff00000')).toBeNull();
  });

  it('rechaza caracteres no-hex', () => {
    expect(toCssHex('zzzzzz')).toBeNull();
  });
});

describe('parseStops', () => {
  it('vacío/null/undefined → []', () => {
    expect(parseStops(null)).toEqual([]);
    expect(parseStops(undefined)).toEqual([]);
    expect(parseStops('')).toEqual([]);
  });

  it('parsea un string separado por comas', () => {
    expect(parseStops('ff0000,00ff00,0000ff')).toEqual(['#ff0000', '#00ff00', '#0000ff']);
  });

  it('parsea un array', () => {
    expect(parseStops(['ff0000', '00ff00'])).toEqual(['#ff0000', '#00ff00']);
  });

  it('descarta tokens inválidos sin romper el resto', () => {
    expect(parseStops('ff0000,not-a-color,00ff00')).toEqual(['#ff0000', '#00ff00']);
  });

  it('todos inválidos → []', () => {
    expect(parseStops('nope,tampoco')).toEqual([]);
  });
});

describe('buildColorLayer — 4 modos', () => {
  it('sin stops → sólido (linear-gradient del mismo color repetido)', () => {
    const css = buildColorLayer('#ff0000', [], null, null);
    expect(css).toBe('linear-gradient(#ff0000, #ff0000)');
  });

  it('sin stops ni rgba → gris por defecto', () => {
    const css = buildColorLayer(null, [], null, null);
    expect(css).toBe('linear-gradient(#808080, #808080)');
  });

  it('multicolor (por subtype) → conic-gradient con segmentos iguales', () => {
    const css = buildColorLayer(null, ['#ff0000', '#00ff00', '#0000ff'], 'Multicolor', null);
    expect(css).toContain('conic-gradient(from 0deg,');
    expect(css).toContain('#ff0000 0.000deg 120.000deg');
    expect(css).toContain('#0000ff 240.000deg 360.000deg');
  });

  it('multicolor (por effectType) → también conic-gradient', () => {
    const css = buildColorLayer(null, ['#ff0000', '#00ff00'], null, 'multicolor');
    expect(css).toContain('conic-gradient');
  });

  it('dual-color → corte duro sin blend (segmentos %, no deg)', () => {
    const css = buildColorLayer(null, ['#ff0000', '#00ff00'], null, 'dual-color');
    expect(css).toBe('linear-gradient(to right, #ff0000 0.000% 50.000%, #00ff00 50.000% 100.000%)');
  });

  it('tri-color → 3 segmentos con corte duro', () => {
    const css = buildColorLayer(null, ['#ff0000', '#00ff00', '#0000ff'], null, 'tri-color');
    expect(css).toContain('#ff0000 0.000% 33.333%');
    expect(css).toContain('#0000ff 66.667% 100.000%');
  });

  it('gradient (default con stops) → linear-gradient 135deg suave', () => {
    const css = buildColorLayer(null, ['#ff0000', '#00ff00'], null, 'gradient');
    expect(css).toBe('linear-gradient(135deg, #ff0000, #00ff00)');
  });

  it('un solo stop se duplica para poder gradientar', () => {
    const css = buildColorLayer(null, ['#ff0000'], null, 'gradient');
    expect(css).toBe('linear-gradient(135deg, #ff0000, #ff0000)');
  });
});
