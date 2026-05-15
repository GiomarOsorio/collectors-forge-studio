// data.jsx — placeholder data + utilities for the inventory prototype.
// "lorem técnico" — filaments use generic batch IDs and abstract color names
// rather than real-brand SKUs.

// ─── helpers ──────────────────────────────────────────────────────────────
const fmtCOP = (n) => {
  if (n == null) return '—';
  if (Math.abs(n) >= 1000) return `$ ${Math.round(n).toLocaleString('es-CO')}`;
  return `$ ${n.toFixed(0)}`;
};
const fmtKg = (g) => {
  if (g >= 1000) return `${(g / 1000).toFixed(2)} kg`;
  return `${Math.round(g)} g`;
};
const fmtG = (g) => `${Math.round(g)} g`;
const fmtPct = (n) => `${Math.round(n)}%`;

// material catalog
const MATERIALS = [
  { id: 'PLA',     name: 'PLA',     temp: 220, tone: '#7DD3FC' },
  { id: 'PLA-CF',  name: 'PLA-CF',  temp: 230, tone: '#A7F3D0' },
  { id: 'PETG',    name: 'PETG',    temp: 240, tone: '#FBBF24' },
  { id: 'ABS',     name: 'ABS',     temp: 260, tone: '#FB923C' },
  { id: 'ASA',     name: 'ASA',     temp: 260, tone: '#F87171' },
  { id: 'TPU',     name: 'TPU',     temp: 230, tone: '#C4B5FD' },
  { id: 'PA-CF',   name: 'PA-CF',   temp: 290, tone: '#94A3B8' },
];

// 22 filament spools (placeholder vendors A/B/C, batch IDs, color names)
// remaining/total in grams, costPerKg in COP (3D filament COP pricing 80–250k/kg)
const FILAMENTS = [
  // PLA — stock bajo cluster
  { id: 'SP-0001', material: 'PLA', vendor: 'Vendor-A', batch: 'A-2611', color: '#0F172A', colorName: 'Carbon Black',     remaining: 84,   total: 1000, costPerKg: 92000,  location: 'Estante 1 · A2', lastUsed: '2 días', prints: 38, lowReason: 'crítico' },
  { id: 'SP-0002', material: 'PLA', vendor: 'Vendor-A', batch: 'A-2612', color: '#F8FAFC', colorName: 'Snow White',       remaining: 138,  total: 1000, costPerKg: 92000,  location: 'Estante 1 · A3', lastUsed: '1 día',  prints: 51, lowReason: 'bajo' },
  { id: 'SP-0003', material: 'PLA', vendor: 'Vendor-A', batch: 'A-2613', color: '#DC2626', colorName: 'Signal Red',       remaining: 312,  total: 1000, costPerKg: 92000,  location: 'Estante 1 · A4', lastUsed: '5 días', prints: 14 },
  { id: 'SP-0004', material: 'PLA', vendor: 'Vendor-A', batch: 'A-2614', color: '#1D4ED8', colorName: 'Cobalt Blue',      remaining: 720,  total: 1000, costPerKg: 92000,  location: 'Estante 1 · B1', lastUsed: '12 días', prints: 6 },
  { id: 'SP-0005', material: 'PLA', vendor: 'Vendor-B', batch: 'B-1188', color: '#16A34A', colorName: 'Forest Green',     remaining: 845,  total: 1000, costPerKg: 88000,  location: 'Estante 1 · B2', lastUsed: '21 días', prints: 3 },
  { id: 'SP-0006', material: 'PLA', vendor: 'Vendor-B', batch: 'B-1189', color: '#FACC15', colorName: 'Solar Yellow',     remaining: 510,  total: 1000, costPerKg: 88000,  location: 'Estante 1 · B3', lastUsed: '7 días', prints: 9 },
  { id: 'SP-0007', material: 'PLA', vendor: 'Vendor-B', batch: 'B-1190', color: '#EC4899', colorName: 'Fluor Magenta',    remaining: 92,   total: 1000, costPerKg: 105000, location: 'Estante 1 · B4', lastUsed: '3 días', prints: 22, lowReason: 'crítico' },
  { id: 'SP-0008', material: 'PLA', vendor: 'Vendor-C', batch: 'C-0421', color: '#8B5CF6', colorName: 'Violet Pearl',     remaining: 660,  total: 1000, costPerKg: 110000, location: 'Estante 1 · C1', lastUsed: '9 días', prints: 4 },
  { id: 'SP-0009', material: 'PLA', vendor: 'Vendor-C', batch: 'C-0422', color: '#F97316', colorName: 'Amber Glow',       remaining: 990,  total: 1000, costPerKg: 110000, location: 'Estante 1 · C2', lastUsed: 'nuevo',  prints: 0 },
  { id: 'SP-0010', material: 'PLA', vendor: 'Vendor-C', batch: 'C-0423', color: '#06B6D4', colorName: 'Cyan Mist',        remaining: 480,  total: 1000, costPerKg: 110000, location: 'Estante 1 · C3', lastUsed: '4 días', prints: 11 },

  // PLA-CF
  { id: 'SP-0011', material: 'PLA-CF', vendor: 'Vendor-A', batch: 'A-2701', color: '#1F2937', colorName: 'Carbon Matte',  remaining: 405,  total: 1000, costPerKg: 168000, location: 'Estante 2 · A1', lastUsed: '6 días', prints: 7 },
  { id: 'SP-0012', material: 'PLA-CF', vendor: 'Vendor-A', batch: 'A-2702', color: '#374151', colorName: 'Steel Carbon',  remaining: 76,   total: 1000, costPerKg: 168000, location: 'Estante 2 · A2', lastUsed: '1 día',  prints: 12, lowReason: 'crítico' },

  // PETG
  { id: 'SP-0013', material: 'PETG', vendor: 'Vendor-B', batch: 'B-1240', color: '#E2E8F0', colorName: 'Crystal Clear',   remaining: 615,  total: 1000, costPerKg: 118000, location: 'Estante 2 · B1', lastUsed: '8 días', prints: 5 },
  { id: 'SP-0014', material: 'PETG', vendor: 'Vendor-B', batch: 'B-1241', color: '#0EA5E9', colorName: 'Sky Translucent', remaining: 270,  total: 1000, costPerKg: 118000, location: 'Estante 2 · B2', lastUsed: '11 días', prints: 8 },
  { id: 'SP-0015', material: 'PETG', vendor: 'Vendor-B', batch: 'B-1242', color: '#22C55E', colorName: 'Mint Translucent', remaining: 142, total: 1000, costPerKg: 118000, location: 'Estante 2 · B3', lastUsed: '14 días', prints: 6, lowReason: 'bajo' },

  // ABS
  { id: 'SP-0016', material: 'ABS', vendor: 'Vendor-C', batch: 'C-0510', color: '#111827', colorName: 'Industrial Black', remaining: 580,  total: 1000, costPerKg: 135000, location: 'Estante 2 · C1', lastUsed: '17 días', prints: 4 },
  { id: 'SP-0017', material: 'ABS', vendor: 'Vendor-C', batch: 'C-0511', color: '#D1D5DB', colorName: 'Workshop Gray',    remaining: 198,  total: 1000, costPerKg: 135000, location: 'Estante 2 · C2', lastUsed: '22 días', prints: 3 },

  // ASA
  { id: 'SP-0018', material: 'ASA', vendor: 'Vendor-A', batch: 'A-2810', color: '#FAFAF9', colorName: 'UV White',         remaining: 740,  total: 1000, costPerKg: 152000, location: 'Estante 3 · A1', lastUsed: '30 días', prints: 2 },

  // TPU (500g spool)
  { id: 'SP-0019', material: 'TPU', vendor: 'Vendor-C', batch: 'C-0612', color: '#0F172A', colorName: 'Onyx 95A',         remaining: 215,  total: 500,  costPerKg: 195000, location: 'Estante 3 · B1', lastUsed: '13 días', prints: 5 },
  { id: 'SP-0020', material: 'TPU', vendor: 'Vendor-C', batch: 'C-0613', color: '#EF4444', colorName: 'Lava 95A',         remaining: 38,   total: 500,  costPerKg: 195000, location: 'Estante 3 · B2', lastUsed: '4 días',  prints: 9, lowReason: 'crítico' },

  // PA-CF
  { id: 'SP-0021', material: 'PA-CF', vendor: 'Vendor-A', batch: 'A-2910', color: '#1F2937', colorName: 'Aero Carbon',    remaining: 920,  total: 1000, costPerKg: 245000, location: 'Estante 3 · C1', lastUsed: 'nuevo', prints: 0 },
  { id: 'SP-0022', material: 'PA-CF', vendor: 'Vendor-A', batch: 'A-2911', color: '#0F172A', colorName: 'Aero Black',     remaining: 340,  total: 1000, costPerKg: 245000, location: 'Estante 3 · C2', lastUsed: '19 días', prints: 3 },
];

// other inventory categories — just counts/highlights to populate the tab badges
const INSUMOS = [
  { id: 'IN-001', name: 'Build plate · Textured PEI', stock: 2, unit: 'u', costPerUnit: 145000, low: true },
  { id: 'IN-002', name: 'Build plate · Smooth PEI',   stock: 1, unit: 'u', costPerUnit: 145000, low: true },
  { id: 'IN-003', name: 'Nozzle 0.4 hardened',        stock: 6, unit: 'u', costPerUnit: 62000 },
  { id: 'IN-004', name: 'Nozzle 0.6 hardened',        stock: 3, unit: 'u', costPerUnit: 68000 },
  { id: 'IN-005', name: 'Hotend kit completo',         stock: 1, unit: 'u', costPerUnit: 320000, low: true },
];
const HERRAMIENTAS = [
  { id: 'HR-001', name: 'Pinzas finas · 120 mm',     stock: 3 },
  { id: 'HR-002', name: 'Tijeras corte ras',         stock: 2 },
  { id: 'HR-003', name: 'Bisturí mango #11',         stock: 4 },
  { id: 'HR-004', name: 'Llave hex set métrico',     stock: 1 },
];
const CONSUMIBLES = [
  { id: 'CS-001', name: 'Desecante silica · 1kg',    stock: 4, unit: 'paq', low: false },
  { id: 'CS-002', name: 'Alcohol isopropílico 99%',   stock: 800, unit: 'mL', low: true },
  { id: 'CS-003', name: 'Pegamento PVA stick',        stock: 6, unit: 'u' },
  { id: 'CS-004', name: 'Lija 1000 / 2000',           stock: 12, unit: 'u' },
];
const COMPRAS = [
  { id: 'PO-2401', vendor: 'Vendor-A', items: 4, total: 412000, eta: 'mañana',    status: 'en camino' },
  { id: 'PO-2400', vendor: 'Vendor-C', items: 2, total: 268000, eta: '3 días',    status: 'procesando' },
  { id: 'PO-2399', vendor: 'Vendor-B', items: 6, total: 705000, eta: 'recibido',  status: 'completado' },
];

// thresholds + computed
const LOW_PCT = 20;
const isLow = (f) => (f.remaining / f.total) * 100 <= LOW_PCT;

const computeStats = (filaments) => {
  const totalValue = filaments.reduce((s, f) => s + (f.remaining / 1000) * f.costPerKg, 0);
  const totalGrams = filaments.reduce((s, f) => s + f.remaining, 0);
  const low = filaments.filter(isLow);
  const critical = filaments.filter((f) => (f.remaining / f.total) * 100 <= 10);
  return {
    totalValue,
    totalGrams,
    spoolCount: filaments.length,
    lowCount: low.length,
    criticalCount: critical.length,
  };
};

// 14-day sparkline for "consumo diario" placeholder (grams used per day)
const CONSUMPTION_14D = [240, 180, 95, 310, 280, 420, 360, 145, 0, 0, 290, 510, 380, 295];

// group filaments for sectioned grid (Stock bajo first, then by material order)
const groupFilaments = (filaments, materialOrder = MATERIALS.map(m => m.id)) => {
  const low = filaments.filter(isLow);
  const byMat = {};
  filaments.forEach((f) => {
    if (!byMat[f.material]) byMat[f.material] = [];
    byMat[f.material].push(f);
  });
  const groups = [];
  if (low.length) groups.push({ key: 'low', label: 'Stock bajo', items: low, warn: true });
  materialOrder.forEach((m) => {
    if (byMat[m] && byMat[m].length) {
      groups.push({ key: m, label: m, items: byMat[m], warn: false });
    }
  });
  return groups;
};

// expose
Object.assign(window, {
  fmtCOP, fmtKg, fmtG, fmtPct,
  MATERIALS, FILAMENTS, INSUMOS, HERRAMIENTAS, CONSUMIBLES, COMPRAS,
  LOW_PCT, isLow, computeStats, CONSUMPTION_14D, groupFilaments,
});
