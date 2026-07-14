/**
 * @file Helpers puros que arman el fondo CSS del swatch de filamento —
 * gradientes/multi-color, transparencia con checkerboard, efectos
 * visuales (sparkle, wood, marble, glow, matte, silk, galaxy, metal).
 *
 * Adaptado de bambuddy (https://github.com/maziggy/bambuddy), AGPL-3.0
 * — `frontend/src/components/filamentSwatchHelpers.ts`, quitando los
 * tipos TS. CFS simplifica `extra_colors` a hex de 6 caracteres (sin
 * canal alpha) — `toCssHex`/`parseStops` igual aceptan 8 caracteres por
 * compatibilidad, pero el modelo `Spool` de CFS no los genera.
 *
 * @module utils/filamentSwatch
 */

import { hash_fnv1a32, random_mulberry32 } from './random';

/**
 * Presets de densidad de efecto por tipo de swatch (tabla, card, etc.).
 * @type {Record<string, {dotCount: number, dotScale: number}>}
 */
export const SWATCH_TYPE_PRESETS = {
  table: { dotCount: 5, dotScale: 1 },
  preview: { dotCount: 8, dotScale: 1.5 },
  card: { dotCount: 40, dotScale: 2 },
  bar: { dotCount: 20, dotScale: 2 },
  groupheader: { dotCount: 80, dotScale: 2 },
};

/** Lista pública de efectos/variantes conocidos, en orden de display. */
export const FILAMENT_EFFECT_OPTIONS = [
  { value: '', label: 'Sin efecto' },
  { value: 'sparkle', label: 'Brillante (sparkle)' },
  { value: 'wood', label: 'Madera' },
  { value: 'marble', label: 'Mármol' },
  { value: 'glow', label: 'Fosforescente (glow)' },
  { value: 'matte', label: 'Mate' },
  { value: 'silk', label: 'Seda (silk)' },
  { value: 'galaxy', label: 'Galaxia' },
  { value: 'rainbow', label: 'Arcoíris' },
  { value: 'metal', label: 'Metálico' },
  { value: 'translucent', label: 'Translúcido' },
  { value: 'gradient', label: 'Degradado' },
  { value: 'dual-color', label: 'Dos colores' },
  { value: 'tri-color', label: 'Tres colores' },
  { value: 'multicolor', label: 'Multicolor' },
];

// Checkerboard bajo la capa de color para que el alpha < FF sea visible.
export const CHECKERBOARD_BG =
  'repeating-conic-gradient(#979797 0% 25%, #f5f5f5 0% 50%)';
export const CHECKERBOARD_TILE_SIZE = '12px 12px';

/**
 * Overlay CSS opcional por efecto. Variantes sin entrada acá son
 * etiquetas categóricas (rainbow, translucent, gradient, dual-color,
 * tri-color, multicolor) — no pintan overlay, solo cambian la capa de
 * color (ver `buildColorLayer`).
 */
export const EFFECT_OVERLAYS = {
  // Sparkle: destellos — posiciones seedeadas para que la misma bobina
  // siempre tenga el mismo patrón, y bobinas distintas tengan patrones distintos.
  sparkle: (spoolSeed = 0, effectSize = 'table') => {
    const rand = random_mulberry32(spoolSeed);
    const preset = SWATCH_TYPE_PRESETS[effectSize] ?? SWATCH_TYPE_PRESETS.table;
    const sparks = [];
    for (let i = 0; i < preset.dotCount; i += 1) {
      const x = rand.intBetween(1, 99);
      const y = rand.intBetween(1, 99);
      const s = rand.floatBetween(1.0, preset.dotScale);
      const a = rand.floatBetween(0.65, 1.0);
      sparks.push(`radial-gradient(circle at ${x}% ${y}%, rgba(255,248,220,${a}) 0 ${s / 2}px, transparent ${s}px)`);
    }
    return sparks;
  },
  wood: () =>
    'repeating-linear-gradient(90deg, '
    + 'rgba(0,0,0,0.18) 0 1px, transparent 1px 6px, '
    + 'rgba(0,0,0,0.08) 6px 7px, transparent 7px 12px)',
  marble: () =>
    'repeating-linear-gradient(135deg, rgba(255,255,255,0.18) 0 2px, transparent 2px 8px), '
    + 'repeating-linear-gradient(45deg, rgba(0,0,0,0.10) 0 1px, transparent 1px 7px)',
  glow: () =>
    'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 70%)',
  matte: () =>
    'linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.10) 100%)',
  silk: () =>
    'linear-gradient(110deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.30) 50%, rgba(255,255,255,0) 70%)',
  galaxy: () =>
    'linear-gradient(110deg, rgba(255,255,255,0) 25%, rgba(255,255,255,0.40) 50%, rgba(255,255,255,0) 75%)',
  metal: () =>
    'repeating-linear-gradient(90deg, rgba(255,255,255,0.10) 0 1px, transparent 1px 3px), '
    + 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(0,0,0,0.18) 100%)',
};

/** Normaliza un token hex (con o sin `#`, 6 u 8 caracteres) → string CSS hex. */
export function toCssHex(token) {
  const t = token.trim().replace(/^#/, '');
  if (t.length !== 6 && t.length !== 8) return null;
  if (!/^[0-9a-fA-F]+$/.test(t)) return null;
  return `#${t}`;
}

/** Parsea `extra_colors.stops` (o un string separado por comas) → array de hex CSS. */
export function parseStops(extra) {
  if (!extra) return [];
  const raw = Array.isArray(extra) ? extra : extra.split(',');
  return raw.map((s) => toCssHex(s)).filter(Boolean);
}

/**
 * Arma la capa de color (gradiente o sólido).
 * - `multicolor` (subtype o effect): conic-gradient — se lee como rueda de color.
 * - `dual-color`/`tri-color`: barras con corte duro, sin blend diagonal.
 * - todo lo demás (`gradient` y default): linear-gradient 135° suave.
 */
export function buildColorLayer(rgba, stops, subtype, effectType) {
  const baseHex = rgba ? toCssHex(rgba) : null;
  if (stops.length === 0) {
    return `linear-gradient(${baseHex ?? '#808080'}, ${baseHex ?? '#808080'})`;
  }
  const allStops = stops.length === 1 ? [stops[0], stops[0]] : stops;
  const subtypeLower = (subtype ?? '').toLowerCase();
  const effectLower = (effectType ?? '').toLowerCase();
  if (subtypeLower === 'multicolor' || effectLower === 'multicolor') {
    const n = allStops.length;
    const segments = allStops
      .map((c, i) => {
        const start = ((i / n) * 360).toFixed(3);
        const end = (((i + 1) / n) * 360).toFixed(3);
        return `${c} ${start}deg ${end}deg`;
      })
      .join(', ');
    return `conic-gradient(from 0deg, ${segments})`;
  }
  if (effectLower === 'dual-color' || effectLower === 'tri-color') {
    const n = allStops.length;
    const segments = allStops
      .map((c, i) => {
        const start = ((i / n) * 100).toFixed(3);
        const end = (((i + 1) / n) * 100).toFixed(3);
        return `${c} ${start}% ${end}%`;
      })
      .join(', ');
    return `linear-gradient(to right, ${segments})`;
  }
  return `linear-gradient(135deg, ${allStops.join(', ')})`;
}

/** Resuelve el overlay CSS de un efecto dado (o null si es solo categórico). */
export function resolveEffectOverlay(effectKey, effectSize, effectSeed) {
  const fn = EFFECT_OVERLAYS[effectKey];
  return fn ? fn(effectSeed, effectSize) : null;
}

/**
 * Produce `{backgroundImage, backgroundSize}` listo para un elemento —
 * capas (de arriba a abajo): overlay de efecto → color → checkerboard.
 *
 * @param {Object} opts
 * @param {string} opts.effectSize - Uno de `SWATCH_TYPE_PRESETS`.
 * @param {string|null} [opts.rgba] - Hex 6/8 caracteres (sin `#` o con).
 * @param {string[]|string|null} [opts.extraColors] - Stops del gradiente.
 * @param {string|null} [opts.effectType]
 * @param {string|null} [opts.subtype]
 * @returns {{backgroundImage: string, backgroundSize: string}}
 */
export function buildFilamentBackground({ effectSize, rgba, extraColors, effectType, subtype }) {
  const stops = parseStops(extraColors);
  const colorLayer = buildColorLayer(rgba, stops, subtype, effectType);
  const effectSeed = hash_fnv1a32(rgba, Array.isArray(extraColors) ? extraColors.join(',') : extraColors, subtype, effectType);
  const effectLayer =
    typeof effectType === 'string' ? resolveEffectOverlay(effectType, effectSize, effectSeed) : null;

  const layers = [];
  if (effectLayer) {
    const effectImages = Array.isArray(effectLayer) ? effectLayer : [effectLayer];
    effectImages.forEach((image) => layers.push({ image, size: 'cover' }));
  }
  layers.push({ image: colorLayer, size: 'cover' });
  layers.push({ image: CHECKERBOARD_BG, size: CHECKERBOARD_TILE_SIZE });

  return {
    backgroundImage: layers.map((l) => l.image).join(', '),
    backgroundSize: layers.map((l) => l.size).join(', '),
  };
}
