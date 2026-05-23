/**
 * @file Calculadora de costos v2 (port del design Claude Design).
 *
 * Layout 3-col desktop (form scroll · resultado sticky · breakdown) y
 * vertical + sticky footer + bottom-sheet en mobile. El cálculo es
 * reactivo: cada cambio dispara `calculateQuote` debounced 300 ms (#61).
 *
 * Resuelve issues:
 *   #60 — tab Calculadora renderiza el componente (route ya conectada)
 *   #61 — sin botón "Calcular": reactivo con debounce 300ms
 *   #75 — banner + modal warning si tarifa eléctrica no es del mes actual
 *   #76 — FilamentSelect filtra `excludeIds` y muestra `locked` grayed-out
 *         (mismo comportamiento en selector principal y multi-material)
 *   #77 — botón "Reimprimir esta pieza" +15% adicional por fallos
 *
 * Sub-componentes module-level (anti-pattern §0.12: no helpers internos
 * en form para evitar pérdida de foco).
 *
 * @module pages/CalculatorPage
 */

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Calculator, Save, AlertTriangle, RotateCcw, Loader2, Plus, X, Trash2,
  Clock, Cpu, Zap, Droplet, TrendingUp, ArrowUpRight, History, FileText,
  Check, Settings as SettingsIcon, AlertCircle,
} from 'lucide-react';
import {
  getInventoryFilaments,
  getInventoryItems,
  getPrinters,
  getSettings,
  getElectricityTariffs,
  calculateQuote,
  createQuote,
} from '../services/api';
import { MobileSheet, StatusPill } from '../components/ui';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useIsMobile } from '../hooks/useMediaQuery';
import { isKwhTariffStale, formatTariffPeriod, currentTariffPeriod } from '../utils/tariff';
import { fmtCOP, fmtUSD } from '../utils/inventoryAdapter';

const ACCENT = '#2DD4BF';        // forge-teal — app Cost
const AMBER = '#FBBF24';         // warning
const REPRINT_TONE = '#FB923C';  // orange — reprint chip

// ─── Module-level sub-componentes (anti-pattern §0.12) ─────────────────────

function FormSection({ title, children, accent }) {
  return (
    <section className="mb-4">
      <h3 className="mono mb-2 text-[10.5px] uppercase tracking-[0.16em] text-steel whitespace-nowrap">
        {title}
      </h3>
      <div className={`flex flex-col gap-2 ${accent ? '' : ''}`}>{children}</div>
    </section>
  );
}

function FormFieldRow({ label, required, hint, error, children }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <label className="mono text-[9.5px] uppercase tracking-[0.12em] text-gunmetal">
          {label} {required && <span className="text-rose-400">*</span>}
        </label>
        {error && <span className="text-[10.5px] font-medium text-rose-400 whitespace-nowrap">{error}</span>}
      </div>
      {children}
      {hint && !error && (
        <div className="mono mt-0.5 text-[9.5px] text-gunmetal-dim">{hint}</div>
      )}
    </div>
  );
}

const FORM_INPUT_CLS =
  'w-full bg-[var(--color-surf-card)] border border-[var(--color-border-strong)] rounded-md px-3 py-2 text-[13px] text-tech-white outline-none focus:border-forge-teal/60';

function FormInput({ value, onChange, type = 'text', placeholder, mono, suffix, min, max, step }) {
  const className = `${FORM_INPUT_CLS} ${mono ? 'mono' : ''}`;
  if (suffix) {
    return (
      <div className="flex items-stretch bg-[var(--color-surf-card)] border border-[var(--color-border-strong)] rounded-md overflow-hidden focus-within:border-forge-teal/60">
        <input
          type={type} value={value ?? ''} placeholder={placeholder}
          min={min} max={max} step={step}
          onChange={(e) => onChange && onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
          className={`flex-1 bg-transparent border-0 px-3 py-2 text-[13px] text-tech-white outline-none ${mono ? 'mono' : ''}`}
        />
        <span className="mono px-3 self-center text-[11px] text-gunmetal border-l border-[var(--color-border)] flex items-center">
          {suffix}
        </span>
      </div>
    );
  }
  return (
    <input
      type={type} value={value ?? ''} placeholder={placeholder}
      min={min} max={max} step={step}
      onChange={(e) => onChange && onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
      className={className}
    />
  );
}

function Stepper({ value, onChange, suffix, min = 0, max = 99999, step = 1 }) {
  const dec = () => onChange(Math.max(min, (Number(value) || 0) - step));
  const inc = () => onChange(Math.min(max, (Number(value) || 0) + step));
  return (
    <div className="flex items-stretch bg-[var(--color-surf-card)] border border-[var(--color-border-strong)] rounded-md overflow-hidden focus-within:border-forge-teal/60">
      <button type="button" onClick={dec} className="w-8 bg-[var(--color-surf-card-2)] border-r border-[var(--color-border)] text-steel font-semibold text-base hover:text-tech-white">−</button>
      <input
        type="number" value={value ?? 0}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min} max={max} step={step}
        className="flex-1 bg-transparent border-0 outline-0 text-tech-white mono text-center text-[13px] font-semibold"
      />
      {suffix && (
        <span className="mono px-2 self-center text-[10.5px] text-gunmetal">{suffix}</span>
      )}
      <button type="button" onClick={inc} className="w-8 bg-[var(--color-surf-card-2)] border-l border-[var(--color-border)] text-steel font-semibold text-base hover:text-tech-white">+</button>
    </div>
  );
}

function FormChips({ value, onChange, options }) {
  return (
    <div className="inline-flex gap-0.5 p-0.5 bg-[var(--color-surf-card-2)] border border-[var(--color-border-strong)] rounded-md">
      {options.map((o) => {
        const active = value === o.id;
        const tone = o.tone || ACCENT;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={active}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-[11.5px] font-medium whitespace-nowrap transition-colors"
            style={{
              background: active ? `color-mix(in oklab, ${tone} 16%, transparent)` : 'transparent',
              color: active ? tone : 'var(--color-steel)',
            }}
          >
            {o.icon && <o.icon size={11} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * FilamentSelect — selector con bloqueados grayed-out (issue #76).
 * Mismo componente para principal y adicionales. `excludeIds` filtra los
 * ya elegidos en multi-material para no duplicar.
 */
function FilamentSelect({ items, value, onChange, excludeIds = [] }) {
  const list = items.filter((f) => !excludeIds.includes(f.id));
  if (list.length === 0) {
    return (
      <div className="text-[12px] text-gunmetal italic px-2 py-3">
        Sin filamentos disponibles. Agrega uno en /inventory.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1 max-h-60 overflow-y-auto p-1 bg-[var(--color-surf-card)] border border-[var(--color-border-strong)] rounded-lg">
      {list.map((f) => {
        const locked = f.is_active === false || f.is_archived === true;
        const active = String(value) === String(f.id);
        const colorHex = f.filament_color_hex || f.color_hex || '#94A0AE';
        const remaining = Number(f.quantity || 0);
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => !locked && onChange(f.id)}
            aria-disabled={locked}
            aria-pressed={active}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-colors"
            style={{
              background: active ? `color-mix(in oklab, ${ACCENT} 12%, transparent)` : 'transparent',
              border: active ? `1px solid color-mix(in oklab, ${ACCENT} 30%, transparent)` : '1px solid transparent',
              opacity: locked ? 0.5 : 1,
              cursor: locked ? 'not-allowed' : 'pointer',
            }}
            title={locked ? 'Filamento bloqueado o archivado' : undefined}
          >
            <span
              className="w-5 h-5 rounded-full shrink-0 border border-black/30"
              style={{
                background: `radial-gradient(circle at 30% 28%, ${colorHex}ee, ${colorHex})`,
                filter: locked ? 'grayscale(60%)' : 'none',
              }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] font-medium text-tech-white truncate">
                  {f.name}
                </span>
                {locked && (
                  <AlertCircle size={10} className="text-gunmetal shrink-0" />
                )}
              </div>
              <div className="mono text-[9.5px] text-gunmetal mt-0.5">
                {f.id} · {f.filament_type || f.material || '—'} · {formatGrams(remaining)}
              </div>
            </div>
            {f.price_per_kg != null && (
              <span className="mono text-[11px] text-steel whitespace-nowrap shrink-0">
                {fmtUSD(Number(f.price_per_kg))}/kg
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function formatGrams(g) {
  if (g >= 1000) return `${(g / 1000).toFixed(2)} kg`;
  return `${Math.round(g)} g`;
}

function StaleTariffBanner({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11.5px] font-medium animate-pulse-soft"
      style={{
        background: `color-mix(in oklab, ${AMBER} 12%, transparent)`,
        border: `1px solid color-mix(in oklab, ${AMBER} 36%, transparent)`,
        color: AMBER,
      }}
    >
      <AlertTriangle size={12} />
      Tarifa eléctrica desactualizada
    </button>
  );
}

function StaleTariffModal({ open, onClose, tariffPeriod, currentRate }) {
  if (!open) return null;
  const tariffLabel = formatTariffPeriod(tariffPeriod);
  const currentLabel = formatTariffPeriod(currentTariffPeriod());
  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-[90] backdrop-blur-sm"
        style={{ background: 'rgba(6, 9, 18, 0.66)' }}
      />
      <div
        role="dialog"
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[91] w-[min(480px,calc(100vw-32px))] p-6 rounded-2xl shadow-2xl"
        style={{
          background: 'var(--color-surf-card)',
          border: `1px solid color-mix(in oklab, ${AMBER} 28%, var(--color-border-strong))`,
        }}
      >
        <div
          className="w-14 h-14 rounded-2xl inline-flex items-center justify-center mb-3.5"
          style={{
            background: `color-mix(in oklab, ${AMBER} 14%, transparent)`,
            border: `1px solid color-mix(in oklab, ${AMBER} 30%, transparent)`,
            color: AMBER,
          }}
        >
          <AlertTriangle size={26} />
        </div>
        <h2 className="m-0 mb-2 text-[18px] font-semibold text-tech-white tracking-tight">
          Tarifa eléctrica desactualizada
        </h2>
        <p className="m-0 text-[13px] leading-[1.55] text-steel">
          La tarifa configurada es de{' '}
          <span className="mono font-semibold" style={{ color: AMBER }}>{tariffLabel}</span>.
          No corresponde al mes actual{' '}
          (<span className="mono text-tech-white font-semibold">{currentLabel}</span>).
          Actualízala en Settings antes de generar una cotización.
        </p>
        {currentRate != null && (
          <div className="mt-3.5 p-3 flex items-center gap-2.5 rounded-lg" style={{ background: 'var(--color-surf-card-2)', border: '1px solid var(--color-border)' }}>
            <span className="mono text-[10.5px] text-gunmetal">EPM kWh</span>
            <span className="mono text-[14px] font-semibold text-tech-white">
              {fmtCOP(currentRate)}/kWh
            </span>
            <span
              className="ml-auto mono px-2 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider"
              style={{
                background: `color-mix(in oklab, ${AMBER} 10%, transparent)`,
                border: `1px solid color-mix(in oklab, ${AMBER} 25%, transparent)`,
                color: AMBER,
              }}
            >
              {tariffLabel}
            </span>
          </div>
        )}
        <div className="mt-5 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12.5px] font-medium text-steel border border-[var(--color-border-strong)] hover:text-tech-white"
          >
            Ignorar y continuar
          </button>
          <a
            href="/cost/settings"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12.5px] font-semibold"
            style={{ background: AMBER, color: '#231803' }}
          >
            <SettingsIcon size={12} /> Ir a settings
          </a>
        </div>
      </div>
    </>
  );
}

// ─── Header ─────────────────────────────────────────────────────────────────

function CalcHeader({ isStale, onOpenStaleModal }) {
  return (
    <header className="flex items-center gap-3.5 px-5 py-3.5 border-b border-[var(--color-border-soft)] bg-forge-black">
      <div
        className="w-9 h-9 rounded-lg shrink-0 inline-flex items-center justify-center"
        style={{
          background: `color-mix(in oklab, ${ACCENT} 14%, transparent)`,
          border: `1px solid color-mix(in oklab, ${ACCENT} 32%, transparent)`,
          color: ACCENT,
        }}
      >
        <Calculator size={17} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="mono inline-flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.14em] text-gunmetal">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: ACCENT }} />
          Cost · Calculadora
        </div>
        <h1 className="m-0 text-[18px] font-semibold text-tech-white tracking-tight whitespace-nowrap">
          Cotizar pieza
        </h1>
      </div>
      {isStale && (
        <StaleTariffBanner onClick={onOpenStaleModal} />
      )}
    </header>
  );
}

// ─── Result column ─────────────────────────────────────────────────────────

function ResultStat({ icon: Icon, label, value, sub }) {
  return (
    <div className="p-3 rounded-lg bg-[var(--color-surf-card)] border border-[var(--color-border)]">
      <div className="mono flex items-center gap-1 text-[9px] uppercase tracking-[0.12em] text-gunmetal">
        <Icon size={10} /> {label}
      </div>
      <div className="mono mt-0.5 text-[15px] font-semibold text-tech-white whitespace-nowrap">
        {value}
      </div>
      {sub && <div className="mono mt-0.5 text-[10px] text-gunmetal-dim">{sub}</div>}
    </div>
  );
}

function CalcResult({ result, form, calcLoading, calcError, onReprint, onGenerateQuote, savingQuote }) {
  const hasResult = result && !calcError;
  return (
    <div
      className="p-5 border-r border-[var(--color-border-soft)] flex flex-col gap-3.5 overflow-y-auto"
      style={{
        background: `linear-gradient(180deg, color-mix(in oklab, ${ACCENT} 4%, var(--color-forge-black)), var(--color-forge-black))`,
      }}
    >
      <header>
        <div className="mono inline-flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.14em] text-gunmetal">
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: ACCENT }} />
          Resultado · {form.quantity || 1} {form.quantity === 1 ? 'unidad' : 'unidades'}
        </div>
        <div className="mt-0.5 text-[13px] font-semibold text-tech-white truncate">
          {form.piece_name || 'Pieza sin nombre'}
        </div>
      </header>

      <div
        className="relative p-4 rounded-2xl overflow-hidden"
        style={{
          background: 'var(--color-surf-card)',
          border: `1px solid color-mix(in oklab, ${ACCENT} 22%, var(--color-border))`,
        }}
      >
        <div
          className="absolute -top-7 -right-5 w-32 h-32 rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, color-mix(in oklab, ${ACCENT} 18%, transparent), transparent 70%)` }}
        />
        <div className="mono relative text-[9.5px] uppercase tracking-[0.14em] text-gunmetal mb-1.5">
          Total cotización
        </div>
        {calcLoading && !hasResult ? (
          <div className="text-[13px] text-gunmetal">Calculando…</div>
        ) : calcError ? (
          <div className="text-[13px] text-rose-400">{calcError}</div>
        ) : hasResult ? (
          <>
            <div className="relative flex items-baseline gap-1.5">
              <span className="mono text-[32px] font-semibold text-tech-white -tracking-wide">
                {fmtCOP(Number(result.total_price_cop ?? result.total_price ?? 0))}
              </span>
              <span className="mono text-[12px] text-gunmetal">COP</span>
            </div>
            <div className="mono relative mt-2 text-[11px] text-steel">
              {fmtCOP(Number(result.unit_price_cop ?? result.unit_price ?? result.total_price_cop ?? 0))}{' '}
              <span className="text-gunmetal-dim">por unidad</span>
            </div>
            {form.mode === 'reprint' && (
              <div
                className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10.5px] mono"
                style={{
                  background: `color-mix(in oklab, ${REPRINT_TONE} 12%, transparent)`,
                  border: `1px solid color-mix(in oklab, ${REPRINT_TONE} 28%, transparent)`,
                  color: REPRINT_TONE,
                }}
              >
                <AlertCircle size={11} /> Reimpresión por fallos (+15%)
              </div>
            )}
          </>
        ) : (
          <div className="text-[13px] text-gunmetal">Completa el form para ver el total.</div>
        )}
      </div>

      {hasResult && (
        <div className="grid grid-cols-2 gap-1.5">
          <ResultStat
            icon={Clock}
            label="Tiempo"
            value={`${(Number(result.print_time_hours) || 0).toFixed(2)} h`}
          />
          <ResultStat
            icon={Zap}
            label="Energía"
            value={`${((Number(result.electricity_kwh) || 0)).toFixed(2)} kWh`}
            sub={fmtCOP(Number(result.electricity_cost_cop) || 0)}
          />
          <ResultStat
            icon={Droplet}
            label="Material"
            value={`${form.weight_grams || 0} g`}
            sub={fmtUSD(Number(result.material_cost_usd) || 0)}
          />
          <ResultStat
            icon={TrendingUp}
            label="Margen"
            value={`${form.margin_percent || 0}%`}
            sub={fmtCOP(Number(result.margin_amount_cop) || 0)}
          />
        </div>
      )}

      <div className="mt-auto flex flex-col gap-2">
        <button
          type="button"
          onClick={onGenerateQuote}
          disabled={!hasResult || savingQuote}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-3 rounded-lg text-[13px] font-semibold disabled:opacity-50"
          style={{ background: ACCENT, color: '#0A1014', border: 0 }}
        >
          {savingQuote ? <Loader2 size={13} className="animate-spin" /> : <ArrowUpRight size={13} />}
          {savingQuote ? 'Guardando…' : 'Guardar en historial'}
        </button>
        <button
          type="button"
          onClick={onReprint}
          disabled={!hasResult}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-lg text-[12.5px] font-medium disabled:opacity-50"
          style={{
            background: form.mode === 'reprint' ? `color-mix(in oklab, ${REPRINT_TONE} 16%, transparent)` : 'var(--color-surf-card-2)',
            border: `1px solid ${form.mode === 'reprint' ? `color-mix(in oklab, ${REPRINT_TONE} 40%, transparent)` : 'var(--color-border-strong)'}`,
            color: form.mode === 'reprint' ? REPRINT_TONE : 'var(--color-steel)',
          }}
        >
          <RotateCcw size={12} />
          {form.mode === 'reprint' ? 'Reimpresión aplicada' : 'Reimprimir esta pieza (+15%)'}
        </button>
      </div>
    </div>
  );
}

// ─── Breakdown column ──────────────────────────────────────────────────────

function BreakLine({ label, valueCOP, valueUSD, hint, icon: Icon, tone, last }) {
  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2.5"
      style={{ borderBottom: last ? 0 : '1px solid var(--color-border-soft)' }}
    >
      <span
        className="w-7 h-7 rounded-md shrink-0 inline-flex items-center justify-center"
        style={{
          background: `color-mix(in oklab, ${tone} 14%, transparent)`,
          border: `1px solid color-mix(in oklab, ${tone} 28%, transparent)`,
          color: tone,
        }}
      >
        <Icon size={12} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-medium text-tech-white">{label}</div>
        {hint && <div className="mono text-[9.5px] text-gunmetal-dim mt-0.5">{hint}</div>}
      </div>
      <div className="text-right">
        <div className="mono text-[12.5px] font-semibold text-tech-white">{fmtCOP(valueCOP)}</div>
        {valueUSD != null && (
          <div className="mono text-[9.5px] text-gunmetal mt-0.5">{fmtUSD(valueUSD)}</div>
        )}
      </div>
    </div>
  );
}

function SubtotalLine({ label, value, highlight, bold }) {
  return (
    <div className="flex items-baseline justify-between px-1 py-1">
      <span
        className={`${bold ? 'font-semibold text-[13px]' : 'font-medium text-[12px]'} ${highlight || bold ? 'text-tech-white' : 'text-steel'}`}
      >
        {label}
      </span>
      <span
        className={`mono ${bold ? 'text-[17px]' : 'text-[14px]'} font-semibold ${highlight ? 'text-forge-teal' : 'text-tech-white'}`}
      >
        {fmtCOP(value)}
      </span>
    </div>
  );
}

function CalcBreakdown({ result, form, exchangeRate }) {
  if (!result) {
    return (
      <div className="p-5 bg-[var(--color-surf-sidebar)] overflow-y-auto">
        <div className="mono text-[9.5px] uppercase tracking-[0.14em] text-gunmetal">Desglose</div>
        <p className="mt-3 text-[12px] text-gunmetal">
          Una vez completes el form, acá aparecerá el desglose de cada componente del costo.
        </p>
      </div>
    );
  }
  const materialCOP = Number(result.material_cost_cop ?? (result.material_cost_usd || 0) * (exchangeRate || 0));
  const materialUSD = Number(result.material_cost_usd ?? 0);
  const machineCOP = Number(result.machine_cost_cop ?? result.depreciation_cost_cop ?? 0);
  const energyCOP = Number(result.electricity_cost_cop ?? 0);
  const laborCOP = Number(result.labor_cost_cop ?? 0);
  const subtotalCOP = Number(result.subtotal_cop ?? result.cost_before_margin_cop ?? (materialCOP + machineCOP + energyCOP + laborCOP));
  const marginCOP = Number(result.margin_amount_cop ?? 0);
  const ivaCOP = Number(result.iva_cop ?? 0);
  const perUnitCOP = Number(result.unit_price_cop ?? result.total_price_cop ?? 0);
  const finalCOP = Number(result.total_price_cop ?? result.total_price ?? 0);
  const isReprint = form.mode === 'reprint';
  const reprintCOP = isReprint ? subtotalCOP * 0.15 : 0;

  return (
    <div className="p-5 bg-[var(--color-surf-sidebar)] flex flex-col gap-3.5 overflow-y-auto">
      <header>
        <div className="mono text-[9.5px] uppercase tracking-[0.14em] text-gunmetal">
          Desglose · 1 unidad
        </div>
        <div className="mt-0.5 text-[13px] font-semibold text-tech-white">
          Cómo se compone el precio
        </div>
      </header>

      <div className="rounded-lg overflow-hidden border border-[var(--color-border)] bg-[var(--color-surf-card)]">
        <BreakLine label="Material" icon={Droplet} tone="#3B82F6" valueCOP={materialCOP} valueUSD={materialUSD} hint={`${form.weight_grams || 0}g · principal + multi-material`} />
        <BreakLine label="Máquina" icon={Cpu} tone="#A78BFA" valueCOP={machineCOP} hint="Amortización por hora" />
        <BreakLine label="Energía" icon={Zap} tone={AMBER} valueCOP={energyCOP} hint="Watts × horas × tarifa kWh" />
        <BreakLine label="Trabajo" icon={Calculator} tone="#34D399" valueCOP={laborCOP} last hint="Prep + post-procesamiento" />
      </div>

      <SubtotalLine label="Subtotal antes de margen" value={subtotalCOP} />

      {reprintCOP > 0 && (
        <div
          className="px-3 py-2.5 rounded-lg flex items-center gap-2.5"
          style={{
            background: `color-mix(in oklab, ${REPRINT_TONE} 8%, transparent)`,
            border: `1px solid color-mix(in oklab, ${REPRINT_TONE} 25%, transparent)`,
          }}
        >
          <AlertCircle size={13} style={{ color: REPRINT_TONE }} />
          <span className="flex-1 text-[12px] font-medium text-tech-white">
            Reimpresión por fallos (+15%)
          </span>
          <span className="mono text-[13px] font-semibold text-tech-white">
            {fmtCOP(reprintCOP)}
          </span>
        </div>
      )}

      <div className="rounded-lg overflow-hidden border border-[var(--color-border)] bg-[var(--color-surf-card)]">
        <BreakLine label={`Margen (${form.margin_percent || 0}%)`} icon={TrendingUp} tone={ACCENT} valueCOP={marginCOP} hint="Ganancia operativa" last={ivaCOP === 0} />
        {ivaCOP > 0 && (
          <BreakLine label="IVA (19%)" icon={Calculator} tone="#6366F1" valueCOP={ivaCOP} hint="Aplicado al subtotal con margen" last />
        )}
      </div>

      <SubtotalLine label="Total por unidad" value={perUnitCOP} highlight />
      <SubtotalLine label={`Total × ${form.quantity || 1} ${form.quantity === 1 ? 'unidad' : 'unidades'}`} value={finalCOP} bold />

      {result.usd_to_cop_rate != null && (
        <div className="px-3 py-2 rounded-lg flex items-center gap-2 text-[10.5px] text-gunmetal" style={{ background: 'var(--color-surf-card-2)', border: '1px solid var(--color-border-soft)' }}>
          <ArrowUpRight size={11} />
          <span className="mono">USD → COP @ {Number(result.usd_to_cop_rate).toLocaleString('es-CO')}</span>
        </div>
      )}
    </div>
  );
}

// ─── Form column ───────────────────────────────────────────────────────────

const MODE_OPTIONS = [
  { id: 'standard', label: 'Estándar', icon: Check },
  { id: 'reprint',  label: 'Reimpresión +15%', icon: RotateCcw, tone: REPRINT_TONE },
];

function CalcForm({ form, setField, filaments, printers, errors }) {
  const printerOpts = printers.map((p) => ({ id: p.id, label: `${p.brand || ''} ${p.model || p.name}`.trim(), aside: `${p.watts || '?'}W` }));
  const addExtra = () => {
    const ids = form.additional_filaments_ids || [];
    const grams = form.additional_filaments_grams || [];
    setField('additional_filaments_ids', [...ids, '']);
    setField('additional_filaments_grams', [...grams, 0]);
  };
  const removeExtra = (idx) => {
    const ids = [...(form.additional_filaments_ids || [])];
    const grams = [...(form.additional_filaments_grams || [])];
    ids.splice(idx, 1);
    grams.splice(idx, 1);
    setField('additional_filaments_ids', ids);
    setField('additional_filaments_grams', grams);
  };
  const updateExtraId = (idx, v) => {
    const next = [...(form.additional_filaments_ids || [])];
    next[idx] = v;
    setField('additional_filaments_ids', next);
  };
  const updateExtraGrams = (idx, v) => {
    const next = [...(form.additional_filaments_grams || [])];
    next[idx] = v;
    setField('additional_filaments_grams', next);
  };

  return (
    <div className="p-5 border-r border-[var(--color-border-soft)] flex flex-col gap-1 overflow-y-auto">
      <FormSection title="Pieza">
        <FormFieldRow label="Nombre" required error={errors.piece_name}>
          <FormInput value={form.piece_name} onChange={(v) => setField('piece_name', v)} placeholder="ej. Minifig dragon v3" />
        </FormFieldRow>
        <FormFieldRow label="Cantidad de unidades">
          <Stepper value={form.quantity} onChange={(v) => setField('quantity', v)} min={1} max={999} suffix="u" />
        </FormFieldRow>
      </FormSection>

      <FormSection title="Tiempo de impresión">
        <div className="grid grid-cols-2 gap-2">
          <FormFieldRow label="Horas" required error={errors.hours}>
            <Stepper value={form.hours} onChange={(v) => setField('hours', v)} min={0} max={48} suffix="h" />
          </FormFieldRow>
          <FormFieldRow label="Minutos">
            <Stepper value={form.minutes} onChange={(v) => setField('minutes', v)} min={0} max={59} step={5} suffix="m" />
          </FormFieldRow>
        </div>
      </FormSection>

      <FormSection title="Impresora">
        <FormFieldRow label="Equipo asignado" required hint="Determina watts y amortización" error={errors.printer_id}>
          <select
            value={form.printer_id || ''}
            onChange={(e) => setField('printer_id', e.target.value ? Number(e.target.value) : '')}
            className={FORM_INPUT_CLS}
          >
            <option value="">Selecciona…</option>
            {printerOpts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} · {p.aside}
              </option>
            ))}
          </select>
        </FormFieldRow>
      </FormSection>

      <FormSection title="Filamento principal">
        <FormFieldRow label="Spool" required error={errors.inventory_item_id}>
          <FilamentSelect
            items={filaments}
            value={form.inventory_item_id}
            onChange={(v) => setField('inventory_item_id', v)}
          />
        </FormFieldRow>
        <FormFieldRow label="Gramos consumidos" required error={errors.weight_grams}>
          <Stepper value={form.weight_grams} onChange={(v) => setField('weight_grams', v)} min={1} max={10000} step={5} suffix="g" />
        </FormFieldRow>
      </FormSection>

      <FormSection title="Filamentos adicionales (multi-material)">
        {(form.additional_filaments_ids || []).length === 0 ? (
          <button
            type="button"
            onClick={addExtra}
            className="px-3 py-2.5 rounded-lg text-[12px] text-steel border border-dashed border-[var(--color-border-strong)] inline-flex items-center justify-center gap-1.5 hover:text-tech-white"
          >
            <Plus size={12} /> Agregar filamento adicional
          </button>
        ) : (
          <>
            {form.additional_filaments_ids.map((fid, idx) => (
              <div key={idx} className="grid gap-1.5 items-start" style={{ gridTemplateColumns: 'minmax(0,1fr) 120px 28px' }}>
                <FilamentSelect
                  items={filaments}
                  value={fid}
                  onChange={(v) => updateExtraId(idx, v)}
                  excludeIds={[form.inventory_item_id, ...form.additional_filaments_ids.filter((_, i) => i !== idx)].filter(Boolean)}
                />
                <Stepper
                  value={(form.additional_filaments_grams || [])[idx] || 0}
                  onChange={(v) => updateExtraGrams(idx, v)}
                  step={5} max={10000} suffix="g"
                />
                <button
                  type="button"
                  onClick={() => removeExtra(idx)}
                  className="w-7 h-9 rounded-md border border-[var(--color-border-strong)] text-gunmetal inline-flex items-center justify-center hover:text-rose-400 hover:border-rose-400/40"
                  aria-label="Quitar filamento"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {form.additional_filaments_ids.length < 4 && (
              <button
                type="button"
                onClick={addExtra}
                className="self-start px-3 py-1.5 rounded-md text-[11.5px] text-steel border border-dashed border-[var(--color-border-strong)] inline-flex items-center gap-1.5 hover:text-tech-white"
              >
                <Plus size={11} /> Agregar otro
              </button>
            )}
          </>
        )}
      </FormSection>

      <FormSection title="Modo de cálculo">
        <FormFieldRow label="Tipo">
          <FormChips value={form.mode} onChange={(v) => setField('mode', v)} options={MODE_OPTIONS} />
        </FormFieldRow>
        <div className="grid grid-cols-2 gap-2">
          <FormFieldRow label="Margen" hint="Default desde Settings">
            <Stepper value={form.margin_percent} onChange={(v) => setField('margin_percent', v)} min={0} max={150} step={1} suffix="%" />
          </FormFieldRow>
          <FormFieldRow label="IVA" hint="Incluir en total">
            <button
              type="button"
              onClick={() => setField('include_iva', !form.include_iva)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surf-card)] text-tech-white text-[12.5px] font-medium"
            >
              <span
                className="w-[18px] h-[18px] rounded inline-flex items-center justify-center"
                style={{
                  background: form.include_iva ? ACCENT : 'transparent',
                  border: `1.5px solid ${form.include_iva ? ACCENT : 'var(--color-border-strong)'}`,
                  color: '#0A1014',
                }}
              >
                {form.include_iva && <Check size={11} />}
              </span>
              Aplicar 19%
            </button>
          </FormFieldRow>
        </div>
      </FormSection>

      <FormSection title="Notas">
        <textarea
          value={form.description || ''}
          onChange={(e) => setField('description', e.target.value)}
          placeholder="Detalles internos sobre esta pieza, modificaciones, postproceso…"
          rows={3}
          className={`${FORM_INPUT_CLS} resize-y min-h-[70px] leading-relaxed`}
        />
      </FormSection>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────

const DEFAULT_FORM = {
  piece_name: '',
  description: '',
  inventory_item_id: '',
  printer_id: '',
  weight_grams: 0,
  hours: 0,
  minutes: 0,
  quantity: 1,
  margin_percent: 35,
  include_iva: false,
  mode: 'standard',
  additional_filaments_ids: [],
  additional_filaments_grams: [],
};

export default function CalculatorPage() {
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();

  // Datos catálogo
  const [filaments, setFilaments] = useState([]);
  const [printers, setPrinters] = useState([]);
  const [tariffPeriod, setTariffPeriod] = useState(null); // 'YYYY-MM' o null
  const [tariffRateCOP, setTariffRateCOP] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);

  // Form
  const [form, setForm] = useState(DEFAULT_FORM);
  const setField = (k, v) => setForm((cur) => ({ ...cur, [k]: v }));

  // Stale tariff (issue #75)
  const isStale = tariffPeriod ? isKwhTariffStale(tariffPeriod) : false;
  const [staleModalOpen, setStaleModalOpen] = useState(false);
  useEffect(() => {
    if (isStale) setStaleModalOpen(true);
  }, [isStale]);

  // Reactive calc (issue #61) — debounce 300ms
  const debouncedForm = useDebouncedValue(form, 300);
  const [result, setResult] = useState(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcError, setCalcError] = useState(null);

  // Breakdown sheet mobile
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  // Saving quote
  const [savingQuote, setSavingQuote] = useState(false);

  // ── Load catálogo ────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      getInventoryFilaments(),
      getInventoryItems(),
      getPrinters(),
      getSettings(),
      getElectricityTariffs().catch(() => ({ data: [] })),
    ])
      .then(([fRes, _allRes, pRes, sRes, tariffsRes]) => {
        const filamentItems = [...fRes.data].sort((a, b) => a.name.localeCompare(b.name, 'es'));
        const sortedPrinters = [...pRes.data].sort((a, b) => a.name.localeCompare(b.name, 'es'));
        setFilaments(filamentItems);
        setPrinters(sortedPrinters);
        // Tariff actual: primer item de listElectricityTariffs (ordenado desc)
        const tariffs = tariffsRes.data || [];
        if (tariffs.length > 0) {
          const latest = tariffs[0];
          const y = latest.year;
          const m = String(latest.month).padStart(2, '0');
          setTariffPeriod(`${y}-${m}`);
          // El estrato 4 es típico residencial; cae a primer estrato disponible
          const estr = latest.estrato_4 || latest.estrato_3 || Object.values(latest)[3];
          if (typeof estr === 'object' && estr?.cop_per_kwh) {
            setTariffRateCOP(Number(estr.cop_per_kwh));
          }
        } else {
          setTariffPeriod(currentTariffPeriod());
        }
        // Defaults: primera impresora, primer filamento, margen settings
        setForm((cur) => ({
          ...cur,
          margin_percent: Number(sRes.data.default_margin_percent || 35),
          printer_id: sortedPrinters[0]?.id || '',
          inventory_item_id: filamentItems[0]?.id || '',
        }));

        // Slicer URL params
        const wg = searchParams.get('weight_grams');
        const ph = searchParams.get('print_time_hours');
        const itemId = searchParams.get('inventory_item_id');
        const updates = {};
        if (wg) updates.weight_grams = Number(parseFloat(wg).toFixed(0));
        if (ph) {
          const totalMin = parseFloat(ph) * 60;
          updates.hours = Math.floor(totalMin / 60);
          updates.minutes = Math.round(totalMin % 60);
        }
        if (itemId && filamentItems.some((f) => f.id === Number(itemId))) {
          updates.inventory_item_id = Number(itemId);
        }
        const extras = [];
        const extraGrams = [];
        for (let i = 1; i <= 4; i++) {
          const eId = searchParams.get(`extra_id_${i}`);
          const eW = searchParams.get(`extra_weight_${i}`);
          if (eId && eW && filamentItems.some((f) => f.id === Number(eId))) {
            extras.push(Number(eId));
            extraGrams.push(Number(parseFloat(eW).toFixed(0)));
          }
        }
        if (extras.length > 0) {
          updates.additional_filaments_ids = extras;
          updates.additional_filaments_grams = extraGrams;
        }
        if (Object.keys(updates).length > 0) {
          setForm((cur) => ({ ...cur, ...updates }));
          if (wg || ph) toast.success('Datos del Slicer cargados');
        }
      })
      .catch(() => toast.error('Error cargando catálogo'))
      .finally(() => setInitialLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Build calc payload + reactive call ──────────────────────────────────
  const buildPayload = (f) => {
    const additional = (f.additional_filaments_ids || [])
      .map((id, i) => ({
        inventory_item_id: id,
        weight_grams: Number((f.additional_filaments_grams || [])[i] || 0),
      }))
      .filter((x) => x.inventory_item_id && x.weight_grams > 0);
    return {
      piece_name: f.piece_name || 'Pieza',
      description: f.description || null,
      client_name: 'Interno',
      inventory_item_id: f.inventory_item_id,
      printer_id: Number(f.printer_id),
      weight_grams: Number(f.weight_grams) || 0,
      print_time_hours: (Number(f.hours) || 0) + (Number(f.minutes) || 0) / 60,
      preparation_time_hours: 0,
      post_processing_time_hours: 0.25,
      quantity: Number(f.quantity) || 1,
      margin_percent: Number(f.margin_percent) || 0,
      color_changes: 0,
      supplies: [],
      additional_filaments: additional,
      consumable_ids: [],
      // Reimpresión: cargamos el +15% como un margen extra ad-hoc
      // (backend no tiene flag específico; emulamos)
      ...(f.mode === 'reprint' ? { extra_failure_percent: 15 } : {}),
    };
  };

  // Validación mínima para disparar calc (todos required presentes)
  const canCalc = (f) =>
    !!f.inventory_item_id &&
    !!f.printer_id &&
    Number(f.weight_grams) > 0 &&
    (Number(f.hours) > 0 || Number(f.minutes) > 0);

  useEffect(() => {
    if (initialLoading) return;
    if (!canCalc(debouncedForm)) {
      setResult(null);
      setCalcError(null);
      return;
    }
    let cancelled = false;
    setCalcLoading(true);
    setCalcError(null);
    calculateQuote(buildPayload(debouncedForm))
      .then((res) => {
        if (cancelled) return;
        let data = res.data;
        // Aplicar 15% reimpresión sobre total si mode=reprint
        if (debouncedForm.mode === 'reprint') {
          const factor = 1.15;
          const fields = ['total_price', 'total_price_cop', 'unit_price', 'unit_price_cop'];
          data = { ...data };
          fields.forEach((k) => {
            if (data[k] != null) data[k] = Number(data[k]) * factor;
          });
        }
        setResult(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setCalcError(err?.response?.data?.detail || 'Error en el cálculo');
        setResult(null);
      })
      .finally(() => !cancelled && setCalcLoading(false));
    return () => {
      cancelled = true;
    };
  }, [debouncedForm, initialLoading]);

  // ── Validation errors (display) ─────────────────────────────────────────
  const errors = useMemo(() => {
    const e = {};
    if (!form.piece_name) e.piece_name = 'Requerido';
    if (!form.inventory_item_id) e.inventory_item_id = 'Selecciona uno';
    if (!form.printer_id) e.printer_id = 'Selecciona';
    if (Number(form.hours) === 0 && Number(form.minutes) === 0) e.hours = '> 0';
    if (Number(form.weight_grams) <= 0) e.weight_grams = '> 0';
    return e;
  }, [form]);

  const onReprint = () => setField('mode', form.mode === 'reprint' ? 'standard' : 'reprint');

  const onGenerateQuote = async () => {
    if (!canCalc(form) || !result) {
      toast.error('Completa los datos antes de guardar');
      return;
    }
    setSavingQuote(true);
    try {
      const payload = buildPayload(form);
      if (result.usd_to_cop_rate != null) payload.usd_to_cop_rate = result.usd_to_cop_rate;
      await createQuote(payload);
      toast.success('Cotización guardada en historial');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al guardar');
    } finally {
      setSavingQuote(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 size={28} className="text-amber-400 animate-spin" />
        <p className="text-steel text-sm">Cargando calculadora…</p>
      </div>
    );
  }

  // ── Mobile shell ────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="flex flex-col min-h-screen bg-forge-black">
        <CalcHeader isStale={isStale} onOpenStaleModal={() => setStaleModalOpen(true)} />
        <main className="flex-1 pb-28 overflow-y-auto">
          <CalcForm form={form} setField={setField} filaments={filaments} printers={printers} errors={errors} />
        </main>
        <div
          className="fixed bottom-0 inset-x-0 z-30 px-4 py-3 border-t flex items-center gap-2"
          style={{ background: 'var(--color-surf-sidebar)', borderColor: 'var(--color-border-soft)' }}
        >
          <div className="flex-1 min-w-0">
            <div className="mono text-[9px] uppercase tracking-wider text-gunmetal">Total</div>
            <div className="mono text-[18px] font-semibold text-tech-white truncate">
              {result ? fmtCOP(Number(result.total_price_cop ?? result.total_price ?? 0)) : '—'}
            </div>
            {form.mode === 'reprint' && (
              <span className="mono text-[9px]" style={{ color: REPRINT_TONE }}>+15% reimpresión</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setBreakdownOpen(true)}
            disabled={!result}
            className="px-3 py-2 rounded-md border border-[var(--color-border-strong)] text-steel text-[11px] disabled:opacity-50"
          >
            Desglose
          </button>
          <button
            type="button"
            onClick={onReprint}
            disabled={!result}
            className="px-3 py-2 rounded-md text-[11px] font-medium disabled:opacity-50"
            style={{
              background: form.mode === 'reprint' ? `color-mix(in oklab, ${REPRINT_TONE} 16%, transparent)` : 'var(--color-surf-card-2)',
              border: `1px solid ${form.mode === 'reprint' ? `color-mix(in oklab, ${REPRINT_TONE} 40%, transparent)` : 'var(--color-border-strong)'}`,
              color: form.mode === 'reprint' ? REPRINT_TONE : 'var(--color-steel)',
            }}
          >
            <RotateCcw size={11} className="inline-block mr-1" />
            +15%
          </button>
          <button
            type="button"
            onClick={onGenerateQuote}
            disabled={!result || savingQuote}
            className="px-3 py-2 rounded-md text-[11.5px] font-semibold disabled:opacity-50"
            style={{ background: ACCENT, color: '#0A1014' }}
          >
            {savingQuote ? '…' : <Save size={12} className="inline-block mr-1" />}
            Guardar
          </button>
        </div>
        <MobileSheet open={breakdownOpen} onClose={() => setBreakdownOpen(false)} title="Desglose">
          <CalcBreakdown result={result} form={form} exchangeRate={result?.usd_to_cop_rate} />
        </MobileSheet>
        <StaleTariffModal
          open={staleModalOpen}
          onClose={() => setStaleModalOpen(false)}
          tariffPeriod={tariffPeriod}
          currentRate={tariffRateCOP}
        />
      </div>
    );
  }

  // ── Desktop shell ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen bg-forge-black">
      <CalcHeader isStale={isStale} onOpenStaleModal={() => setStaleModalOpen(true)} />
      <div
        className="flex-1 min-h-0 grid"
        style={{ gridTemplateColumns: 'minmax(420px, 1.2fr) minmax(320px, 1fr) minmax(320px, 1fr)' }}
      >
        <CalcForm form={form} setField={setField} filaments={filaments} printers={printers} errors={errors} />
        <CalcResult
          result={result}
          form={form}
          calcLoading={calcLoading}
          calcError={calcError}
          onReprint={onReprint}
          onGenerateQuote={onGenerateQuote}
          savingQuote={savingQuote}
        />
        <CalcBreakdown result={result} form={form} exchangeRate={result?.usd_to_cop_rate} />
      </div>
      <StaleTariffModal
        open={staleModalOpen}
        onClose={() => setStaleModalOpen(false)}
        tariffPeriod={tariffPeriod}
        currentRate={tariffRateCOP}
      />
    </div>
  );
}
