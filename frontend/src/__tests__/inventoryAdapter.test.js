/**
 * @file Tests del adapter inventario → forma del design (Claude Design port).
 *
 * Cubre `mapToFilament`, `fillPercent`, `stockLevel`, `normalizeHex`,
 * `computeFilamentStats`, `groupFilaments` y formateadores `fmtCOP/fmtKg/fmtG`.
 *
 * Este adapter es crítico porque es el ÚNICO punto de traducción entre el
 * backend (quantity / weight_per_roll / price_per_kg / filament_type) y la
 * UI Claude Design (remaining / total / costPerKg / material).
 */

import { describe, it, expect } from 'vitest';
import {
  computeFilamentStats,
  fillPercent,
  fmtCOP,
  fmtG,
  fmtKg,
  groupFilaments,
  mapToFilament,
  normalizeHex,
  stockLevel,
} from '../utils/inventoryAdapter';

const ITEM_FULL = {
  id: 42,
  name: 'Cobalt Blue PLA',
  category: 'Filamento',
  unit: 'g',
  quantity: 720,
  min_quantity: 200,
  unit_cost: 92,
  price_per_kg: 92000,
  filament_brand: 'Bambu',
  filament_type: 'PLA',
  filament_color: 'Azul cobalto',
  batch: 'A-2614',
  location: 'Estante 1 · B1',
  color_hex: '#1D4ED8',
  color_name: 'Cobalt Blue',
  weight_per_roll: 1000,
  low_stock: false,
  notes: 'Importado de China',
  updated_at: '2026-05-10T12:00:00Z',
};

describe('mapToFilament', () => {
  it('mapea todos los campos completos', () => {
    const f = mapToFilament(ITEM_FULL);
    expect(f).toMatchObject({
      id: 42,
      rawId: 'ITEM-0042',
      material: 'PLA',
      vendor: 'Bambu',
      batch: 'A-2614',
      color: '#1D4ED8',
      colorName: 'Cobalt Blue',
      remaining: 720,
      total: 1000,
      costPerKg: 92000,
      location: 'Estante 1 · B1',
      lowStock: false,
      minQuantity: 200,
      unit: 'g',
      notes: 'Importado de China',
    });
  });

  it('usa default 1000g para total cuando weight_per_roll falta', () => {
    const f = mapToFilament({ ...ITEM_FULL, weight_per_roll: null });
    expect(f.total).toBe(1000);
  });

  it('normaliza filament_type desconocido a "Otro"', () => {
    const f = mapToFilament({ ...ITEM_FULL, filament_type: 'XYZ-RARE' });
    expect(f.material).toBe('Otro');
  });

  it('mantiene filament_type conocido', () => {
    const f = mapToFilament({ ...ITEM_FULL, filament_type: 'PETG' });
    expect(f.material).toBe('PETG');
  });

  it('vendor default — cuando filament_brand falta', () => {
    const f = mapToFilament({ ...ITEM_FULL, filament_brand: null });
    expect(f.vendor).toBe('—');
  });

  it('batch default vacío cuando falta', () => {
    const f = mapToFilament({ ...ITEM_FULL, batch: null });
    expect(f.batch).toBe('');
  });

  it('color null cuando color_hex inválido', () => {
    const f = mapToFilament({ ...ITEM_FULL, color_hex: 'rgb(255,0,0)' });
    expect(f.color).toBeNull();
  });

  it('colorName fallback chain: color_name → filament_color → name', () => {
    expect(mapToFilament({ ...ITEM_FULL, color_name: null }).colorName).toBe(
      'Azul cobalto',
    );
    expect(
      mapToFilament({ ...ITEM_FULL, color_name: null, filament_color: null }).colorName,
    ).toBe('Cobalt Blue PLA');
  });

  it('remaining clampea a 0 cuando quantity es negativa o NaN', () => {
    expect(mapToFilament({ ...ITEM_FULL, quantity: -50 }).remaining).toBe(0);
    expect(mapToFilament({ ...ITEM_FULL, quantity: null }).remaining).toBe(0);
  });

  it('costPerKg=0 cuando price_per_kg falta', () => {
    expect(mapToFilament({ ...ITEM_FULL, price_per_kg: null }).costPerKg).toBe(0);
  });
});

describe('normalizeHex', () => {
  it('acepta #RRGGBB válido y devuelve uppercase', () => {
    expect(normalizeHex('#1d4ed8')).toBe('#1D4ED8');
    expect(normalizeHex('#FFFFFF')).toBe('#FFFFFF');
    expect(normalizeHex('  #abc123  ')).toBe('#ABC123');
  });

  it('rechaza valores no-hex', () => {
    expect(normalizeHex('rgb(0,0,0)')).toBeNull();
    expect(normalizeHex('blue')).toBeNull();
    expect(normalizeHex('#ZZZ123')).toBeNull();
    expect(normalizeHex('#1D4ED')).toBeNull(); // short
    expect(normalizeHex('#1D4ED8AA')).toBeNull(); // alpha hex
    expect(normalizeHex(null)).toBeNull();
    expect(normalizeHex(undefined)).toBeNull();
    expect(normalizeHex('')).toBeNull();
    expect(normalizeHex(123)).toBeNull();
  });
});

describe('fillPercent', () => {
  it('calcula porcentaje con 2 decimales', () => {
    expect(fillPercent({ remaining: 500, total: 1000 })).toBe(50);
    expect(fillPercent({ remaining: 250, total: 1000 })).toBe(25);
  });

  it('clampea a [0, 100]', () => {
    expect(fillPercent({ remaining: 1500, total: 1000 })).toBe(100);
    expect(fillPercent({ remaining: -100, total: 1000 })).toBe(0);
  });

  it('retorna 0 si total es 0 o falsy', () => {
    expect(fillPercent({ remaining: 500, total: 0 })).toBe(0);
    expect(fillPercent({ remaining: 500, total: null })).toBe(0);
    expect(fillPercent(null)).toBe(0);
  });
});

describe('stockLevel', () => {
  it('critical cuando ≤ 10%', () => {
    expect(stockLevel({ remaining: 100, total: 1000 })).toBe('critical');
    expect(stockLevel({ remaining: 50, total: 1000 })).toBe('critical');
    expect(stockLevel({ remaining: 0, total: 1000 })).toBe('critical');
  });

  it('low cuando 10% < pct ≤ 20%', () => {
    expect(stockLevel({ remaining: 150, total: 1000 })).toBe('low');
    expect(stockLevel({ remaining: 200, total: 1000 })).toBe('low');
  });

  it('ok cuando > 20%', () => {
    expect(stockLevel({ remaining: 300, total: 1000 })).toBe('ok');
    expect(stockLevel({ remaining: 1000, total: 1000 })).toBe('ok');
  });
});

describe('computeFilamentStats', () => {
  const filaments = [
    { remaining: 100, total: 1000, costPerKg: 92000 }, // critical
    { remaining: 150, total: 1000, costPerKg: 92000 }, // low
    { remaining: 800, total: 1000, costPerKg: 110000 }, // ok
  ];

  it('cuenta correctamente low y critical', () => {
    const stats = computeFilamentStats(filaments);
    expect(stats.spoolCount).toBe(3);
    expect(stats.lowCount).toBe(2); // critical + low
    expect(stats.criticalCount).toBe(1);
  });

  it('suma totalGrams', () => {
    expect(computeFilamentStats(filaments).totalGrams).toBe(1050);
  });

  it('suma totalValue en COP (grams/1000 × costPerKg)', () => {
    const stats = computeFilamentStats(filaments);
    // (100/1000)*92000 + (150/1000)*92000 + (800/1000)*110000
    // = 9200 + 13800 + 88000 = 111000
    expect(stats.totalValue).toBe(111000);
  });

  it('retorna ceros para lista vacía', () => {
    expect(computeFilamentStats([])).toEqual({
      totalValue: 0,
      totalGrams: 0,
      spoolCount: 0,
      lowCount: 0,
      criticalCount: 0,
    });
  });
});

describe('groupFilaments', () => {
  const materialOrder = ['PLA', 'PETG', 'TPU'];
  const filaments = [
    { id: 1, material: 'PLA', remaining: 100, total: 1000 }, // critical
    { id: 2, material: 'PETG', remaining: 800, total: 1000 }, // ok
    { id: 3, material: 'PLA', remaining: 200, total: 1000 }, // low
    { id: 4, material: 'TPU', remaining: 50, total: 1000 }, // critical
  ];

  it('arma grupo "Stock bajo" al inicio si hay críticos/low', () => {
    const groups = groupFilaments(filaments, materialOrder);
    expect(groups[0].key).toBe('low');
    expect(groups[0].label).toBe('Stock bajo');
    expect(groups[0].warn).toBe(true);
    expect(groups[0].items.map((f) => f.id).sort()).toEqual([1, 3, 4]);
  });

  it('agrupa después por material en el orden dado', () => {
    const groups = groupFilaments(filaments, materialOrder);
    const materialKeys = groups.filter((g) => !g.warn).map((g) => g.key);
    expect(materialKeys).toEqual(['PLA', 'PETG', 'TPU']);
  });

  it('omite grupo "Stock bajo" si todos están ok', () => {
    const allOk = [
      { id: 1, material: 'PLA', remaining: 900, total: 1000 },
      { id: 2, material: 'PETG', remaining: 800, total: 1000 },
    ];
    const groups = groupFilaments(allOk, materialOrder);
    expect(groups.find((g) => g.warn)).toBeUndefined();
  });

  it('omite grupos sin items', () => {
    const groups = groupFilaments(
      [{ id: 1, material: 'PLA', remaining: 900, total: 1000 }],
      materialOrder,
    );
    expect(groups.find((g) => g.key === 'PETG')).toBeUndefined();
  });
});

describe('Formatters', () => {
  describe('fmtCOP', () => {
    it('formato es-CO con $ y separador miles', () => {
      expect(fmtCOP(1500000)).toMatch(/1\.500\.000|1,500,000/);
      expect(fmtCOP(1500000)).toMatch(/^\$/);
    });

    it('valores chicos (< 1000) sin formato locale', () => {
      expect(fmtCOP(500)).toBe('$ 500');
    });

    it('null o NaN retorna em-dash', () => {
      expect(fmtCOP(null)).toBe('—');
      expect(fmtCOP(undefined)).toBe('—');
      expect(fmtCOP('not a number')).toBe('—');
    });

    it('cero formatea como "$ 0"', () => {
      expect(fmtCOP(0)).toBe('$ 0');
    });
  });

  describe('fmtKg', () => {
    it('< 1kg muestra gramos', () => {
      expect(fmtKg(500)).toBe('500 g');
      expect(fmtKg(0)).toBe('0 g');
    });

    it('≥ 1kg muestra kg con 2 decimales', () => {
      expect(fmtKg(1000)).toBe('1.00 kg');
      expect(fmtKg(1500)).toBe('1.50 kg');
      expect(fmtKg(2350)).toBe('2.35 kg');
    });
  });

  describe('fmtG', () => {
    it('redondea a entero con sufijo g', () => {
      expect(fmtG(720)).toBe('720 g');
      expect(fmtG(84.6)).toBe('85 g');
    });
  });
});
