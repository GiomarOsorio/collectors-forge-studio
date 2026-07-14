/**
 * @file Hash determinístico + PRNG rápido, sin dependencias.
 *
 * Adaptado de bambuddy (https://github.com/maziggy/bambuddy), AGPL-3.0
 * — `frontend/src/utils/random.ts`, quitando los tipos TS.
 *
 * @module utils/random
 */

const FNV1A_32_OFFSET_BASIS = 0x811c9dc5;
const FNV1A_32_PRIME = 0x01000193;

/**
 * Hash FNV-1a de 32 bits, rápido y determinístico — NO criptográfico,
 * solo para casos no relacionados con seguridad (seed del swatch).
 *
 * @param {...(string|null|undefined)} input
 * @returns {number}
 */
export function hash_fnv1a32(...input) {
  let hash = FNV1A_32_OFFSET_BASIS;
  const textEncoder = new TextEncoder();
  const emptyElement = textEncoder.encode('__|');
  for (const element of input) {
    if (typeof element === 'string') {
      hash = fnv1a32_update(hash, textEncoder.encode(`${element}|`));
    } else if (element === null || element === undefined) {
      hash = fnv1a32_update(hash, emptyElement);
    }
  }
  return hash >>> 0;
}

function fnv1a32_update(hash, value) {
  for (const byte of value) {
    hash ^= byte;
    hash = Math.imul(hash, FNV1A_32_PRIME) >>> 0;
  }
  return hash;
}

/**
 * @typedef {Object} Mulberry32Sequence
 * @property {() => number} next
 * @property {(from: number, to: number) => number} intBetween
 * @property {(from: number, to: number) => number} floatBetween
 */

/**
 * PRNG determinístico Mulberry32 — la misma seed siempre produce la
 * misma secuencia. NO criptográfico.
 *
 * @param {number} seed
 * @returns {Mulberry32Sequence}
 */
export function random_mulberry32(seed) {
  const nextUint32 = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let imul = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    imul = (imul + Math.imul(imul ^ (imul >>> 7), 61 | imul)) ^ imul;
    return (imul ^ (imul >>> 14)) >>> 0;
  };

  const nextNormalized = (from, to) => {
    if (!Number.isFinite(from) || !Number.isFinite(to)) {
      throw new RangeError('from and to must be finite numbers');
    }
    if (from > to) {
      throw new RangeError('from must be less than or equal to to');
    }
    if (from === to) {
      return from;
    }
    return from + (nextUint32() / 0xffffffff) * (to - from);
  };

  return {
    next: () => nextUint32() / 0xffffffff,
    floatBetween: (from, to) => nextNormalized(from, to),
    intBetween: (from, to) => {
      if (!Number.isInteger(from) || !Number.isInteger(to)) {
        throw new RangeError('from and to must be integers');
      }
      return Math.round(nextNormalized(from, to));
    },
  };
}
