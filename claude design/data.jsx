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

// other inventory categories — richer placeholders for the mobile tabs
// kind/icon drives the category icon in the row; reorder/par for stock logic.
const INSUMOS = [
  { id: 'IN-001', name: 'Build plate · Textured PEI', stock: 2,  par: 4, unit: 'u',  costPerUnit: 145000, location: 'Estante 4 · A1', kind: 'plate',  lastUsed: '1 día',   low: true },
  { id: 'IN-002', name: 'Build plate · Smooth PEI',   stock: 1,  par: 3, unit: 'u',  costPerUnit: 145000, location: 'Estante 4 · A2', kind: 'plate',  lastUsed: '4 días',  low: true,  critical: true },
  { id: 'IN-003', name: 'Nozzle 0.4 hardened',        stock: 6,  par: 6, unit: 'u',  costPerUnit: 62000,  location: 'Cajón 2 · N1',    kind: 'nozzle', lastUsed: '2 días' },
  { id: 'IN-004', name: 'Nozzle 0.6 hardened',        stock: 3,  par: 4, unit: 'u',  costPerUnit: 68000,  location: 'Cajón 2 · N2',    kind: 'nozzle', lastUsed: '11 días' },
  { id: 'IN-005', name: 'Hotend kit completo',        stock: 1,  par: 2, unit: 'u',  costPerUnit: 320000, location: 'Cajón 3 · H1',    kind: 'hotend', lastUsed: '32 días', low: true },
  { id: 'IN-006', name: 'Correa GT2 6mm · 1m',        stock: 4,  par: 4, unit: 'u',  costPerUnit: 28000,  location: 'Cajón 3 · B1',    kind: 'belt',   lastUsed: '20 días' },
  { id: 'IN-007', name: 'Tubo PTFE · 1.75 mm',        stock: 8,  par: 6, unit: 'm',  costPerUnit: 9500,   location: 'Cajón 3 · T1',    kind: 'tube',   lastUsed: '8 días' },
];
const HERRAMIENTAS = [
  { id: 'HR-001', name: 'Pinzas finas · 120 mm',      stock: 3, par: 3, location: 'Pared · P1', lastUsed: 'hoy',     kind: 'pliers' },
  { id: 'HR-002', name: 'Tijeras corte ras',          stock: 2, par: 2, location: 'Pared · P2', lastUsed: '2 días',  kind: 'scissors' },
  { id: 'HR-003', name: 'Bisturí mango #11',          stock: 4, par: 4, location: 'Cajón 1',    lastUsed: 'hoy',     kind: 'knife' },
  { id: 'HR-004', name: 'Llave hex set métrico',      stock: 1, par: 2, location: 'Cajón 1',    lastUsed: '5 días',  kind: 'hex', low: true },
  { id: 'HR-005', name: 'Calibrador digital · 150mm', stock: 1, par: 1, location: 'Cajón 1',    lastUsed: '1 día',   kind: 'caliper' },
  { id: 'HR-006', name: 'Espátula metálica flex',     stock: 2, par: 2, location: 'Pared · P3', lastUsed: 'hoy',     kind: 'spatula' },
];
const CONSUMIBLES = [
  { id: 'CS-001', name: 'Desecante silica · 1kg',     stock: 4,   par: 6,   unit: 'paq', costPerUnit: 22000, location: 'Estante 4 · C1', lastUsed: '6 días',   kind: 'silica' },
  { id: 'CS-002', name: 'Alcohol isopropílico 99%',   stock: 800, par: 2000,unit: 'mL',  costPerUnit: 18,    location: 'Estante 4 · C2', lastUsed: 'hoy',      kind: 'liquid', low: true,  critical: true },
  { id: 'CS-003', name: 'Pegamento PVA stick',        stock: 6,   par: 4,   unit: 'u',   costPerUnit: 8500,  location: 'Estante 4 · C3', lastUsed: '3 días',   kind: 'glue' },
  { id: 'CS-004', name: 'Lija 1000 / 2000',           stock: 12,  par: 8,   unit: 'u',   costPerUnit: 4500,  location: 'Estante 4 · C4', lastUsed: '1 día',    kind: 'sandpaper' },
  { id: 'CS-005', name: 'Guantes nitrilo · M',        stock: 18,  par: 50,  unit: 'u',   costPerUnit: 1200,  location: 'Estante 4 · C5', lastUsed: 'hoy',      kind: 'gloves', low: true },
  { id: 'CS-006', name: 'Toallas microfibra',         stock: 7,   par: 6,   unit: 'u',   costPerUnit: 6000,  location: 'Estante 4 · C6', lastUsed: '2 días',   kind: 'cloth' },
];
// Compras (POs): now with line items for the detail expansion
const COMPRAS = [
  { id: 'PO-2401', vendor: 'Vendor-A', items: 4, total: 412000, eta: 'mañana',    placed: '14 may', status: 'en camino',
    lines: ['PLA Carbon Black ×3', 'PLA Snow White ×1'] },
  { id: 'PO-2400', vendor: 'Vendor-C', items: 2, total: 268000, eta: '3 días',    placed: '13 may', status: 'procesando',
    lines: ['TPU Lava 95A ×1', 'Build plate PEI ×1'] },
  { id: 'PO-2402', vendor: 'Vendor-B', items: 3, total: 348000, eta: '5 días',    placed: '14 may', status: 'borrador',
    lines: ['PETG Mint ×2', 'Hotend kit ×1'] },
  { id: 'PO-2399', vendor: 'Vendor-B', items: 6, total: 705000, eta: 'recibido',  placed: '08 may', status: 'completado',
    lines: ['PLA-CF Steel ×2', 'PA-CF Aero ×1', 'Nozzles 0.6 ×3'] },
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

// ─── printers (used by Slicer, Cola, Mantto) ────────────────────────────
const PRINTERS = [
  { id: 'P-01', name: 'Forge-01', model: 'X1-class CoreXY',  status: 'idle',     hoursTotal: 1280, nozzle: 0.4, color: '#3B82F6', bed: 'PEI Tex' },
  { id: 'P-02', name: 'Forge-02', model: 'X1-class CoreXY',  status: 'printing', hoursTotal: 940,  nozzle: 0.6, color: '#34D399', bed: 'PEI Tex', progress: 62, eta: '1h 42m' },
  { id: 'P-03', name: 'Forge-03', model: 'P1-class CoreXY',  status: 'idle',     hoursTotal: 1825, nozzle: 0.4, color: '#A78BFA', bed: 'PEI Smooth' },
  { id: 'P-04', name: 'Forge-04', model: 'A1-class bedslinger', status: 'maint', hoursTotal: 2160, nozzle: 0.4, color: '#FBBF24', bed: 'PEI Tex' },
];

// recent files (Slicer left rail)
const SLICER_RECENT = [
  { id: 'F-091', name: 'minifig_dragon_v3.3mf',   size: '4.8 MB', when: 'hoy',     thumb: '#3B82F6' },
  { id: 'F-090', name: 'planter_hex_125.3mf',     size: '12.1 MB', when: 'ayer',    thumb: '#34D399' },
  { id: 'F-089', name: 'bracket_mount_v2.gcode',  size: '3.2 MB', when: '2 días',   thumb: '#FBBF24' },
  { id: 'F-088', name: 'tarjetero_logo.3mf',      size: '6.7 MB', when: '3 días',   thumb: '#A78BFA' },
  { id: 'F-087', name: 'parts_box_organizer.3mf', size: '18.4 MB', when: '5 días',  thumb: '#F87171' },
  { id: 'F-086', name: 'phone_stand_minimal.stl', size: '2.1 MB', when: '1 sem',    thumb: '#22D3EE' },
];

// "loaded" job currently selected in Slicer — mock estimate output
const SLICER_JOBS = {
  current: {
    id: 'F-091',
    name: 'minifig_dragon_v3.3mf',
    plates: 1,
    parts: 14,
    layerHeight: 0.16,
    infill: 15,
    walls: 3,
    supports: true,
    printer: 'P-02',
    material: 'PLA',
    nozzle: 0.4,
    filamentSpool: 'SP-0008', // Violet Pearl
    estimate: {
      time: '5h 18m',
      gramsPLA: 142,
      gramsSupport: 9,
      cost: { material: 16770, machine: 3720, energy: 1240, margin: 4380, total: 26110 },
    },
    bbox: { x: 128, y: 96, z: 142 }, // mm
    layerCount: 891,
  },
};

// ─── print queue (jobs) ──────────────────────────────────────────────────
// Statuses: pending, printing, paused, done
const QUEUE_JOBS = [
  // PRINTING (2)
  { id: 'J-2401', name: 'minifig_dragon_v3.3mf',   thumb: '#A78BFA', status: 'printing',
    printer: 'P-02', spool: 'SP-0008', material: 'PLA', grams: 142, time: '5h 18m',
    progress: 62, eta: '1h 58m', layer: 552, layers: 891,
    client: 'Aurora Cards', quote: 'Q-2208', priority: 'high',
    placed: '14 may · 09:14', notes: 'Asegurar adhesión, primera capa fría.' },
  { id: 'J-2398', name: 'bracket_mount_v2.gcode',  thumb: '#FBBF24', status: 'printing',
    printer: 'P-03', spool: 'SP-0011', material: 'PLA-CF', grams: 198, time: '4h 02m',
    progress: 38, eta: '2h 30m', layer: 312, layers: 820,
    client: 'Taller Mecano', quote: 'Q-2207', priority: 'mid',
    placed: '14 may · 10:30', notes: 'Boquilla 0.4 endurecida — revisar después.' },

  // PENDING (5)
  { id: 'J-2405', name: 'planter_hex_125.3mf',     thumb: '#34D399', status: 'pending',
    printer: 'P-01', spool: 'SP-0005', material: 'PLA', grams: 88, time: '3h 12m',
    client: 'Verde Estudio', quote: 'Q-2210', priority: 'mid',
    placed: '15 may · 08:02', notes: '' },
  { id: 'J-2404', name: 'phone_stand_minimal.stl', thumb: '#22D3EE', status: 'pending',
    printer: 'P-01', spool: 'SP-0010', material: 'PLA', grams: 42, time: '1h 38m',
    client: 'Personal', quote: null, priority: 'low',
    placed: '15 may · 07:40', notes: 'Espera 2 unidades en lote.' },
  { id: 'J-2406', name: 'parts_box_organizer.3mf', thumb: '#F87171', status: 'pending',
    printer: null, spool: 'SP-0003', material: 'PLA', grams: 320, time: '8h 42m',
    client: 'Workshop interno', quote: null, priority: 'low',
    placed: '15 may · 08:15', notes: 'Asignar a impresora cuando termine J-2401.' },
  { id: 'J-2407', name: 'tarjetero_logo.3mf',      thumb: '#A78BFA', status: 'pending',
    printer: 'P-03', spool: 'SP-0008', material: 'PLA', grams: 76, time: '2h 50m',
    client: 'Aurora Cards', quote: 'Q-2208', priority: 'high',
    placed: '15 may · 09:01', notes: 'Mismo cliente que J-2401.' },
  { id: 'J-2408', name: 'hex_grip_handle.3mf',     thumb: '#FBBF24', status: 'pending',
    printer: null, spool: 'SP-0019', material: 'TPU', grams: 58, time: '2h 12m',
    client: 'Mecano Custom', quote: 'Q-2211', priority: 'mid',
    placed: '15 may · 09:22', notes: 'TPU 95A · velocidad lenta.' },

  // PAUSED (1)
  { id: 'J-2399', name: 'enclosure_top_v4.3mf',    thumb: '#94A0AE', status: 'paused',
    printer: 'P-03', spool: 'SP-0017', material: 'ABS', grams: 410, time: '11h 04m',
    progress: 18, layer: 158, layers: 880,
    client: 'Lab Acústico', quote: 'Q-2205', priority: 'mid',
    placed: '13 may · 18:45', notes: 'Pausado: warp en esquina. Revisar bed temp.' },

  // DONE (4)
  { id: 'J-2396', name: 'minifig_dragon_v2.3mf',   thumb: '#A78BFA', status: 'done',
    printer: 'P-02', spool: 'SP-0008', material: 'PLA', grams: 140, time: '5h 12m',
    client: 'Aurora Cards', quote: 'Q-2204', priority: 'high',
    placed: '13 may · 08:30', completed: '13 may · 14:02', notes: '' },
  { id: 'J-2395', name: 'desk_cable_clip_x8.3mf',  thumb: '#3B82F6', status: 'done',
    printer: 'P-01', spool: 'SP-0004', material: 'PLA', grams: 24, time: '0h 52m',
    client: 'Personal', quote: null, priority: 'low',
    placed: '12 may · 18:00', completed: '12 may · 19:10', notes: 'Lote de 8 unidades.' },
  { id: 'J-2394', name: 'gear_assembly_v6.3mf',    thumb: '#FBBF24', status: 'done',
    printer: 'P-03', spool: 'SP-0011', material: 'PLA-CF', grams: 256, time: '6h 18m',
    client: 'Taller Mecano', quote: 'Q-2203', priority: 'mid',
    placed: '12 may · 09:14', completed: '12 may · 16:02', notes: '' },
  { id: 'J-2393', name: 'planter_round_220.3mf',   thumb: '#34D399', status: 'done',
    printer: 'P-01', spool: 'SP-0005', material: 'PLA', grams: 168, time: '4h 30m',
    client: 'Verde Estudio', quote: 'Q-2202', priority: 'mid',
    placed: '11 may · 13:00', completed: '11 may · 18:14', notes: '' },
];

const QUEUE_STATUSES = [
  { id: 'pending',  label: 'Pendiente',   color: '#94A0AE' },
  { id: 'printing', label: 'Imprimiendo', color: '#3B82F6' },
  { id: 'paused',   label: 'Pausa',       color: '#FBBF24' },
  { id: 'done',     label: 'Hecho',       color: '#34D399' },
];

// ─── maintenance (mantto) ────────────────────────────────────────────────
// Component-level wear per printer (hours used vs expected life in hours).
// 'critical' when usado/vida >= 90%; 'warn' when >= 75%.
const PRINTER_COMPONENTS = {
  'P-01': [ // Forge-01 idle, healthy
    { id: 'nozzle',  label: 'Boquilla 0.4',  used: 220,  life: 600,  unit: 'h', kind: 'wear' },
    { id: 'hotend',  label: 'Hotend',        used: 320,  life: 2000, unit: 'h', kind: 'wear' },
    { id: 'belt',    label: 'Banda Y',       used: 1280, life: 1500, unit: 'h', kind: 'wear' },
    { id: 'bed',     label: 'PEI Tex',       used: 520,  life: 1200, unit: 'h', kind: 'wear' },
    { id: 'fan',     label: 'Ventilador',    used: 1100, life: 2500, unit: 'h', kind: 'wear' },
  ],
  'P-02': [ // Forge-02 printing, near-life belt
    { id: 'nozzle',  label: 'Boquilla 0.6',  used: 540,  life: 600,  unit: 'h', kind: 'wear' },
    { id: 'hotend',  label: 'Hotend',        used: 880,  life: 2000, unit: 'h', kind: 'wear' },
    { id: 'belt',    label: 'Banda X',       used: 1395, life: 1500, unit: 'h', kind: 'wear' },
    { id: 'bed',     label: 'PEI Tex',       used: 670,  life: 1200, unit: 'h', kind: 'wear' },
    { id: 'fan',     label: 'Ventilador',    used: 940,  life: 2500, unit: 'h', kind: 'wear' },
  ],
  'P-03': [ // Forge-03 healthy mostly
    { id: 'nozzle',  label: 'Boquilla 0.4',  used: 180,  life: 600,  unit: 'h', kind: 'wear' },
    { id: 'hotend',  label: 'Hotend',        used: 1620, life: 2000, unit: 'h', kind: 'wear' },
    { id: 'belt',    label: 'Banda Y',       used: 980,  life: 1500, unit: 'h', kind: 'wear' },
    { id: 'bed',     label: 'PEI Smooth',    used: 412,  life: 1200, unit: 'h', kind: 'wear' },
    { id: 'fan',     label: 'Ventilador',    used: 1825, life: 2500, unit: 'h', kind: 'wear' },
  ],
  'P-04': [ // Forge-04 in maintenance, broken hotend
    { id: 'nozzle',  label: 'Boquilla 0.4',  used: 0,    life: 600,  unit: 'h', kind: 'wear', note: 'recién cambiada' },
    { id: 'hotend',  label: 'Hotend',        used: 2160, life: 2000, unit: 'h', kind: 'wear' },
    { id: 'belt',    label: 'Banda X',       used: 2100, life: 1500, unit: 'h', kind: 'wear' },
    { id: 'bed',     label: 'PEI Tex',       used: 1080, life: 1200, unit: 'h', kind: 'wear' },
    { id: 'fan',     label: 'Ventilador',    used: 1840, life: 2500, unit: 'h', kind: 'wear' },
  ],
};

// scheduled / pending maintenance tasks
const MAINT_TASKS = [
  // VENCIDAS (overdue)
  { id: 'MT-031', printer: 'P-04', task: 'Cambio de hotend',          due: 'vencido · 3 días',  dueDays: -3,  est: '45 min', cost: 320000, severity: 'overdue', component: 'hotend' },
  { id: 'MT-030', printer: 'P-04', task: 'Cambio de banda X',         due: 'vencido · 1 día',   dueDays: -1,  est: '60 min', cost: 84000,  severity: 'overdue', component: 'belt' },

  // PRÓXIMAS (this week)
  { id: 'MT-032', printer: 'P-02', task: 'Cambio de banda X',         due: 'mañana',             dueDays: 1,   est: '60 min', cost: 84000,  severity: 'soon',    component: 'belt' },
  { id: 'MT-033', printer: 'P-02', task: 'Cambio de boquilla 0.6',    due: 'en 2 días',          dueDays: 2,   est: '15 min', cost: 68000,  severity: 'soon',    component: 'nozzle' },
  { id: 'MT-034', printer: 'P-03', task: 'Cambio de hotend',          due: 'en 5 días',          dueDays: 5,   est: '45 min', cost: 320000, severity: 'soon',    component: 'hotend' },

  // PROGRAMADAS (more than a week away)
  { id: 'MT-035', printer: 'P-01', task: 'Limpieza profunda',         due: 'en 2 sem',           dueDays: 14,  est: '90 min', cost: 0,      severity: 'scheduled', component: null },
  { id: 'MT-036', printer: 'P-03', task: 'Lubricación rieles',        due: 'en 3 sem',           dueDays: 21,  est: '30 min', cost: 12000,  severity: 'scheduled', component: null },
  { id: 'MT-037', printer: 'P-01', task: 'Nivelación cama (manual)',  due: 'en 4 sem',           dueDays: 28,  est: '20 min', cost: 0,      severity: 'scheduled', component: null },
];

// maintenance history (completed)
const MAINT_HISTORY = [
  { id: 'ML-128', printer: 'P-02', task: 'Cambio de hotend',           date: '10 may',  cost: 320000, tech: 'Giomar',  notes: 'Hotend con obstrucción crónica.' },
  { id: 'ML-127', printer: 'P-01', task: 'Cambio de boquilla 0.4',     date: '08 may',  cost: 62000,  tech: 'Giomar',  notes: '' },
  { id: 'ML-126', printer: 'P-03', task: 'Limpieza profunda',          date: '06 may',  cost: 0,      tech: 'Giomar',  notes: 'Cama + extrusor + canalizaciones.' },
  { id: 'ML-125', printer: 'P-02', task: 'Nivelación cama (manual)',   date: '04 may',  cost: 0,      tech: 'Giomar',  notes: '' },
  { id: 'ML-124', printer: 'P-01', task: 'Lubricación rieles',         date: '02 may',  cost: 12000,  tech: 'Externo', notes: 'Servicio mensual programado.' },
  { id: 'ML-123', printer: 'P-04', task: 'Cambio de tubo PTFE',        date: '28 abr',  cost: 9500,   tech: 'Giomar',  notes: '' },
  { id: 'ML-122', printer: 'P-03', task: 'Cambio de boquilla 0.4',     date: '24 abr',  cost: 62000,  tech: 'Giomar',  notes: 'Boquilla atascada con PETG.' },
];

// per-printer maintenance checklist (recurring tasks)
const PRINTER_CHECKLISTS = {
  default: [
    { id: 'cl-1', label: 'Limpiar cama (IPA)',     freq: 'cada impresión' },
    { id: 'cl-2', label: 'Inspeccionar boquilla',  freq: 'semanal' },
    { id: 'cl-3', label: 'Lubricar rieles',        freq: 'mensual' },
    { id: 'cl-4', label: 'Nivelación cama',        freq: 'mensual' },
    { id: 'cl-5', label: 'Limpiar ventiladores',   freq: 'mensual' },
    { id: 'cl-6', label: 'Tensión bandas',         freq: 'bimestral' },
    { id: 'cl-7', label: 'Revisar firmware',       freq: 'trimestral' },
  ],
};

// helpers
const compStatus = (c) => {
  const r = c.used / c.life;
  if (r >= 1.0) return 'overdue';
  if (r >= 0.9) return 'critical';
  if (r >= 0.75) return 'warn';
  return 'ok';
};
const printerHealth = (printerId) => {
  const comps = PRINTER_COMPONENTS[printerId] || [];
  let worst = 'ok';
  const rank = { ok: 0, warn: 1, critical: 2, overdue: 3 };
  for (const c of comps) {
    const s = compStatus(c);
    if (rank[s] > rank[worst]) worst = s;
  }
  return worst;
};

const MAINT_SEVERITY = {
  overdue:   { color: '#F87171', bg: 'rgba(248, 113, 113, 0.10)', border: 'rgba(248, 113, 113, 0.30)', label: 'VENCIDO' },
  soon:      { color: '#FBBF24', bg: 'rgba(251, 191, 36, 0.10)',  border: 'rgba(251, 191, 36, 0.30)',  label: 'PRÓXIMO' },
  scheduled: { color: '#94A0AE', bg: 'rgba(148, 160, 174, 0.10)', border: 'rgba(148, 160, 174, 0.25)', label: 'PROGRAMADO' },
};

// ─── vault (model library) ───────────────────────────────────────────────
const VAULT_CATEGORIES = [
  { id: 'all',         label: 'Todos' },
  { id: 'decor',       label: 'Decoración' },
  { id: 'functional',  label: 'Funcional' },
  { id: 'replica',     label: 'Réplica' },
  { id: 'prototype',   label: 'Prototipo' },
  { id: 'jewelry',     label: 'Joyería' },
  { id: 'tooling',     label: 'Herramental' },
];

// Each model has a 'shape' code that drives the SVG thumbnail generator.
// shape: 'dragon' | 'planter' | 'hex' | 'bracket' | 'ring' | 'gear' | 'phone'
//        | 'lattice' | 'logo' | 'tube' | 'organizer' | 'cliff' | 'mini' | 'spool'
const VAULT_MODELS = [
  { id: 'M-0114', name: 'Minifig dragon v3',         shape: 'dragon',    fmt: '.3mf',   sizeMB: 4.8,  category: 'decor',      bbox: '128×96×142',  parts: 14, prints: 22, version: 'v3.0', lastUsed: 'hoy',     created: '02 may', tone: '#A78BFA', tags: ['fantasy', 'mini'],   author: 'Giomar' },
  { id: 'M-0113', name: 'Planter hex 125',           shape: 'planter',   fmt: '.3mf',   sizeMB: 12.1, category: 'decor',      bbox: '125×125×80',  parts: 1,  prints: 8,  version: 'v2.1', lastUsed: 'ayer',    created: '28 abr', tone: '#34D399', tags: ['planta', 'casa'],    author: 'Giomar' },
  { id: 'M-0112', name: 'Bracket mount v2',          shape: 'bracket',   fmt: '.gcode', sizeMB: 3.2,  category: 'functional', bbox: '80×40×30',    parts: 2,  prints: 11, version: 'v2.0', lastUsed: '2 días',  created: '22 abr', tone: '#FBBF24', tags: ['L-bracket', 'taller'], author: 'Giomar' },
  { id: 'M-0111', name: 'Tarjetero con logo',        shape: 'logo',      fmt: '.3mf',   sizeMB: 6.7,  category: 'decor',      bbox: '95×62×35',    parts: 3,  prints: 14, version: 'v1.3', lastUsed: '3 días',  created: '18 abr', tone: '#3B82F6', tags: ['cliente', 'aurora'], author: 'Giomar' },
  { id: 'M-0110', name: 'Organizador piezas',        shape: 'organizer', fmt: '.3mf',   sizeMB: 18.4, category: 'tooling',    bbox: '210×140×60',  parts: 6,  prints: 4,  version: 'v1.2', lastUsed: '5 días',  created: '12 abr', tone: '#F87171', tags: ['taller'],            author: 'Giomar' },
  { id: 'M-0109', name: 'Phone stand minimal',       shape: 'phone',     fmt: '.stl',   sizeMB: 2.1,  category: 'functional', bbox: '70×50×95',    parts: 1,  prints: 6,  version: 'v1.0', lastUsed: '1 sem',   created: '02 abr', tone: '#22D3EE', tags: ['oficina'],           author: 'Giomar' },
  { id: 'M-0108', name: 'Hex grip handle',           shape: 'hex',       fmt: '.3mf',   sizeMB: 1.6,  category: 'functional', bbox: '120×26×26',   parts: 1,  prints: 9,  version: 'v1.0', lastUsed: '8 días',  created: '28 mar', tone: '#FBBF24', tags: ['TPU', 'grip'],       author: 'Externo' },
  { id: 'M-0107', name: 'Gear assembly v6',          shape: 'gear',      fmt: '.step',  sizeMB: 24.0, category: 'functional', bbox: '95×95×42',    parts: 8,  prints: 3,  version: 'v6.0', lastUsed: '11 días', created: '16 mar', tone: '#FBBF24', tags: ['mecánico'],          author: 'Externo' },
  { id: 'M-0106', name: 'Enclosure top v4',          shape: 'cliff',     fmt: '.3mf',   sizeMB: 9.8,  category: 'prototype',  bbox: '320×220×38',  parts: 1,  prints: 1,  version: 'v4.0', lastUsed: '14 días', created: '08 mar', tone: '#94A0AE', tags: ['ABS', 'gabinete'],   author: 'Giomar' },
  { id: 'M-0105', name: 'Ring lattice 18mm',         shape: 'ring',      fmt: '.stl',   sizeMB: 0.8,  category: 'jewelry',    bbox: '22×22×6',     parts: 1,  prints: 12, version: 'v1.2', lastUsed: '18 días', created: '03 mar', tone: '#EC4899', tags: ['joya', 'lattice'],   author: 'Giomar' },
  { id: 'M-0104', name: 'Voronoi lattice cube',      shape: 'lattice',   fmt: '.3mf',   sizeMB: 7.4,  category: 'decor',      bbox: '60×60×60',    parts: 1,  prints: 5,  version: 'v1.0', lastUsed: '22 días', created: '24 feb', tone: '#A78BFA', tags: ['parametric'],        author: 'Giomar' },
  { id: 'M-0103', name: 'Spool refill jig',          shape: 'spool',     fmt: '.step',  sizeMB: 14.2, category: 'tooling',    bbox: '210×210×30',  parts: 4,  prints: 2,  version: 'v1.0', lastUsed: '25 días', created: '18 feb', tone: '#34D399', tags: ['taller', 'jig'],     author: 'Giomar' },
  { id: 'M-0102', name: 'Cable clip x8',             shape: 'tube',      fmt: '.3mf',   sizeMB: 0.9,  category: 'functional', bbox: '18×12×14',    parts: 8,  prints: 35, version: 'v2.0', lastUsed: '28 días', created: '12 feb', tone: '#3B82F6', tags: ['set'],               author: 'Giomar' },
  { id: 'M-0101', name: 'Minifig dragon v2 (legacy)', shape: 'mini',     fmt: '.stl',   sizeMB: 3.6,  category: 'decor',      bbox: '120×88×128',  parts: 12, prints: 18, version: 'v2.0', lastUsed: '32 días', created: '02 feb', tone: '#A78BFA', tags: ['legacy', 'fantasy'], author: 'Giomar' },
];

const VAULT_FORMATS = ['.3mf', '.stl', '.step', '.gcode'];

// version history for the detail sheet (just a few sample entries per model)
const VAULT_VERSIONS = {
  'M-0114': [
    { v: 'v3.0', date: '02 may', note: 'Soporte interno reducido' },
    { v: 'v2.1', date: '18 abr', note: 'Escala +10% para asentar joyas' },
    { v: 'v2.0', date: '02 feb', note: 'Re-tesselado y orientación auto' },
    { v: 'v1.0', date: '14 ene', note: 'Versión inicial' },
  ],
  'M-0113': [
    { v: 'v2.1', date: '28 abr', note: 'Hex offset 0.2mm' },
    { v: 'v2.0', date: '02 abr', note: 'Drenaje + plato' },
    { v: 'v1.0', date: '14 mar', note: 'Versión inicial' },
  ],
};

// ─── company ─────────────────────────────────────────────────────────────
const COMPANY_PROFILE = {
  name: "Collector's Forge Studio",
  legalName: 'Collectors Forge SAS',
  nit: '901.234.567-8',
  address: 'Cra 43A #14-50, Of 902',
  city: 'Medellín · Antioquia',
  country: 'Colombia',
  phone: '+57 304 123 4567',
  email: 'hola@collectorsforge.studio',
  web: 'collectorsforge.studio',
  founded: '2024',
};
const COMPANY_BRANDING = {
  logoBg: '#0F1219',
  primary: '#2DD4BF',
  accent: '#F59E0B',
  pdfFooter: 'Cotización válida 15 días · Pagos vía Wompi o transferencia',
};
const COMPANY_RATES = {
  hourlyMachine: 8500,   // COP/h por impresora
  hourlyLabor:   28000,  // COP/h de operario
  marginDefault: 35,     // %
  rushSurcharge: 25,     // %
  designFee:     45000,  // COP fijo por diseño
  shippingMed:   8500,   // COP envío local Medellín
  ivaPct:        19,
};

// clients (lorem técnico)
const CLIENTS = [
  { id: 'CL-014', name: 'Aurora Cards',     contact: 'Mariana Vega',    email: 'mariana@auroracards.co',  phone: '+57 310 555 0114', kind: 'B2B',  city: 'Medellín', quotes: 6, jobs: 18, lastOrder: 'hoy',     totalSpent: 4280000, tier: 'gold' },
  { id: 'CL-013', name: 'Taller Mecano',    contact: 'Andrés Lopera',   email: 'andres@tallermecano.co',  phone: '+57 311 555 0113', kind: 'B2B',  city: 'Itagüí',   quotes: 4, jobs: 11, lastOrder: '2 días',  totalSpent: 2840000, tier: 'gold' },
  { id: 'CL-012', name: 'Verde Estudio',    contact: 'Laura Henao',     email: 'laura@verdestudio.co',    phone: '+57 312 555 0112', kind: 'B2B',  city: 'Envigado', quotes: 3, jobs: 9,  lastOrder: '4 días',  totalSpent: 1620000, tier: 'silver' },
  { id: 'CL-011', name: 'Lab Acústico',     contact: 'Pablo Gómez',     email: 'pablo@labacustico.co',    phone: '+57 313 555 0111', kind: 'B2B',  city: 'Medellín', quotes: 2, jobs: 5,  lastOrder: '14 días', totalSpent: 980000,  tier: 'silver' },
  { id: 'CL-010', name: 'Mecano Custom',    contact: 'Carlos Restrepo', email: 'carlos@mecanocustom.co',  phone: '+57 314 555 0110', kind: 'B2C',  city: 'Bello',    quotes: 1, jobs: 2,  lastOrder: '8 días',  totalSpent: 320000,  tier: 'standard' },
  { id: 'CL-009', name: 'Joaquín Pérez',    contact: 'Joaquín Pérez',   email: 'joaquin@gmail.com',       phone: '+57 315 555 0109', kind: 'B2C',  city: 'Medellín', quotes: 1, jobs: 1,  lastOrder: '21 días', totalSpent: 145000,  tier: 'standard' },
];

// vendors (proveedores)
const VENDORS = [
  { id: 'V-A', name: 'Vendor-A',  category: 'Filamento', contact: 'Cuentas A',  city: 'Bogotá',   leadDays: 3, openPOs: 1, totalSpent: 4120000, rating: 4.6, notes: 'PLA y PLA-CF premium.' },
  { id: 'V-B', name: 'Vendor-B',  category: 'Filamento', contact: 'Cuentas B',  city: 'Medellín', leadDays: 2, openPOs: 1, totalSpent: 2860000, rating: 4.4, notes: 'PETG industrial.' },
  { id: 'V-C', name: 'Vendor-C',  category: 'Filamento', contact: 'Cuentas C',  city: 'Cali',     leadDays: 5, openPOs: 1, totalSpent: 1980000, rating: 4.2, notes: 'TPU + ABS especial.' },
  { id: 'V-D', name: 'Hardware-D',category: 'Insumos',   contact: 'Logística D',city: 'Bogotá',   leadDays: 7, openPOs: 0, totalSpent: 820000,  rating: 4.5, notes: 'Boquillas y hotends.' },
];

// employees
const EMPLOYEES = [
  { id: 'EM-001', name: 'Giomar A.',    role: 'Owner · Operación',     email: 'giomar@collectorsforge.studio',    permissions: 'admin', joined: 'feb 2024', active: true, avatar: 'G', avatarTone: '#2DD4BF' },
  { id: 'EM-002', name: 'Sara M.',      role: 'Diseño + Comercial',    email: 'sara@collectorsforge.studio',      permissions: 'edit',  joined: 'abr 2024', active: true, avatar: 'S', avatarTone: '#A78BFA' },
  { id: 'EM-003', name: 'Téc Externo',  role: 'Mantto bimensual',      email: 'externo@servicios.co',             permissions: 'view',  joined: 'jun 2024', active: true, avatar: 'T', avatarTone: '#94A0AE' },
];

const COMPANY_TIER = {
  gold:     { color: '#FBBF24', bg: 'rgba(251, 191, 36, 0.10)', border: 'rgba(251, 191, 36, 0.30)', label: 'GOLD' },
  silver:   { color: '#94A0AE', bg: 'rgba(148, 160, 174, 0.10)', border: 'rgba(148, 160, 174, 0.30)', label: 'SILVER' },
  standard: { color: '#7A8494', bg: 'rgba(122, 132, 148, 0.10)', border: 'rgba(122, 132, 148, 0.25)', label: 'STD' },
};

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
  PRINTERS, SLICER_JOBS, SLICER_RECENT,
  QUEUE_JOBS, QUEUE_STATUSES,
  PRINTER_COMPONENTS, MAINT_TASKS, MAINT_HISTORY, PRINTER_CHECKLISTS,
  compStatus, printerHealth, MAINT_SEVERITY,
  VAULT_CATEGORIES, VAULT_MODELS, VAULT_FORMATS, VAULT_VERSIONS,
  COMPANY_PROFILE, COMPANY_BRANDING, COMPANY_RATES,
  CLIENTS, VENDORS, EMPLOYEES, COMPANY_TIER,
});
