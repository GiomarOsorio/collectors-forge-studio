/**
 * @file Calculadora de costos rediseñada (Claude Design port — Día 10).
 *
 * Versión simplificada con primitives del sistema. Cubre el flujo principal:
 * pieza, filamento, impresora, peso, tiempo, cantidad, margen. Funciones
 * avanzadas (multi-filamento, insumos extra, post-procesado largo) viven en
 * `/cost/calculator` (página antigua) hasta que se porten en una iteración
 * dedicada.
 *
 * Layout 2-col en desktop: form a la izquierda, resumen sticky a la derecha.
 * Mobile: form vertical + bottom-sheet con resumen al calcular.
 *
 * @module pages/cost/CalculatorPageV2
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Clock,
  Cpu,
  DollarSign,
  Hash,
  Layers,
  Printer,
  RefreshCw,
  Save,
  Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Card, KPI, Swatch } from '../../components/ui';
import { useIsMobile } from '../../hooks/useMediaQuery';
import {
  calculateQuote,
  createQuote,
  getInventoryFilaments,
  getPrinters,
} from '../../services/api';
import { fmtCOP, mapToFilament, normalizeHex, stockLevel } from '../../utils/inventoryAdapter';

const ACCENT = '#2DD4BF';

const initialForm = {
  piece_name: '',
  client_name: '',
  inventory_item_id: '',
  printer_id: '',
  weight_grams: '',
  print_time_hours: '',
  preparation_time_hours: '0',
  post_processing_time_hours: '0',
  quantity: '1',
  margin_percent: '',
};

export default function CalculatorPageV2() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();

  const [form, setForm] = useState(initialForm);
  const [filaments, setFilaments] = useState([]);
  const [printers, setPrinters] = useState([]);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [showSheet, setShowSheet] = useState(false);

  // Cargar filamentos + impresoras al montar
  useEffect(() => {
    Promise.allSettled([getInventoryFilaments(), getPrinters()])
      .then(([f, p]) => {
        if (f.status === 'fulfilled') setFilaments((f.value.data || []).map(mapToFilament));
        if (p.status === 'fulfilled') setPrinters(p.value.data || []);
      })
      .catch(() => toast.error('No se pudieron cargar los catálogos'));
  }, []);

  // Pre-fill desde query params (p.ej. desde /slicer/v2 → "Usar en calculadora")
  useEffect(() => {
    const updates = {};
    const w = searchParams.get('weight_grams');
    const t = searchParams.get('print_time_hours');
    const ft = searchParams.get('filament_type');
    if (w) updates.weight_grams = w;
    if (t) updates.print_time_hours = t;
    if (Object.keys(updates).length > 0) {
      setForm((cur) => ({ ...cur, ...updates }));
      toast.success('Datos del slicer pre-cargados');
    }
    if (ft && filaments.length > 0) {
      const match = filaments.find((f) => f.material === ft);
      if (match) setForm((cur) => ({ ...cur, inventory_item_id: String(match.id) }));
    }
  }, [searchParams, filaments]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const selectedFilament = useMemo(
    () => filaments.find((f) => String(f.id) === String(form.inventory_item_id)),
    [filaments, form.inventory_item_id],
  );

  const filamentLow = selectedFilament && stockLevel(selectedFilament) !== 'ok';

  const buildPayload = () => {
    const payload = {
      piece_name: form.piece_name || 'Pieza sin nombre',
      inventory_item_id: parseInt(form.inventory_item_id, 10),
      printer_id: parseInt(form.printer_id, 10),
      weight_grams: parseFloat(form.weight_grams),
      print_time_hours: parseFloat(form.print_time_hours),
      preparation_time_hours: parseFloat(form.preparation_time_hours || 0),
      post_processing_time_hours: parseFloat(form.post_processing_time_hours || 0),
      quantity: parseInt(form.quantity, 10) || 1,
    };
    if (form.client_name.trim()) payload.client_name = form.client_name.trim();
    if (form.margin_percent.trim()) payload.margin_percent = parseFloat(form.margin_percent);
    return payload;
  };

  const handleCalculate = async () => {
    if (!form.inventory_item_id || !form.printer_id || !form.weight_grams || !form.print_time_hours) {
      toast.error('Completa filamento, impresora, peso y tiempo');
      return;
    }
    setCalculating(true);
    try {
      const res = await calculateQuote(buildPayload());
      setResult(res.data);
      if (isMobile) setShowSheet(true);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al calcular');
    } finally {
      setCalculating(false);
    }
  };

  const handleSave = async () => {
    if (!result) {
      await handleCalculate();
      return;
    }
    setSaving(true);
    try {
      await createQuote(buildPayload());
      toast.success('Cotización guardada en historial');
      navigate('/cost/v2');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setForm(initialForm);
    setResult(null);
  };

  // ─── Form fields ────────────────────────────────────────────────────────
  const FormFields = (
    <Card className="p-5 flex flex-col gap-4">
      <div>
        <label className="lbl-eyebrow text-[9px]">Pieza</label>
        <input
          name="piece_name"
          value={form.piece_name}
          onChange={handleChange}
          placeholder="Nombre de la pieza"
          className="input mt-1"
        />
      </div>
      <div>
        <label className="lbl-eyebrow text-[9px]">Cliente (opcional)</label>
        <input
          name="client_name"
          value={form.client_name}
          onChange={handleChange}
          placeholder="Nombre del cliente"
          className="input mt-1"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="lbl-eyebrow text-[9px] inline-flex items-center gap-1">
            <Layers size={10} /> Filamento
          </label>
          <select
            name="inventory_item_id"
            value={form.inventory_item_id}
            onChange={handleChange}
            className="input mt-1"
            required
          >
            <option value="">Seleccionar…</option>
            {filaments.map((f) => {
              const noStock = f.remaining === 0;
              return (
                <option key={f.id} value={f.id} disabled={noStock}>
                  {f.material} · {f.colorName}
                  {noStock ? ' (Sin stock)' : ''}
                </option>
              );
            })}
          </select>
          {selectedFilament && (
            <div className="mt-2 flex items-center gap-2 px-2.5 py-2 rounded-md bg-[var(--color-surf-card-2)] border border-[var(--color-border-soft)]">
              <Swatch
                color={normalizeHex(selectedFilament.color)}
                size={28}
                level={stockLevel(selectedFilament)}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-tech-white truncate">{selectedFilament.colorName}</p>
                <p className="mono text-[10px] text-gunmetal">
                  {selectedFilament.remaining}g restantes · {fmtCOP(selectedFilament.costPerKg)}/kg
                </p>
              </div>
              {filamentLow && (
                <span
                  className="mono inline-flex items-center gap-1 text-[9px] px-1.5 py-px rounded-sm bg-amber-400/10 border border-amber-400/30 text-amber-400 tracking-wider"
                >
                  <AlertTriangle size={9} /> BAJO
                </span>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="lbl-eyebrow text-[9px] inline-flex items-center gap-1">
            <Printer size={10} /> Impresora
          </label>
          <select
            name="printer_id"
            value={form.printer_id}
            onChange={handleChange}
            className="input mt-1"
            required
          >
            <option value="">Seleccionar…</option>
            {printers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="lbl-eyebrow text-[9px]">Peso (g)</label>
          <input
            name="weight_grams"
            type="number"
            step="0.1"
            min="0"
            value={form.weight_grams}
            onChange={handleChange}
            className="input mt-1 mono"
            required
          />
        </div>
        <div>
          <label className="lbl-eyebrow text-[9px]">Tiempo (h)</label>
          <input
            name="print_time_hours"
            type="number"
            step="0.01"
            min="0"
            value={form.print_time_hours}
            onChange={handleChange}
            className="input mt-1 mono"
            required
          />
        </div>
        <div>
          <label className="lbl-eyebrow text-[9px] inline-flex items-center gap-1">
            <Hash size={10} /> Cant.
          </label>
          <input
            name="quantity"
            type="number"
            step="1"
            min="1"
            value={form.quantity}
            onChange={handleChange}
            className="input mt-1 mono"
          />
        </div>
        <div>
          <label className="lbl-eyebrow text-[9px]">Margen %</label>
          <input
            name="margin_percent"
            type="number"
            step="1"
            min="0"
            max="100"
            value={form.margin_percent}
            onChange={handleChange}
            placeholder="default"
            className="input mt-1 mono"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="lbl-eyebrow text-[9px] inline-flex items-center gap-1">
            <Clock size={10} /> Preparación (h)
          </label>
          <input
            name="preparation_time_hours"
            type="number"
            step="0.1"
            min="0"
            value={form.preparation_time_hours}
            onChange={handleChange}
            className="input mt-1 mono"
          />
        </div>
        <div>
          <label className="lbl-eyebrow text-[9px] inline-flex items-center gap-1">
            <Clock size={10} /> Post-procesado (h)
          </label>
          <input
            name="post_processing_time_hours"
            type="number"
            step="0.1"
            min="0"
            value={form.post_processing_time_hours}
            onChange={handleChange}
            className="input mt-1 mono"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-3 border-t border-[var(--color-border-soft)]">
        <Button
          variant="primary"
          icon={Calculator}
          onClick={handleCalculate}
          disabled={calculating}
          className="flex-1"
        >
          {calculating ? 'Calculando…' : 'Calcular'}
        </Button>
        <Button variant="ghost" icon={RefreshCw} onClick={handleReset}>
          Limpiar
        </Button>
      </div>
    </Card>
  );

  // ─── Resumen panel ──────────────────────────────────────────────────────
  const SummaryPanel = (
    <Card className="p-5 flex flex-col gap-4 sticky top-4">
      <div className="flex items-center gap-2">
        <DollarSign size={16} style={{ color: ACCENT }} />
        <span className="lbl-eyebrow">Resumen</span>
      </div>

      {!result ? (
        <div className="py-8 text-center">
          <Calculator size={28} className="text-gunmetal-dim mx-auto mb-2" />
          <p className="text-sm text-gunmetal">
            Completa el formulario y presiona Calcular para ver el desglose.
          </p>
        </div>
      ) : (
        <>
          <div className="text-center py-3 border-b border-[var(--color-border-soft)]">
            <p className="lbl-eyebrow text-[9px]">Precio total</p>
            <p className="mono text-3xl font-semibold text-forge-teal mt-1">
              {fmtCOP(result.total_price_cop ?? result.total_price)}
            </p>
            <p className="mono text-[11px] text-gunmetal mt-1">
              {fmtCOP(result.total_per_unit_cop ?? result.total_per_unit)} por unidad
            </p>
          </div>

          <ul className="flex flex-col gap-1.5 text-sm">
            {[
              { label: 'Material', val: result.material_cost, icon: Layers },
              { label: 'Electricidad', val: result.electricity_cost, icon: Zap },
              { label: 'Depreciación', val: result.depreciation_cost, icon: Cpu },
              { label: 'Mantenimiento', val: result.maintenance_cost, icon: Cpu },
              { label: 'Mano de obra', val: result.labor_cost, icon: Clock },
              { label: 'Falla esperada', val: result.failure_cost, icon: AlertTriangle },
            ].map((row) => {
              const Icon = row.icon;
              return row.val != null ? (
                <li key={row.label} className="flex items-center justify-between gap-2 px-2 py-1 rounded">
                  <span className="inline-flex items-center gap-1.5 text-steel">
                    <Icon size={11} />
                    {row.label}
                  </span>
                  <span className="mono text-tech-white">{fmtCOP(row.val)}</span>
                </li>
              ) : null;
            })}
          </ul>

          <div className="border-t border-dashed border-[var(--color-border-soft)] pt-2 flex flex-col gap-1 text-sm">
            <div className="flex justify-between">
              <span className="text-steel">Subtotal</span>
              <span className="mono text-tech-white">{fmtCOP(result.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-steel">Margen ({Math.round(Number(result.margin_percent))}%)</span>
              <span className="mono text-tech-white">+{fmtCOP(result.margin_amount)}</span>
            </div>
          </div>

          <Button variant="primary" icon={Save} onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar cotización'}
          </Button>

          <Link to="/cost/calculator" className="text-[11px] text-gunmetal hover:text-steel text-center">
            Necesitas multi-filamento o insumos? → calculadora completa
          </Link>
        </>
      )}
    </Card>
  );

  // ── Mobile shell ─────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="flex flex-col pb-8">
        <div className="px-4 mt-3">
          <Card className="p-4 flex flex-col gap-2 industrial-grid">
            <div className="flex items-baseline justify-between">
              <span className="lbl-eyebrow">Calcular pieza</span>
              <Link to="/cost/v2" className="mono text-[11px] text-teal-400 hover:underline">
                Ver historial
              </Link>
            </div>
            <p className="text-sm text-steel">
              Ingresa los datos y obtén el costo real (material + electricidad + depreciación + mano de obra + margen).
            </p>
          </Card>
        </div>
        <div className="px-4 mt-3">{FormFields}</div>

        {result && (
          <div className="px-4 mt-3">
            <Card className="p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="lbl-eyebrow text-[9px]">Total</p>
                <p className="mono text-base font-semibold text-forge-teal truncate">
                  {fmtCOP(result.total_price_cop ?? result.total_price)}
                </p>
              </div>
              <Button variant="primary" size="sm" onClick={() => setShowSheet(true)}>
                Ver desglose
              </Button>
            </Card>
          </div>
        )}

        {showSheet && result && (
          <div
            className="fixed inset-0 z-50 bg-black/60 flex items-end"
            onClick={() => setShowSheet(false)}
          >
            <div
              className="w-full bg-[var(--color-surf-sidebar)] border-t border-[var(--color-border-soft)] rounded-t-2xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center pt-2">
                <span className="block w-10 h-1 rounded-full bg-[var(--color-border-strong)]" />
              </div>
              <div className="p-4">{SummaryPanel}</div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Desktop shell ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen -m-4 md:-m-6 xl:-m-8">
      <header className="flex items-center gap-4 px-6 py-3.5 border-b border-[var(--color-border-soft)] bg-[var(--color-surf-sidebar)] sticky top-0 z-20">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-md shrink-0"
            style={{ background: `${ACCENT}1F`, color: ACCENT, border: `1px solid ${ACCENT}40` }}
          >
            <Calculator size={13} />
          </span>
          <span className="text-sm text-gunmetal whitespace-nowrap">Cost</span>
          <span className="text-gunmetal-dim shrink-0">›</span>
          <span className="text-sm font-semibold text-tech-white whitespace-nowrap">Calculadora</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/cost/calculator" className="btn btn-ghost btn-sm">
            <Layers size={13} /> Calculadora completa
          </Link>
          <Link to="/cost/v2" className="btn btn-ghost btn-sm">
            Ver historial
          </Link>
        </div>
      </header>

      <div className="flex flex-wrap gap-3 px-6 pt-4 pb-2">
        <div className="flex-1 min-w-[180px] flex">
          <KPI label="Filamentos disponibles" value={filaments.length} unit="docs" sub={`${filaments.filter((f) => stockLevel(f) === 'ok').length} con stock ok`} accent="#3B82F6" icon={Layers} />
        </div>
        <div className="flex-1 min-w-[180px] flex">
          <KPI label="Impresoras" value={printers.length} unit="docs" sub="catálogo" accent={ACCENT} icon={Printer} />
        </div>
        <div className="flex-1 min-w-[180px] flex">
          <KPI label="Pre-fill" value={searchParams.get('weight_grams') || searchParams.get('print_time_hours') ? '✓' : '—'} sub={searchParams.get('weight_grams') ? 'desde slicer' : 'sin pre-fill'} accent="#FBBF24" icon={CheckCircle2} />
        </div>
      </div>

      <div className="px-6 pt-4 pb-8 grid gap-4" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 380px)' }}>
        <div>{FormFields}</div>
        <div>{SummaryPanel}</div>
      </div>

      <footer className="mt-auto px-6 py-2.5 border-t border-[var(--color-border-soft)] bg-[var(--color-surf-sidebar)] flex flex-wrap items-center gap-4 text-[11px] text-gunmetal">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px #34D39966' }} />
          <span className="mono">CONECTADO</span>
        </span>
        <span className="w-px h-3 bg-[var(--color-border)]" />
        <span className="mono">Calculadora simplificada · v2</span>
        <span className="flex-1" />
        <span className="mono">es-CO · COP</span>
      </footer>
    </div>
  );
}
