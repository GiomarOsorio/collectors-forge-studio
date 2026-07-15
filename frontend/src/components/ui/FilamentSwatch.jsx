/**
 * @file Swatch de filamento con gradientes/efectos visuales — usado por
 * bobinas individuales (issue #134). Distinto de `Swatch.jsx` (disco
 * glossy de un solo color, usado por InventoryPage): este soporta
 * múltiples stops (gradiente/multicolor) y overlays de efecto (sparkle,
 * wood, marble, etc.) vía `utils/filamentSwatch.js`.
 *
 * Adaptado de bambuddy (https://github.com/maziggy/bambuddy), AGPL-3.0
 * — `frontend/src/components/FilamentSwatch.tsx`.
 *
 * @module components/ui/FilamentSwatch
 */

import { useMemo } from 'react';
import { buildFilamentBackground, parseStops } from '../../utils/filamentSwatch';

/**
 * @param {Object} props
 * @param {string|null} [props.rgba] - Hex 6/8 caracteres (con o sin `#`). Gris si falta.
 * @param {string[]|string|null} [props.extraColors] - Stops del gradiente/multicolor.
 * @param {string|null} [props.effectType] - Efecto visual (ver FILAMENT_EFFECT_OPTIONS).
 * @param {string|null} [props.subtype] - 'multicolor' fuerza conic-gradient.
 * @param {string} [props.className='w-5 h-5']
 * @param {'circle'|'pill'|'square'} [props.shape='circle']
 * @param {React.CSSProperties} [props.style]
 * @param {string} [props.title]
 * @param {string} props.effectSize - Uno de `SWATCH_TYPE_PRESETS` (table/preview/card/bar/groupheader).
 */
export default function FilamentSwatch({
  rgba,
  extraColors,
  effectType,
  subtype,
  className = 'w-5 h-5',
  shape = 'circle',
  style,
  title,
  effectSize,
}) {
  const stops = useMemo(() => parseStops(extraColors), [extraColors]);

  const { backgroundImage, backgroundSize } = useMemo(
    () => buildFilamentBackground({ effectSize, rgba, extraColors, effectType, subtype }),
    [effectSize, rgba, extraColors, effectType, subtype],
  );

  const shapeClass = shape === 'square' ? 'rounded' : 'rounded-full';

  const titleHex = (() => {
    if (!rgba) return undefined;
    const clean = rgba.replace(/^#/, '');
    if (clean.length >= 8 && clean.substring(6, 8).toLowerCase() !== 'ff') {
      return `#${clean.substring(0, 8)}`;
    }
    return `#${clean.substring(0, 6)}`;
  })();
  const computedTitle = title ?? (stops.length > 0 ? stops.join(', ') : titleHex);

  return (
    <span
      data-testid="filament-swatch"
      className={`${className} ${shapeClass} border border-black/20 inline-block shrink-0`}
      style={{ backgroundImage, backgroundSize, ...style }}
      title={computedTitle}
    />
  );
}
