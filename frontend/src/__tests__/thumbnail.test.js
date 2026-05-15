/**
 * @file Tests del helper `getThumbnail` que decide qué imagen mostrar
 * por modelo del Vault (local plate render > URL externa > null).
 */

import { describe, it, expect } from 'vitest';
import { getThumbnail } from '../utils/thumbnail';

describe('getThumbnail', () => {
  it('prioriza local_thumbnail_path sobre thumbnail_url', () => {
    expect(
      getThumbnail({
        local_thumbnail_path: '/static/thumbnails/42.png',
        thumbnail_url: 'https://makerworld.com/img.jpg',
      }),
    ).toBe('/static/thumbnails/42.png');
  });

  it('fallback a thumbnail_url cuando no hay local', () => {
    expect(
      getThumbnail({
        local_thumbnail_path: null,
        thumbnail_url: 'https://makerworld.com/img.jpg',
      }),
    ).toBe('https://makerworld.com/img.jpg');
  });

  it('null cuando ambos faltan', () => {
    expect(getThumbnail({ local_thumbnail_path: null, thumbnail_url: null })).toBeNull();
    expect(getThumbnail({})).toBeNull();
  });

  it('null cuando modelo es null/undefined', () => {
    expect(getThumbnail(null)).toBeNull();
    expect(getThumbnail(undefined)).toBeNull();
  });

  it('strings vacíos cuentan como falsy y caen al siguiente', () => {
    expect(getThumbnail({ local_thumbnail_path: '', thumbnail_url: 'https://x.png' })).toBe(
      'https://x.png',
    );
  });
});
