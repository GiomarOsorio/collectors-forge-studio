/**
 * @file Tests del helper `getThumbnail` que decide qué imagen mostrar
 * por modelo del Vault (proxy MinIO > URL externa > null).
 */

import { describe, it, expect } from 'vitest';
import { getThumbnail } from '../utils/thumbnail';

describe('getThumbnail', () => {
  it('prioriza local_thumbnail_url sobre thumbnail_url', () => {
    expect(
      getThumbnail({
        local_thumbnail_url: '/api/vault/42/thumbnail?v=1700000000',
        thumbnail_url: 'https://makerworld.com/img.jpg',
      }),
    ).toBe('/api/vault/42/thumbnail?v=1700000000');
  });

  it('fallback a thumbnail_url cuando no hay local', () => {
    expect(
      getThumbnail({
        local_thumbnail_url: null,
        thumbnail_url: 'https://makerworld.com/img.jpg',
      }),
    ).toBe('https://makerworld.com/img.jpg');
  });

  it('null cuando ambos faltan', () => {
    expect(getThumbnail({ local_thumbnail_url: null, thumbnail_url: null })).toBeNull();
    expect(getThumbnail({})).toBeNull();
  });

  it('null cuando modelo es null/undefined', () => {
    expect(getThumbnail(null)).toBeNull();
    expect(getThumbnail(undefined)).toBeNull();
  });

  it('strings vacíos cuentan como falsy y caen al siguiente', () => {
    expect(getThumbnail({ local_thumbnail_url: '', thumbnail_url: 'https://x.png' })).toBe(
      'https://x.png',
    );
  });
});
