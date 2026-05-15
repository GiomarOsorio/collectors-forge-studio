/**
 * @file Página de inventario rediseñada (Claude Design port — Día 2).
 *
 * Reemplaza la antigua `InventoryStockPage` con un layout de pestañas:
 *  Filamentos · Insumos · Herramientas · Consumibles · Compras
 *
 * La pestaña Filamentos tiene el tratamiento completo (KPIs, toolbar con
 * search + chips de material + sort + toggle grid/table, grupos por stock
 * bajo y por material, drawer de detalle). Las otras pestañas muestran un
 * placeholder mientras se portan en días siguientes.
 *
 * Usa primitives de `components/ui/` (Card, Chip, KPI, Sparkline, Swatch,
 * DetailDrawer, Button) y el adapter `utils/inventoryAdapter.js`.
 *
 * @module pages/inventory/InventoryPage
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  Beaker,
  Bell,
  Box,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  Droplet,
  Filter,
  Grid3x3,
  List,
  MapPin,
  Pencil,
  Plus,
  Scissors,
  Search,
  ShoppingCart,
  TrendingUp,
  Upload,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Card, Chip, DetailDrawer, KPI, MobileSheet, Sparkline, Swatch } from '../../components/ui';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { getInventoryItems, getPurchaseOrders } from '../../services/api';
import { MATERIALS, MATERIAL_ORDER } from '../../config/materials';
import {
  computeFilamentStats,
  fillPercent,
  fmtCOP,
  fmtG,
  fmtKg,
  groupFilaments,
  mapToFilament,
  stockLevel,
} from '../../utils/inventoryAdapter';

// Placeholder de consumo diario hasta que tengamos el endpoint real.
// 14 días, gramos por día. Cuando tengamos historial real, viene del backend.
const CONSUMPTION_PLACEHOLDER = [240, 180, 95, 310, 280, 420, 360, 145, 0, 0, 290, 510, 380, 295];

// ─── KPI Strip ───────────────────────────────────────────────────────────────

function KPIStrip({ stats, openPOs, openPOsValue }) {
  return (
    <div className="flex flex-wrap gap-3 px-6 pt-4 pb-2">
      <div className="flex-1 min-w-[180px] flex">
        <KPI
          label="Capital"
          value={`$${(stats.totalValue / 1_000_000).toFixed(2)}M`}
          unit="COP"
          sub="valor en inventario"
          accent="#3B82F6"
          icon={ArrowUpRight}
        />
      </div>
      <div className="flex-1 min-w-[180px] flex">
        <KPI
          label="Material"
          value={(stats.totalGrams / 1000).toFixed(2)}
          unit="kg"
          sub={`${stats.spoolCount} spools`}
          accent="#94A0AE"
          icon={Droplet}
        />
      </div>
      <div className="flex-1 min-w-[180px] flex">
        <KPI
          label="Consumo · 14d"
          value={(CONSUMPTION_PLACEHOLDER.reduce((s, n) => s + n, 0) / 1000).toFixed(2)}
          unit="kg"
          sub="placeholder · pronto desde quotes"
          accent="#2DD4BF"
          sparkline={CONSUMPTION_PLACEHOLDER}
        />
      </div>
      <div className="flex-1 min-w-[180px] flex">
        <KPI
          label="Stock bajo"
          value={stats.lowCount}
          unit="ítems"
          sub={`${stats.criticalCount} críticos`}
          accent="#FBBF24"
          icon={AlertTriangle}
        />
      </div>
      <div className="flex-1 min-w-[180px] flex">
        <KPI
          label="Próx. compras"
          value={openPOs}
          unit="POs"
          sub={openPOsValue > 0 ? `${fmtCOP(openPOsValue)} en ruta` : 'sin pedidos abiertos'}
          accent="#8B5CF6"
          icon={ShoppingCart}
        />
      </div>
    </div>
  );
}

// ─── Category tabs ───────────────────────────────────────────────────────────

const TABS = [
  { id: 'filamentos',   label: 'Filamentos',   icon: Droplet },
  { id: 'insumos',      label: 'Insumos',      icon: Box },
  { id: 'herramientas', label: 'Herramientas', icon: Scissors },
  { id: 'consumibles',  label: 'Consumibles',  icon: Beaker },
  { id: 'compras',      label: 'Compras',      icon: ShoppingCart },
];

function CategoryTabs({ value, onChange, counts }) {
  return (
    <div className="flex items-center gap-0.5 px-6 border-b border-[var(--color-border)] overflow-x-auto">
      {TABS.map((t) => {
        const Icon = t.icon;
        const active = t.id === value;
        const count = counts[t.id] ?? 0;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`inline-flex items-center gap-2 px-3.5 py-3 text-sm font-medium transition-colors whitespace-nowrap -mb-px border-b-2 ${
              active
                ? 'text-tech-white border-[var(--color-app-inventory)]'
                : 'text-steel border-transparent hover:text-tech-white'
            }`}
          >
            <Icon size={13} className={active ? '' : 'text-gunmetal'} style={active ? { color: 'var(--color-app-inventory)' } : undefined} />
            {t.label}
            <span
              className={`mono text-[10px] px-1.5 py-px rounded-full border ${
                active
                  ? 'bg-blue-500/14 border-blue-500/30 text-blue-300'
                  : 'bg-white/5 border-[var(--color-border)] text-gunmetal'
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Toolbar ─────────────────────────────────────────────────────────────────

function Toolbar({ query, onQuery, materialFilters, onToggleMat, view, onView, sort, onSort, onClear }) {
  return (
    <div className="flex flex-wrap gap-3 items-center px-6 py-3 sticky top-0 bg-forge-black/80 backdrop-blur z-10">
      {/* Search */}
      <div className="flex items-center gap-2 bg-[var(--color-surf-card)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-1.5 min-w-[260px] basis-[280px] flex-1 max-w-md">
        <Search size={13} className="text-gunmetal shrink-0" />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Buscar color, batch, ubicación…"
          className="flex-1 bg-transparent border-0 outline-0 text-tech-white text-sm placeholder:text-gunmetal-dim"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQuery('')}
            className="text-gunmetal hover:text-tech-white"
            aria-label="Limpiar búsqueda"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Material chips */}
      <div className="flex gap-1.5 items-center flex-wrap">
        <span className="lbl-eyebrow mr-1">Material</span>
        {MATERIALS.map((m) => (
          <Chip key={m.id} active={materialFilters.includes(m.id)} onClick={() => onToggleMat(m.id)}>
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: m.tone, opacity: materialFilters.includes(m.id) ? 1 : 0.45 }}
            />
            {m.name}
          </Chip>
        ))}
        {(query || materialFilters.length > 0) && (
          <Button variant="ghost" size="sm" onClick={onClear} icon={X} iconSize={11}>
            Limpiar
          </Button>
        )}
      </div>

      <span className="flex-1" />

      {/* Sort */}
      <div className="relative">
        <select
          value={sort}
          onChange={(e) => onSort(e.target.value)}
          className="input mono text-xs pr-8 cursor-pointer w-auto min-w-[180px] appearance-none"
        >
          <option value="lowFirst">Stock bajo primero</option>
          <option value="material">Por material</option>
          <option value="valueDesc">Valor (mayor)</option>
          <option value="weightDesc">Peso restante</option>
        </select>
        <ChevronDown size={12} className="absolute right-2.5 top-2.5 text-gunmetal pointer-events-none" />
      </div>

      {/* View toggle */}
      <div className="inline-flex border border-[var(--color-border-strong)] rounded-md overflow-hidden bg-[var(--color-surf-card)]">
        {[
          { id: 'grid', icon: Grid3x3, label: 'Vista grid' },
          { id: 'table', icon: List, label: 'Vista tabla' },
        ].map((v) => {
          const Icon = v.icon;
          const active = view === v.id;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => onView(v.id)}
              className={`px-2.5 py-1.5 transition-colors ${
                active ? 'bg-[var(--color-surf-hover)] text-tech-white' : 'text-gunmetal hover:text-tech-white'
              }`}
              aria-label={v.label}
              aria-pressed={active}
            >
              <Icon size={13} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Fuel gauge ──────────────────────────────────────────────────────────────

function FuelGauge({ value, level }) {
  const color = level === 'ok' ? '#3B82F6' : '#FBBF24';
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-baseline">
        <span className="mono text-[10px] text-gunmetal tracking-wider">RESTANTE</span>
        <span className="mono text-[11px] text-tech-white">
          {Math.round(value)}
          <span className="text-gunmetal">%</span>
        </span>
      </div>
      <div className="relative h-1 bg-white/5 rounded overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded transition-all duration-200"
          style={{
            width: `${value}%`,
            background: color,
            boxShadow: level !== 'ok' ? `0 0 6px ${color}55` : 'none',
          }}
        />
        {[25, 50, 75].map((t) => (
          <span
            key={t}
            className="absolute -top-px -bottom-px w-px bg-forge-black/90"
            style={{ left: `${t}%` }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Reasignar destino (heurística simple para badges del drawer) ───────────

/** Heurística de "último uso" relativo a un timestamp ISO. */
function lastUsedFromDate(iso) {
  if (!iso) return 'sin uso';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 'sin uso';
  const days = Math.floor((Date.now() - t) / 86_400_000);
  if (days <= 0) return 'hoy';
  if (days === 1) return 'ayer';
  if (days < 30) return `${days} días`;
  if (days < 365) return `${Math.floor(days / 30)} meses`;
  return `${Math.floor(days / 365)}+ años`;
}

// ─── Filament card (grid) ────────────────────────────────────────────────────

function FilamentCard({ f, onClick }) {
  const level = stockLevel(f);
  const p = fillPercent(f);
  return (
    <Card
      as="button"
      interactive
      onClick={() => onClick(f)}
      className="relative flex flex-col gap-3 p-3.5 text-left w-full"
    >
      {/* Top: swatch + meta */}
      <div className="flex gap-3 items-start">
        <Swatch color={f.color} size={48} level={level} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="mono text-[9.5px] px-1.5 py-px rounded-sm bg-white/5 border border-[var(--color-border)] text-steel tracking-wider">
              {f.material}
            </span>
            {level !== 'ok' && (
              <span className="mono inline-flex items-center gap-0.5 text-[9.5px] px-1.5 py-px rounded-sm bg-amber-400/10 border border-amber-400/30 text-amber-400 tracking-wider">
                <AlertTriangle size={9} />
                {level === 'critical' ? 'CRÍTICO' : 'BAJO'}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-tech-white leading-snug truncate" title={f.colorName}>
            {f.colorName}
          </p>
          <p className="mono text-[10.5px] text-gunmetal mt-0.5 truncate">
            {f.vendor}
            {f.batch ? ` · ${f.batch}` : ''}
          </p>
        </div>
      </div>

      <FuelGauge value={p} level={level} />

      <div className="flex justify-between items-end gap-2.5 border-t border-dashed border-[var(--color-border-soft)] pt-2.5">
        <div className="flex flex-col min-w-0">
          <span className="lbl-eyebrow text-[9px]">Peso</span>
          <span className="mono text-xs text-tech-white whitespace-nowrap">
            {fmtG(f.remaining)}
            <span className="text-gunmetal">/{fmtKg(f.total)}</span>
          </span>
        </div>
        <div className="flex flex-col items-end min-w-0">
          <span className="lbl-eyebrow text-[9px]">Costo/kg</span>
          <span className="mono text-xs text-tech-white whitespace-nowrap">{fmtCOP(f.costPerKg)}</span>
        </div>
      </div>

      {f.location && (
        <div className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 text-[10px] text-gunmetal">
          <MapPin size={10} />
          <span className="mono">{f.location.split(' · ').slice(-1)[0]}</span>
        </div>
      )}
    </Card>
  );
}

// ─── Grid grouped by stock level + material ─────────────────────────────────

function FilamentGrid({ groups, onCardClick }) {
  return (
    <div className="flex flex-col gap-6 px-6 pt-2 pb-8">
      {groups.map((g) => (
        <section key={g.key}>
          <div
            className={`flex items-baseline gap-2.5 mb-2.5 pb-1.5 border-b ${
              g.warn ? 'border-amber-400/25' : 'border-[var(--color-border-soft)]'
            }`}
          >
            <h3
              className={`text-[11px] font-semibold uppercase tracking-wider inline-flex items-center gap-1.5 ${
                g.warn ? 'text-amber-400' : 'text-steel'
              }`}
            >
              {g.warn && <AlertTriangle size={11} />}
              {g.label}
            </h3>
            <span className="mono text-[10.5px] text-gunmetal">
              {g.items.length} {g.items.length === 1 ? 'spool' : 'spools'}
            </span>
          </div>
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}
          >
            {g.items.map((f) => (
              <FilamentCard key={f.id} f={f} onClick={onCardClick} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ─── Table view ──────────────────────────────────────────────────────────────

function FilamentTable({ items, onRowClick }) {
  return (
    <div className="px-6 pb-8">
      <div className="border border-[var(--color-border)] rounded-xl overflow-hidden bg-[var(--color-surf-card)]">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['', 'Color · Batch', 'Material', 'Vendor', 'Restante', 'Costo/kg', 'Ubicación'].map((h, idx) => (
                <th
                  key={idx}
                  className="text-left text-[10.5px] font-semibold uppercase tracking-wider text-gunmetal px-3 py-2.5 border-b border-[var(--color-border)] bg-forge-black sticky top-0 z-[1]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((f) => {
              const level = stockLevel(f);
              const p = fillPercent(f);
              return (
                <tr
                  key={f.id}
                  onClick={() => onRowClick(f)}
                  className="cursor-pointer hover:bg-[var(--color-surf-hover)]/60 transition-colors border-b border-[var(--color-border-soft)] last:border-b-0"
                >
                  <td className="px-3 py-3 w-[44px]">
                    <Swatch color={f.color} size={26} level={level} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-sm font-medium text-tech-white truncate">{f.colorName}</div>
                    <div className="mono text-[11px] text-gunmetal">{f.batch || '—'}</div>
                  </td>
                  <td className="px-3 py-3 w-[80px]">
                    <span className="mono text-[10.5px] px-1.5 py-0.5 rounded-sm bg-white/5 border border-[var(--color-border)] text-steel tracking-wider">
                      {f.material}
                    </span>
                  </td>
                  <td className="px-3 py-3 w-[110px] mono text-xs text-steel">{f.vendor}</td>
                  <td className="px-3 py-3 w-[180px]">
                    <div className="flex flex-col gap-1">
                      <span className="mono text-xs text-tech-white">
                        {fmtG(f.remaining)} <span className="text-gunmetal">/ {fmtKg(f.total)}</span>
                      </span>
                      <div className="h-0.5 bg-white/5 rounded">
                        <div
                          className="h-full rounded"
                          style={{
                            width: `${p}%`,
                            background: level === 'ok' ? '#3B82F6' : '#FBBF24',
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 w-[110px] mono text-xs text-tech-white">{fmtCOP(f.costPerKg)}</td>
                  <td className="px-3 py-3 mono text-[11px] text-steel">{f.location || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Drawer body ─────────────────────────────────────────────────────────────

function FilamentDrawerBody({ f, onClose }) {
  if (!f) return null;
  const level = stockLevel(f);
  const p = fillPercent(f);
  const remainValueCop = (f.remaining / 1000) * f.costPerKg;
  const lastUsedLabel = lastUsedFromDate(f.updatedAt);
  const locationShort = f.location
    ? (f.location.split(' · ').slice(-1)[0] || f.location)
    : '—';
  const gaugeColor = level === 'ok'
    ? 'linear-gradient(90deg, #3B82F6, #60A5FA)'
    : 'linear-gradient(90deg, #FBBF24, #F59E0B)';

  return (
    <div className="p-5 flex flex-col gap-4">
      {/* Hero */}
      <div className="flex items-center gap-3.5">
        <Swatch color={f.color} size={64} level={level} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="mono text-[10px] px-1.5 py-0.5 rounded-sm bg-white/5 border border-[var(--color-border)] text-steel tracking-wider">
              {f.material}
            </span>
            {level !== 'ok' && (
              <span className="mono inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-sm bg-amber-400/10 border border-amber-400/30 text-amber-400 tracking-wider">
                <AlertTriangle size={10} />
                {level === 'critical' ? 'CRÍTICO' : 'BAJO'}
              </span>
            )}
          </div>
          <h2 className="text-xl font-semibold text-tech-white tracking-tight leading-tight truncate">
            {f.colorName}
          </h2>
          <p className="mono text-[10.5px] text-gunmetal mt-1 truncate">
            {f.rawId}
            {f.batch ? ` · ${f.batch}` : ''}
            {f.vendor && f.vendor !== '—' ? ` · ${f.vendor}` : ''}
          </p>
        </div>
      </div>

      {/* Gauge card */}
      <div className="rounded-xl bg-[var(--color-surf-card-2)] border border-[var(--color-border)] p-3.5">
        <div className="flex justify-between items-baseline mb-2">
          <span className="lbl-eyebrow">Restante</span>
          <span className="mono text-base font-semibold text-tech-white">
            {Math.round(p)}
            <span className="text-gunmetal text-xs">%</span>
          </span>
        </div>
        <div className="relative h-1.5 bg-white/5 rounded overflow-hidden mb-2">
          <div
            className="absolute inset-y-0 left-0 rounded"
            style={{ width: `${p}%`, background: gaugeColor }}
          />
          {[25, 50, 75].map((t) => (
            <span
              key={t}
              className="absolute -top-px -bottom-px w-px bg-[var(--color-surf-card-2)]"
              style={{ left: `${t}%` }}
            />
          ))}
        </div>
        <div className="flex justify-between">
          <span className="mono text-[11px] text-steel">{fmtG(f.remaining)} restantes</span>
          <span className="mono text-[11px] text-gunmetal">de {fmtKg(f.total)}</span>
        </div>
      </div>

      {/* Stats grid 2×2 */}
      <div className="grid grid-cols-2 gap-1.5">
        <SheetStat label="Valor restante" value={fmtCOP(remainValueCop)} />
        <SheetStat label="Costo / kg" value={fmtCOP(f.costPerKg)} />
        <SheetStat label="Ubicación" value={locationShort} icon={MapPin} />
        <SheetStat label="Último uso" value={lastUsedLabel} icon={Clock} />
      </div>

      {/* Min stock + notes */}
      {(f.minQuantity > 0 || f.notes) && (
        <div className="grid grid-cols-1 gap-1.5">
          {f.minQuantity > 0 && (
            <SheetStat
              label="Stock mínimo"
              value={`${fmtG(f.minQuantity)} ${f.unit || 'g'}`}
            />
          )}
          {f.notes && (
            <Card className="p-3">
              <span className="lbl-eyebrow text-[9px]">Notas</span>
              <p className="text-sm text-steel whitespace-pre-wrap mt-1">{f.notes}</p>
            </Card>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Link to="/inventory/purchases?new=1" className="btn btn-primary btn-sm flex-1 justify-center">
          <ShoppingCart size={13} /> A compras
        </Link>
        <Link to={`/inventory/stock?edit=${f.id}`} className="btn btn-sm flex-1 justify-center">
          <Pencil size={13} /> Editar
        </Link>
      </div>

      <p className="text-[10.5px] text-gunmetal text-center">
        Editar abre la vista clásica (formulario completo con todos los campos).
      </p>
    </div>
  );
}

/**
 * Tile compacto con label + valor + ícono opcional, usado en grids 2×2 de drawers.
 */
function SheetStat({ label, value, icon: Icon }) {
  return (
    <div className="rounded-md bg-[var(--color-surf-card-2)] border border-[var(--color-border)] px-2.5 py-2">
      <div className="lbl-eyebrow text-[9px] flex items-center gap-1 mb-0.5">
        {Icon && <Icon size={9} />}
        {label}
      </div>
      <p className="mono text-sm font-medium text-tech-white truncate">{value}</p>
    </div>
  );
}

// ─── Item card / row / drawer (insumos · herramientas · consumibles) ───────

/**
 * Devuelve `{ icon, color, label }` por categoría para reutilizar en cards/rows.
 */
function categoryMeta(category) {
  const map = {
    Insumo:      { icon: Box,      color: '#3B82F6', label: 'Insumo' },
    Herramienta: { icon: Scissors, color: '#94A0AE', label: 'Herramienta' },
    Consumible:  { icon: Beaker,   color: '#FBBF24', label: 'Consumible' },
  };
  return map[category] || { icon: Box, color: '#94A0AE', label: category || '—' };
}

/**
 * Calcula nivel de stock para items genéricos: critical si ≤25% del mínimo,
 * low si ≤100%, ok si >100%. Si `min_quantity` es 0 → ok siempre.
 */
function itemLevel(item) {
  const min = Number(item?.min_quantity || 0);
  const qty = Number(item?.quantity || 0);
  if (min <= 0) return 'ok';
  const ratio = qty / min;
  if (ratio <= 0.25) return 'critical';
  if (ratio <= 1) return 'low';
  return 'ok';
}

function InventoryItemCard({ item, onClick }) {
  const meta = categoryMeta(item.category);
  const Icon = meta.icon;
  const level = itemLevel(item);
  const min = Number(item.min_quantity || 0);
  const qty = Number(item.quantity || 0);
  const fillPct = min > 0 ? Math.min(100, (qty / min) * 100) : 100;
  return (
    <Card as="button" interactive onClick={() => onClick(item)} className="text-left w-full p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span
          className="inline-flex items-center justify-center w-10 h-10 rounded-lg shrink-0"
          style={{ background: `${meta.color}1A`, color: meta.color, border: `1px solid ${meta.color}40` }}
        >
          <Icon size={16} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span
              className="mono inline-flex items-center text-[9.5px] px-1.5 py-px rounded-sm tracking-wider"
              style={{ background: `${meta.color}1A`, border: `1px solid ${meta.color}40`, color: meta.color }}
            >
              {meta.label.toUpperCase()}
            </span>
            {level !== 'ok' && (
              <span className="mono inline-flex items-center gap-1 text-[9.5px] px-1.5 py-px rounded-sm bg-amber-400/10 border border-amber-400/30 text-amber-400 tracking-wider">
                <AlertTriangle size={9} />
                {level === 'critical' ? 'CRÍTICO' : 'BAJO'}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-tech-white truncate">{item.name}</p>
          {item.supplier_name && (
            <p className="mono text-[10.5px] text-gunmetal mt-0.5 truncate">{item.supplier_name}</p>
          )}
        </div>
      </div>

      {min > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-baseline">
            <span className="mono text-[10px] text-gunmetal tracking-wider">STOCK</span>
            <span className="mono text-[11px] text-tech-white">
              {qty}
              <span className="text-gunmetal">/{min} {item.unit}</span>
            </span>
          </div>
          <div className="relative h-1 bg-white/5 rounded overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded transition-all"
              style={{ width: `${fillPct}%`, background: level === 'ok' ? meta.color : '#FBBF24' }}
            />
          </div>
        </div>
      )}

      <div className="flex justify-between items-end gap-2.5 border-t border-dashed border-[var(--color-border-soft)] pt-2.5">
        <div className="flex flex-col min-w-0">
          <span className="lbl-eyebrow text-[9px]">Cantidad</span>
          <span className="mono text-xs text-tech-white whitespace-nowrap">
            {qty} {item.unit}
          </span>
        </div>
        <div className="flex flex-col items-end min-w-0">
          <span className="lbl-eyebrow text-[9px]">Costo</span>
          <span className="mono text-xs text-tech-white whitespace-nowrap">
            {fmtCOP(item.unit_cost)} <span className="text-gunmetal">/{item.unit}</span>
          </span>
        </div>
      </div>

      {item.category === 'Consumible' && item.useful_life_hours && (
        <div className="text-[11px] text-gunmetal border-t border-[var(--color-border-soft)] pt-2 inline-flex items-center gap-1.5">
          <Beaker size={11} />
          Dura {Number(item.useful_life_hours).toFixed(0)}h de impresión
        </div>
      )}
    </Card>
  );
}

function InventoryItemRow({ item, onClick }) {
  const meta = categoryMeta(item.category);
  const Icon = meta.icon;
  const level = itemLevel(item);
  return (
    <button
      type="button"
      onClick={() => onClick(item)}
      className="w-full text-left flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border-soft)] hover:bg-[var(--color-surf-hover)]/50 transition-colors"
    >
      <span
        className="inline-flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
        style={{ background: `${meta.color}1A`, color: meta.color, border: `1px solid ${meta.color}40` }}
      >
        <Icon size={15} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-tech-white truncate">{item.name}</p>
        <p className="mono text-[10px] text-gunmetal mt-0.5 truncate">
          {item.quantity} {item.unit}
          {Number(item.min_quantity) > 0 ? ` / min ${item.min_quantity}` : ''}
          {item.supplier_name ? ` · ${item.supplier_name}` : ''}
        </p>
      </div>
      <div className="flex flex-col items-end shrink-0">
        <span className="mono text-xs text-tech-white">{fmtCOP(item.unit_cost)}</span>
        {level !== 'ok' && (
          <span className="mono text-[9.5px] text-amber-400">{level === 'critical' ? 'CRÍT' : 'BAJO'}</span>
        )}
      </div>
      <ChevronRight size={14} className="text-gunmetal-dim shrink-0" />
    </button>
  );
}

function InventoryItemDrawerBody({ item }) {
  if (!item) return null;
  const meta = categoryMeta(item.category);
  const Icon = meta.icon;
  const level = itemLevel(item);
  return (
    <div className="p-5 flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <span
          className="inline-flex items-center justify-center w-14 h-14 rounded-xl shrink-0"
          style={{ background: `${meta.color}1A`, color: meta.color, border: `1px solid ${meta.color}40` }}
        >
          <Icon size={22} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span
              className="mono inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-sm tracking-wider"
              style={{ background: `${meta.color}1A`, border: `1px solid ${meta.color}40`, color: meta.color }}
            >
              {meta.label.toUpperCase()}
            </span>
            {level !== 'ok' && (
              <span className="mono inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-sm bg-amber-400/10 border border-amber-400/30 text-amber-400 tracking-wider">
                <AlertTriangle size={10} />
                {level === 'critical' ? 'CRÍTICO' : 'BAJO'}
              </span>
            )}
          </div>
          <h2 className="text-xl font-semibold text-tech-white tracking-tight truncate">{item.name}</h2>
          {item.supplier_name && (
            <p className="mono text-[11.5px] text-gunmetal mt-0.5 truncate">{item.supplier_name}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Stock actual</span>
          <p className="mono text-base font-semibold text-tech-white mt-0.5">
            {item.quantity} <span className="text-gunmetal text-sm">{item.unit}</span>
          </p>
        </Card>
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Mínimo</span>
          <p className="mono text-base font-semibold text-tech-white mt-0.5">
            {Number(item.min_quantity || 0) > 0 ? `${item.min_quantity} ${item.unit}` : '—'}
          </p>
        </Card>
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Costo unit.</span>
          <p className="mono text-base font-semibold text-forge-teal mt-0.5">{fmtCOP(item.unit_cost)}</p>
        </Card>
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Valor total</span>
          <p className="mono text-base font-semibold text-tech-white mt-0.5">
            {fmtCOP(Number(item.unit_cost || 0) * Number(item.quantity || 0))}
          </p>
        </Card>
        {item.category === 'Consumible' && item.useful_life_hours != null && (
          <Card className="p-3 col-span-2">
            <span className="lbl-eyebrow text-[9px]">Vida útil estimada</span>
            <p className="mono text-sm text-tech-white mt-0.5">
              {Number(item.useful_life_hours).toFixed(0)}h de impresión por unidad
            </p>
          </Card>
        )}
      </div>

      {item.description && (
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Descripción</span>
          <p className="text-sm text-steel whitespace-pre-wrap mt-1">{item.description}</p>
        </Card>
      )}
      {item.supplier_contact && (
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Contacto proveedor</span>
          <p className="text-sm text-steel whitespace-pre-wrap mt-1 break-all">{item.supplier_contact}</p>
        </Card>
      )}
      {item.notes && (
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Notas</span>
          <p className="text-sm text-steel whitespace-pre-wrap mt-1">{item.notes}</p>
        </Card>
      )}

      <div className="flex gap-2 pt-2 border-t border-[var(--color-border-soft)]">
        <Link to="/inventory/stock" className="btn btn-primary btn-sm flex-1">
          Editar en vista clásica
        </Link>
      </div>
    </div>
  );
}

// ─── Purchase card / row / drawer (compras) ─────────────────────────────────

function purchaseStatusBadge(status) {
  const s = (status || '').toLowerCase();
  if (s.includes('complet')) return { label: 'Completado', color: '#34D399' };
  if (s.includes('camino') || s.includes('ship') || s.includes('transit'))
    return { label: 'En camino', color: '#FBBF24' };
  if (s.includes('proces') || s.includes('pending') || s.includes('pend'))
    return { label: 'Procesando', color: '#3B82F6' };
  if (s.includes('cancel')) return { label: 'Cancelado', color: '#F87171' };
  return { label: status || 'Sin estado', color: '#94A0AE' };
}

function PurchaseCard({ po, onClick }) {
  const badge = purchaseStatusBadge(po.status);
  const itemsCount = Array.isArray(po.items) ? po.items.length : po.items_count ?? po.items ?? 0;
  return (
    <Card as="button" interactive onClick={() => onClick(po)} className="text-left w-full p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span
          className="inline-flex items-center justify-center w-10 h-10 rounded-lg shrink-0"
          style={{ background: 'rgba(139, 92, 246, 0.12)', color: '#8B5CF6', border: '1px solid rgba(139, 92, 246, 0.25)' }}
        >
          <ShoppingCart size={16} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="mono text-[10.5px] text-gunmetal tracking-wider">
              PO-{String(po.id).padStart(4, '0')}
            </span>
            <span
              className="mono inline-flex items-center text-[9.5px] px-1.5 py-px rounded-sm tracking-wider"
              style={{ background: `${badge.color}1A`, border: `1px solid ${badge.color}40`, color: badge.color }}
            >
              {badge.label.toUpperCase()}
            </span>
          </div>
          <p className="text-sm font-semibold text-tech-white truncate">
            {po.supplier_name || po.vendor || 'Proveedor sin nombre'}
          </p>
          <p className="mono text-[10.5px] text-gunmetal mt-0.5 truncate">
            {itemsCount} ítem{itemsCount === 1 ? '' : 's'}
            {po.order_date ? ` · ${String(po.order_date).split('T')[0]}` : ''}
            {po.expected_arrival ? ` · llega ${String(po.expected_arrival).split('T')[0]}` : po.eta ? ` · ${po.eta}` : ''}
          </p>
        </div>
        <span className="mono text-base font-semibold text-forge-teal whitespace-nowrap shrink-0">
          {fmtCOP(po.total || po.total_amount)}
        </span>
      </div>
      {po.tracking_number && (
        <p className="text-[11px] text-gunmetal border-t border-dashed border-[var(--color-border-soft)] pt-2.5 truncate">
          Tracking: <span className="mono text-steel">{po.tracking_number}</span>
        </p>
      )}
    </Card>
  );
}

function PurchaseRow({ po, onClick }) {
  const badge = purchaseStatusBadge(po.status);
  return (
    <button
      type="button"
      onClick={() => onClick(po)}
      className="w-full text-left flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border-soft)] hover:bg-[var(--color-surf-hover)]/50 transition-colors"
    >
      <span
        className="inline-flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
        style={{ background: 'rgba(139, 92, 246, 0.12)', color: '#8B5CF6', border: '1px solid rgba(139, 92, 246, 0.25)' }}
      >
        <ShoppingCart size={15} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span
            className="mono inline-flex items-center text-[9.5px] px-1 py-px rounded-sm"
            style={{ background: `${badge.color}1A`, border: `1px solid ${badge.color}40`, color: badge.color }}
          >
            {badge.label.toUpperCase()}
          </span>
        </div>
        <p className="text-sm font-semibold text-tech-white truncate">{po.supplier_name || po.vendor || 'Proveedor'}</p>
        <p className="mono text-[10px] text-gunmetal mt-0.5">PO-{String(po.id).padStart(4, '0')}</p>
      </div>
      <span className="mono text-sm text-tech-white whitespace-nowrap shrink-0">{fmtCOP(po.total || po.total_amount)}</span>
      <ChevronRight size={14} className="text-gunmetal-dim shrink-0" />
    </button>
  );
}

function PurchaseDrawerBody({ po }) {
  if (!po) return null;
  const badge = purchaseStatusBadge(po.status);
  const items = Array.isArray(po.items) ? po.items : [];
  return (
    <div className="p-5 flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <span
            className="mono inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-sm tracking-wider"
            style={{ background: `${badge.color}1A`, border: `1px solid ${badge.color}40`, color: badge.color }}
          >
            {badge.label.toUpperCase()}
          </span>
          <span className="mono text-[10px] text-gunmetal">PO-{String(po.id).padStart(4, '0')}</span>
        </div>
        <h2 className="text-lg font-semibold text-tech-white truncate">
          {po.supplier_name || po.vendor || 'Proveedor sin nombre'}
        </h2>
        {(po.order_date || po.expected_arrival) && (
          <p className="mono text-[11.5px] text-gunmetal mt-0.5">
            {po.order_date ? `Pedido ${String(po.order_date).split('T')[0]}` : ''}
            {po.expected_arrival ? ` · llega ${String(po.expected_arrival).split('T')[0]}` : ''}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Total</span>
          <p className="mono text-base font-semibold text-forge-teal mt-0.5">{fmtCOP(po.total || po.total_amount)}</p>
        </Card>
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Ítems</span>
          <p className="mono text-base font-semibold text-tech-white mt-0.5">{items.length || po.items_count || '—'}</p>
        </Card>
        {po.tracking_number && (
          <Card className="p-3 col-span-2">
            <span className="lbl-eyebrow text-[9px]">Tracking</span>
            <p className="mono text-sm text-tech-white mt-0.5 break-all">{po.tracking_number}</p>
            {po.tracking_carrier && (
              <p className="mono text-[11px] text-gunmetal">{po.tracking_carrier}</p>
            )}
          </Card>
        )}
      </div>

      {items.length > 0 && (
        <div>
          <span className="lbl-eyebrow text-[9px]">Ítems ({items.length})</span>
          <ul className="mt-2 flex flex-col gap-1.5">
            {items.map((it, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-[var(--color-surf-card)] border border-[var(--color-border-soft)]"
              >
                <div className="min-w-0">
                  <p className="text-sm text-tech-white truncate">{it.name || it.item_name || `Ítem #${i + 1}`}</p>
                  <p className="mono text-[11px] text-gunmetal">
                    {it.quantity || 1} × {fmtCOP(it.unit_cost || it.unit_price)}
                  </p>
                </div>
                <span className="mono text-xs text-tech-white whitespace-nowrap">
                  {fmtCOP(Number(it.unit_cost || it.unit_price || 0) * Number(it.quantity || 1))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {po.notes && (
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Notas</span>
          <p className="text-sm text-steel whitespace-pre-wrap mt-1">{po.notes}</p>
        </Card>
      )}

      <Link to="/inventory/purchases" className="btn btn-primary btn-sm self-start">
        Editar en vista clásica
      </Link>
    </div>
  );
}

// ─── Mobile shell ────────────────────────────────────────────────────────────
// Nota: el header (logo + hamburger) lo provee AppLayout vía Studio Sidebar.
// Esta vista sólo renderiza el contenido específico del inventario.

/**
 * Header in-page del mobile: ícono badge de la app + nombre del tab + count.
 * Replica el patrón del design (no reemplaza al hamburger de AppLayout, lo complementa).
 */
function MobileInPageHeader({ tab, count }) {
  return (
    <div className="px-4 pt-3 pb-2 flex items-center gap-2.5">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className="inline-flex items-center justify-center w-5 h-5 rounded shrink-0"
            style={{
              background: 'rgba(59, 130, 246, 0.14)',
              color: '#3B82F6',
            }}
          >
            <Box size={11} />
          </span>
          <span className="text-[11px] text-gunmetal tracking-wide">Inventario</span>
        </div>
        <h1 className="text-lg font-semibold text-tech-white tracking-tight leading-tight capitalize mt-0.5">
          {tab}
        </h1>
      </div>
      <span className="mono text-[10px] px-1.5 py-0.5 rounded-sm bg-white/5 border border-[var(--color-border)] text-steel tracking-wider shrink-0">
        {count}
      </span>
    </div>
  );
}

/**
 * Hero status: Capital invertido (mono grande) + trend + sparkline de consumo.
 * Réplica del design `inventory-mobile.jsx::HeroStatus` con gradient blue→teal
 * y corner glow azul. Visible sólo en tab Filamentos.
 */
function MobileHeroStatus({ stats, consumption14d }) {
  const trend = 4; // placeholder hasta que tengamos endpoint de comparativa mes anterior
  return (
    <div className="mx-4 mt-1 mb-3">
      <div
        className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] p-4"
        style={{
          background:
            'linear-gradient(135deg, rgba(59, 130, 246, 0.10) 0%, rgba(45, 212, 191, 0.04) 100%), var(--color-surf-card)',
        }}
      >
        {/* Corner glow */}
        <div
          className="absolute -top-10 -right-10 w-36 h-36 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.18), transparent 70%)',
          }}
        />
        <div className="relative flex justify-between items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="lbl-eyebrow">Capital invertido</p>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <span className="mono text-[28px] font-semibold text-tech-white tracking-tight leading-none">
                ${(stats.totalValue / 1_000_000).toFixed(2)}M
              </span>
              <span className="mono text-xs text-gunmetal">COP</span>
            </div>
            <div className="inline-flex items-center gap-1 mt-2 text-[11px]">
              <TrendingUp size={11} className="text-emerald-400" />
              <span className="mono text-emerald-400">+{trend}%</span>
              <span className="text-gunmetal">vs mes ant.</span>
            </div>
          </div>
          <div className="flex flex-col items-end shrink-0">
            <Sparkline data={consumption14d} color="#3B82F6" width={110} height={36} />
            <span className="mono text-[9.5px] text-gunmetal tracking-wider mt-1">
              CONSUMO · 14d
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Mini KPI strip mobile: 3 tiles (Material / Stock bajo / Compras) en línea.
 * Replica el design `inventory-mobile.jsx::MiniKPIStrip`.
 */
function MobileMiniKPIs({ stats, openPOs, openPOsValue }) {
  const tiles = [
    {
      label: 'Material',
      value: (stats.totalGrams / 1000).toFixed(2),
      unit: 'kg',
      sub: `${stats.spoolCount} spools`,
      color: 'text-tech-white',
    },
    {
      label: 'Stock bajo',
      value: stats.lowCount,
      unit: 'ítems',
      sub: `${stats.criticalCount} críticos`,
      color: stats.criticalCount > 0 ? 'text-amber-400' : 'text-tech-white',
    },
    {
      label: 'Compras',
      value: openPOs,
      unit: 'POs',
      sub: openPOsValue > 0 ? `${fmtCOP(openPOsValue)} ruta` : 'sin pendientes',
      color: 'text-tech-white',
    },
  ];
  return (
    <div className="px-4 mb-3 flex gap-2">
      {tiles.map((t) => (
        <div
          key={t.label}
          className="flex-1 min-w-0 rounded-xl bg-[var(--color-surf-card)] border border-[var(--color-border)] px-2.5 py-2.5 flex flex-col gap-1"
        >
          <span className="lbl-eyebrow text-[8.5px] truncate">{t.label}</span>
          <div className="flex items-baseline gap-1 whitespace-nowrap">
            <span className={`mono text-[17px] font-semibold ${t.color}`}>{t.value}</span>
            <span className="mono text-[9.5px] text-gunmetal">{t.unit}</span>
          </div>
          <span className="mono text-[9px] text-gunmetal-dim truncate">{t.sub}</span>
        </div>
      ))}
    </div>
  );
}

function MobileTabs({ value, onChange, counts }) {
  return (
    <div className="mt-3 px-4 flex gap-1.5 overflow-x-auto pb-1 -mb-1 snap-x">
      {TABS.map((t) => {
        const Icon = t.icon;
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 snap-start transition-colors border ${
              active
                ? 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                : 'bg-transparent border-[var(--color-border)] text-steel'
            }`}
          >
            <Icon size={12} />
            {t.label}
            <span className="mono text-[10px] text-gunmetal">{counts[t.id] ?? 0}</span>
          </button>
        );
      })}
    </div>
  );
}

function MobileSearchBar({ query, onQuery }) {
  return (
    <div className="px-4 mt-3">
      <div className="flex items-center gap-2 bg-[var(--color-surf-card)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-2">
        <Search size={14} className="text-gunmetal" />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Color, batch, ubicación…"
          className="flex-1 bg-transparent border-0 outline-0 text-tech-white text-sm placeholder:text-gunmetal-dim"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQuery('')}
            className="text-gunmetal hover:text-tech-white"
            aria-label="Limpiar"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

function MobileChips({ materialFilters, onToggleMat }) {
  return (
    <div className="px-4 mb-2 flex gap-1.5 overflow-x-auto pb-1 -mb-1 snap-x">
      {/* Label "Material" tipo chip (no clickable) — replica del design */}
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[var(--color-border)] text-gunmetal shrink-0 whitespace-nowrap text-[11px] font-medium">
        <Filter size={11} />
        Material
      </div>
      {MATERIALS.map((m) => {
        const active = materialFilters.includes(m.id);
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onToggleMat(m.id)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap shrink-0 snap-start transition-colors border ${
              active
                ? 'bg-blue-500/12 border-blue-500/45 text-blue-300'
                : 'bg-[var(--color-surf-card)] border-[var(--color-border)] text-steel'
            }`}
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: m.tone, opacity: active ? 1 : 0.45 }}
            />
            {m.name}
          </button>
        );
      })}
    </div>
  );
}

function FilamentRow({ f, onClick }) {
  const level = stockLevel(f);
  const p = fillPercent(f);
  return (
    <button
      type="button"
      onClick={() => onClick(f)}
      className="w-full text-left flex items-center gap-3 mx-4 mb-2 px-3 py-3 rounded-xl bg-[var(--color-surf-card)] border border-[var(--color-border)] active:scale-[0.98] active:bg-[var(--color-surf-hover)] hover:bg-[var(--color-surf-hover)]/60 transition-all"
    >
      <Swatch color={f.color} size={40} level={level} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="mono text-[9px] px-1.5 py-px rounded-sm bg-white/5 border border-[var(--color-border)] text-steel tracking-wider">
            {f.material}
          </span>
          {level !== 'ok' && (
            <span className="mono inline-flex items-center gap-0.5 text-[9px] px-1 py-px rounded-sm bg-amber-400/10 border border-amber-400/30 text-amber-400 tracking-wider">
              <AlertTriangle size={8} />
              {level === 'critical' ? 'CRÍT' : 'BAJO'}
            </span>
          )}
        </div>
        <p className="text-sm font-semibold text-tech-white truncate leading-tight">
          {f.colorName}
        </p>
        <p className="mono text-[10px] text-gunmetal mt-0.5 truncate">
          {f.vendor}
          {f.batch ? ` · ${f.batch}` : ''}
        </p>
      </div>
      <div className="flex flex-col items-end shrink-0 gap-1 min-w-[64px]">
        <span className="mono text-sm font-semibold text-tech-white">
          {Math.round(p)}
          <span className="text-gunmetal text-[10px]">%</span>
        </span>
        <div className="w-14 h-0.5 bg-white/5 rounded">
          <div
            className="h-full rounded"
            style={{
              width: `${p}%`,
              background: level === 'ok' ? '#3B82F6' : '#FBBF24',
              boxShadow: level !== 'ok' ? `0 0 4px #FBBF2455` : 'none',
            }}
          />
        </div>
        <span className="mono text-[10px] text-gunmetal">{fmtG(f.remaining)}</span>
      </div>
    </button>
  );
}

function MobileFAB({ onClick, label = 'Agregar' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-5 right-4 z-30 inline-flex items-center gap-2 pl-4 pr-5 py-3.5 rounded-full bg-forge-teal text-[#0A1014] font-semibold text-sm shadow-2xl active:scale-95 transition-transform"
      style={{ boxShadow: '0 8px 24px rgba(45, 212, 191, 0.35)' }}
      aria-label={label}
    >
      <Plus size={16} strokeWidth={2.5} />
      {label}
    </button>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

/**
 * Página principal de inventario.
 *
 * @returns {JSX.Element}
 */
export default function InventoryPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [tab, setTab] = useState('filamentos');
  const [view, setView] = useState('grid');
  const [query, setQuery] = useState('');
  const [materialFilters, setMaterialFilters] = useState([]);
  const [sort, setSort] = useState('lowFirst');
  // Drawer/sheet state — un slot por tipo para no mezclar bodies.
  const [selected, setSelected] = useState(null);            // filamento
  const [selectedItem, setSelectedItem] = useState(null);    // insumo / herramienta / consumible
  const [selectedPurchase, setSelectedPurchase] = useState(null); // PO

  const [filaments, setFilaments] = useState([]);
  const [supplies, setSupplies] = useState([]);
  const [tools, setTools] = useState([]);
  const [consumables, setConsumables] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);

  // Carga inicial: todos los conteos en paralelo (la pestaña activa los necesita
  // para los badges; las inactivas se mantienen sincronizadas para no esperar
  // al cambiar de tab).
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const [allRes, poRes] = await Promise.allSettled([
        getInventoryItems(),
        getPurchaseOrders(),
      ]);
      if (cancelled) return;
      // Una sola llamada a /inventory/items/ y partimos por category client-side
      // (la función getInventoryItems no acepta params, y filtrar local es
      // más rápido que 4 round-trips).
      if (allRes.status === 'fulfilled') {
        const all = allRes.value.data || [];
        setFilaments(all.filter((i) => i.category === 'Filamento').map(mapToFilament));
        setSupplies(all.filter((i) => i.category === 'Insumo'));
        setTools(all.filter((i) => i.category === 'Herramienta'));
        setConsumables(all.filter((i) => i.category === 'Consumible'));
      }
      if (poRes.status === 'fulfilled') {
        setPurchases(poRes.value.data || []);
      }
      setLoading(false);
    };
    load().catch((err) => {
      if (cancelled) return;
      console.error(err);
      toast.error('No se pudo cargar el inventario');
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Filtrado + sorting de filamentos
  const filteredFilaments = useMemo(() => {
    let list = filaments;
    if (materialFilters.length) {
      list = list.filter((f) => materialFilters.includes(f.material));
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (f) =>
          f.colorName.toLowerCase().includes(q) ||
          f.batch.toLowerCase().includes(q) ||
          f.location.toLowerCase().includes(q) ||
          f.material.toLowerCase().includes(q) ||
          f.vendor.toLowerCase().includes(q),
      );
    }
    const arr = [...list];
    switch (sort) {
      case 'lowFirst':
        arr.sort((a, b) => fillPercent(a) - fillPercent(b));
        break;
      case 'valueDesc':
        arr.sort(
          (a, b) => (b.remaining / 1000) * b.costPerKg - (a.remaining / 1000) * a.costPerKg,
        );
        break;
      case 'weightDesc':
        arr.sort((a, b) => b.remaining - a.remaining);
        break;
      case 'material':
      default:
        arr.sort(
          (a, b) => MATERIAL_ORDER.indexOf(a.material) - MATERIAL_ORDER.indexOf(b.material),
        );
    }
    return arr;
  }, [filaments, materialFilters, query, sort]);

  const groups = useMemo(() => {
    if (sort === 'lowFirst') return groupFilaments(filteredFilaments, MATERIAL_ORDER);
    return [{ key: 'all', label: 'Resultados', items: filteredFilaments, warn: false }];
  }, [filteredFilaments, sort]);

  const stats = useMemo(() => computeFilamentStats(filaments), [filaments]);

  /**
   * Filtra + ordena items genéricos (insumos/herramientas/consumibles) por la
   * misma query y sort que filamentos. lowFirst usa ratio quantity/min.
   */
  const filterGeneric = (list) => {
    let arr = list;
    const q = query.trim().toLowerCase();
    if (q) {
      arr = arr.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.supplier_name || '').toLowerCase().includes(q) ||
          (i.description || '').toLowerCase().includes(q) ||
          (i.notes || '').toLowerCase().includes(q),
      );
    }
    const ratio = (i) => {
      const min = Number(i.min_quantity || 0);
      if (min <= 0) return Infinity;
      return Number(i.quantity || 0) / min;
    };
    const next = [...arr];
    switch (sort) {
      case 'lowFirst':
        next.sort((a, b) => ratio(a) - ratio(b));
        break;
      case 'valueDesc':
        next.sort(
          (a, b) =>
            Number(b.unit_cost || 0) * Number(b.quantity || 0) -
            Number(a.unit_cost || 0) * Number(a.quantity || 0),
        );
        break;
      case 'weightDesc':
        next.sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0));
        break;
      default:
        next.sort((a, b) => a.name.localeCompare(b.name));
    }
    return next;
  };

  const filteredSupplies = useMemo(() => filterGeneric(supplies), [supplies, query, sort]);
  const filteredTools = useMemo(() => filterGeneric(tools), [tools, query, sort]);
  const filteredConsumables = useMemo(() => filterGeneric(consumables), [consumables, query, sort]);

  const filteredPurchases = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = q
      ? purchases.filter(
          (p) =>
            (p.supplier_name || p.vendor || '').toLowerCase().includes(q) ||
            (p.tracking_number || '').toLowerCase().includes(q) ||
            (p.status || '').toLowerCase().includes(q) ||
            String(p.id).includes(q),
        )
      : [...purchases];
    return arr.sort(
      (a, b) => new Date(b.order_date || b.created_at || 0).getTime() - new Date(a.order_date || a.created_at || 0).getTime(),
    );
  }, [purchases, query]);

  /**
   * Devuelve estadísticas básicas para mostrar bajo el header en tabs no-filamento.
   */
  const genericStats = (list) => {
    let low = 0;
    let crit = 0;
    let totalValue = 0;
    for (const it of list) {
      const lvl = itemLevel(it);
      if (lvl === 'low') low += 1;
      if (lvl === 'critical') crit += 1;
      totalValue += Number(it.unit_cost || 0) * Number(it.quantity || 0);
    }
    return { count: list.length, low, critical: crit, totalValue };
  };

  const openPOs = useMemo(
    () => purchases.filter((p) => (p.status || '').toLowerCase() !== 'completado').length,
    [purchases],
  );
  const openPOsValue = useMemo(
    () =>
      purchases
        .filter((p) => (p.status || '').toLowerCase() !== 'completado')
        .reduce((s, p) => s + Number(p.total || 0), 0),
    [purchases],
  );

  const counts = {
    filamentos: filaments.length,
    insumos: supplies.length,
    herramientas: tools.length,
    consumibles: consumables.length,
    compras: purchases.length,
  };

  const toggleMat = (id) =>
    setMaterialFilters((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const clearFilters = () => {
    setQuery('');
    setMaterialFilters([]);
  };

  // ── Shell mobile ───────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="flex flex-col -mx-4 -mt-4">
        <MobileInPageHeader tab={tab} count={counts[tab] ?? 0} />
        {tab === 'filamentos' && (
          <>
            <MobileHeroStatus stats={stats} consumption14d={CONSUMPTION_PLACEHOLDER} />
            <MobileMiniKPIs stats={stats} openPOs={openPOs} openPOsValue={openPOsValue} />
          </>
        )}
        <MobileTabs value={tab} onChange={setTab} counts={counts} />

        {tab === 'filamentos' ? (
          <>
            <MobileSearchBar query={query} onQuery={setQuery} />
            <MobileChips materialFilters={materialFilters} onToggleMat={toggleMat} />
            <div className="flex items-center justify-between px-4 mt-3 mb-1">
              <span className="mono text-[11px] text-gunmetal">
                {filteredFilaments.length} de {filaments.length} spools
              </span>
              {(query || materialFilters.length > 0) && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-[11px] text-blue-400 hover:text-blue-300"
                >
                  Limpiar
                </button>
              )}
            </div>
            {loading ? (
              <p className="px-4 py-12 text-center text-gunmetal text-sm">Cargando inventario…</p>
            ) : filteredFilaments.length === 0 ? (
              <div className="px-4 py-12 flex flex-col items-center gap-2 text-center">
                <Search size={22} className="text-gunmetal-dim" />
                <p className="text-sm font-semibold text-tech-white">
                  {filaments.length === 0 ? 'Sin filamentos aún' : 'Sin resultados'}
                </p>
                <p className="text-xs text-gunmetal max-w-xs">
                  {filaments.length === 0
                    ? 'Toca el botón + para agregar el primer filamento.'
                    : 'Ajusta los filtros o limpia la búsqueda.'}
                </p>
              </div>
            ) : (
              <div className="mt-2 pb-28">
                {groups.map((g) => (
                  <section key={g.key} className="mb-3">
                    <div
                      className={`flex items-baseline gap-2 px-4 mb-1.5 mt-3 ${
                        g.warn ? '' : ''
                      }`}
                    >
                      <h3
                        className={`text-[10px] font-semibold uppercase tracking-widest inline-flex items-center gap-1.5 ${
                          g.warn ? 'text-amber-400' : 'text-steel'
                        }`}
                      >
                        {g.warn && <AlertTriangle size={10} />}
                        {g.label}
                      </h3>
                      <span className="mono text-[10px] text-gunmetal">
                        {g.items.length}
                      </span>
                      {g.warn && (
                        <Link
                          to="/inventory/purchases?new=1"
                          className="ml-auto inline-flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300"
                        >
                          <ShoppingCart size={11} /> Comprar
                        </Link>
                      )}
                    </div>
                    <ul>
                      {g.items.map((f) => (
                        <li key={f.id}>
                          <FilamentRow f={f} onClick={setSelected} />
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </>
        ) : tab === 'compras' ? (
          <>
            <MobileSearchBar query={query} onQuery={setQuery} />
            <div className="flex items-center justify-between px-4 mt-3 mb-1">
              <span className="mono text-[11px] text-gunmetal">
                {filteredPurchases.length} de {purchases.length} pedidos
              </span>
            </div>
            {loading ? (
              <p className="px-4 py-12 text-center text-gunmetal text-sm">Cargando…</p>
            ) : filteredPurchases.length === 0 ? (
              <div className="px-4 py-12 flex flex-col items-center gap-2 text-center">
                <ShoppingCart size={22} className="text-gunmetal-dim" />
                <p className="text-sm font-semibold text-tech-white">
                  {purchases.length === 0 ? 'Sin pedidos de compra' : 'Sin resultados'}
                </p>
              </div>
            ) : (
              <ul className="mt-2 pb-28">
                {filteredPurchases.map((p) => (
                  <li key={p.id}>
                    <PurchaseRow po={p} onClick={setSelectedPurchase} />
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <>
            <MobileSearchBar query={query} onQuery={setQuery} />
            <div className="flex items-center justify-between px-4 mt-3 mb-1">
              <span className="mono text-[11px] text-gunmetal">
                {tab === 'insumos'
                  ? `${filteredSupplies.length} de ${supplies.length} insumos`
                  : tab === 'herramientas'
                  ? `${filteredTools.length} de ${tools.length} herramientas`
                  : `${filteredConsumables.length} de ${consumables.length} consumibles`}
              </span>
            </div>
            {(() => {
              const list =
                tab === 'insumos'
                  ? filteredSupplies
                  : tab === 'herramientas'
                  ? filteredTools
                  : filteredConsumables;
              const rawList =
                tab === 'insumos' ? supplies : tab === 'herramientas' ? tools : consumables;
              const meta = categoryMeta(
                tab === 'insumos'
                  ? 'Insumo'
                  : tab === 'herramientas'
                  ? 'Herramienta'
                  : 'Consumible',
              );
              const Icon = meta.icon;
              if (loading) {
                return <p className="px-4 py-12 text-center text-gunmetal text-sm">Cargando…</p>;
              }
              if (list.length === 0) {
                return (
                  <div className="px-4 py-12 flex flex-col items-center gap-2 text-center">
                    <Icon size={22} className="text-gunmetal-dim" />
                    <p className="text-sm font-semibold text-tech-white">
                      {rawList.length === 0 ? `Sin ${tab} aún` : 'Sin resultados'}
                    </p>
                  </div>
                );
              }
              return (
                <ul className="mt-2 pb-28">
                  {list.map((it) => (
                    <li key={it.id}>
                      <InventoryItemRow item={it} onClick={setSelectedItem} />
                    </li>
                  ))}
                </ul>
              );
            })()}
          </>
        )}

        <MobileFAB onClick={() => navigate(tab === 'compras' ? '/inventory/purchases' : '/inventory/stock?new=1')} />

        <MobileSheet
          open={!!selected}
          onClose={() => setSelected(null)}
          title={selected?.colorName}
          height="full"
        >
          <FilamentDrawerBody f={selected} />
        </MobileSheet>
        <MobileSheet
          open={!!selectedItem}
          onClose={() => setSelectedItem(null)}
          title={selectedItem?.name}
          height="full"
        >
          <InventoryItemDrawerBody item={selectedItem} />
        </MobileSheet>
        <MobileSheet
          open={!!selectedPurchase}
          onClose={() => setSelectedPurchase(null)}
          title={selectedPurchase ? `PO-${String(selectedPurchase.id).padStart(4, '0')}` : ''}
          height="full"
        >
          <PurchaseDrawerBody po={selectedPurchase} />
        </MobileSheet>
      </div>
    );
  }

  // ── Shell desktop ──────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen -m-4 md:-m-6 xl:-m-8">
      {/* Header */}
      <header className="flex items-center gap-4 px-6 py-3.5 border-b border-[var(--color-border-soft)] bg-[var(--color-surf-sidebar)] sticky top-0 z-20">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-md shrink-0"
            style={{
              background: 'rgba(59, 130, 246, 0.12)',
              color: '#3B82F6',
              border: '1px solid rgba(59, 130, 246, 0.25)',
            }}
          >
            <Box size={13} />
          </span>
          <span className="text-sm text-gunmetal whitespace-nowrap">Inventario</span>
          <span className="text-gunmetal-dim shrink-0">›</span>
          <span className="text-sm font-semibold text-tech-white whitespace-nowrap capitalize">
            {tab}
          </span>
          <span className="mono text-[10px] px-1.5 py-0.5 rounded-sm bg-white/6 border border-[var(--color-border)] text-steel tracking-wider whitespace-nowrap shrink-0 ml-1">
            {counts[tab] ?? 0} ítems
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/inventory/io" className="btn btn-ghost btn-sm">
            <Upload size={13} /> Importar
          </Link>
          <Link to="/inventory/io" className="btn btn-ghost btn-sm">
            <Download size={13} /> Exportar
          </Link>
          <span className="w-px h-4 bg-[var(--color-border)]" />
          <Button variant="ghost" iconOnly icon={Bell} iconSize={14} aria-label="Notificaciones" />
          <Link to="/inventory/stock?new=1" className="btn btn-primary btn-sm">
            <Plus size={13} /> Agregar
          </Link>
        </div>
      </header>

      <KPIStrip stats={stats} openPOs={openPOs} openPOsValue={openPOsValue} />

      <CategoryTabs value={tab} onChange={setTab} counts={counts} />

      {tab === 'filamentos' ? (
        <>
          <Toolbar
            query={query}
            onQuery={setQuery}
            materialFilters={materialFilters}
            onToggleMat={toggleMat}
            view={view}
            onView={setView}
            sort={sort}
            onSort={setSort}
            onClear={clearFilters}
          />

          <div className="flex items-center gap-2.5 px-6 mb-1">
            <span className="mono text-[11px] text-gunmetal">
              {filteredFilaments.length} de {filaments.length} spools
            </span>
          </div>

          {loading ? (
            <div className="px-6 py-16 text-center text-gunmetal text-sm">Cargando inventario…</div>
          ) : filteredFilaments.length === 0 ? (
            <div className="px-6 py-16 flex flex-col items-center gap-3 text-center">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{
                  background: 'rgba(59, 130, 246, 0.08)',
                  border: '1px solid rgba(59, 130, 246, 0.22)',
                  color: '#3B82F6',
                }}
              >
                <Search size={22} />
              </div>
              <p className="text-sm font-semibold text-tech-white">
                {filaments.length === 0 ? 'Sin filamentos aún' : 'Sin resultados'}
              </p>
              <p className="text-xs text-gunmetal max-w-sm">
                {filaments.length === 0
                  ? 'Agrega un filamento para empezar a usarlo en la calculadora y la cola.'
                  : 'Ajusta los filtros o limpia la búsqueda para ver todos los spools.'}
              </p>
              {filaments.length === 0 && (
                <Link to="/inventory/stock?new=1" className="btn btn-primary btn-sm">
                  <Plus size={13} /> Agregar primer filamento
                </Link>
              )}
            </div>
          ) : view === 'grid' ? (
            <FilamentGrid groups={groups} onCardClick={setSelected} />
          ) : (
            <FilamentTable items={filteredFilaments} onRowClick={setSelected} />
          )}
        </>
      ) : tab === 'compras' ? (
        <>
          <div className="flex flex-wrap gap-3 items-center px-6 py-3 sticky top-0 bg-forge-black/80 backdrop-blur z-10">
            <div className="flex items-center gap-2 bg-[var(--color-surf-card)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-1.5 min-w-[260px] basis-[280px] flex-1 max-w-md">
              <Search size={13} className="text-gunmetal" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Proveedor, tracking, status, PO id…"
                className="flex-1 bg-transparent border-0 outline-0 text-tech-white text-sm placeholder:text-gunmetal-dim"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="text-gunmetal hover:text-tech-white"
                  aria-label="Limpiar"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <span className="flex-1" />
            <span className="mono text-[11px] text-gunmetal">
              {filteredPurchases.length} de {purchases.length} pedidos
            </span>
          </div>
          {loading ? (
            <p className="px-6 py-16 text-center text-gunmetal text-sm">Cargando pedidos…</p>
          ) : filteredPurchases.length === 0 ? (
            <div className="px-6 py-16 flex flex-col items-center gap-3 text-center">
              <ShoppingCart size={28} className="text-gunmetal-dim" />
              <p className="text-sm font-semibold text-tech-white">
                {purchases.length === 0 ? 'Sin pedidos de compra' : 'Sin resultados'}
              </p>
              {purchases.length === 0 && (
                <Link to="/inventory/purchases" className="btn btn-primary btn-sm">
                  <Plus size={13} /> Crear pedido
                </Link>
              )}
            </div>
          ) : (
            <div
              className="px-6 pb-8 grid gap-3"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}
            >
              {filteredPurchases.map((p) => (
                <PurchaseCard key={p.id} po={p} onClick={setSelectedPurchase} />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {(() => {
            const list =
              tab === 'insumos'
                ? filteredSupplies
                : tab === 'herramientas'
                ? filteredTools
                : filteredConsumables;
            const rawList =
              tab === 'insumos' ? supplies : tab === 'herramientas' ? tools : consumables;
            const tabStats = genericStats(rawList);
            const meta = categoryMeta(
              tab === 'insumos' ? 'Insumo' : tab === 'herramientas' ? 'Herramienta' : 'Consumible',
            );
            const Icon = meta.icon;
            return (
              <>
                <div className="flex flex-wrap gap-3 items-center px-6 py-3 sticky top-0 bg-forge-black/80 backdrop-blur z-10">
                  <div className="flex items-center gap-2 bg-[var(--color-surf-card)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-1.5 min-w-[260px] basis-[280px] flex-1 max-w-md">
                    <Search size={13} className="text-gunmetal" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={`Buscar ${tab}, proveedor, notas…`}
                      className="flex-1 bg-transparent border-0 outline-0 text-tech-white text-sm placeholder:text-gunmetal-dim"
                    />
                    {query && (
                      <button
                        type="button"
                        onClick={() => setQuery('')}
                        className="text-gunmetal hover:text-tech-white"
                        aria-label="Limpiar"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                    className="input mono text-xs cursor-pointer w-auto min-w-[170px]"
                  >
                    <option value="lowFirst">Stock bajo primero</option>
                    <option value="material">Por nombre</option>
                    <option value="valueDesc">Valor (mayor)</option>
                    <option value="weightDesc">Cantidad (mayor)</option>
                  </select>
                  <span className="flex-1" />
                  <div className="flex gap-3 items-center mono text-[11px] text-gunmetal">
                    <span>{tabStats.count} ítems</span>
                    {tabStats.critical > 0 && (
                      <span className="text-rose-300">{tabStats.critical} crít.</span>
                    )}
                    {tabStats.low > 0 && <span className="text-amber-400">{tabStats.low} bajos</span>}
                    <span>{fmtCOP(tabStats.totalValue)}</span>
                  </div>
                </div>
                {loading ? (
                  <p className="px-6 py-16 text-center text-gunmetal text-sm">Cargando…</p>
                ) : list.length === 0 ? (
                  <div className="px-6 py-16 flex flex-col items-center gap-3 text-center">
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center"
                      style={{
                        background: `${meta.color}1A`,
                        border: `1px solid ${meta.color}40`,
                        color: meta.color,
                      }}
                    >
                      <Icon size={22} />
                    </div>
                    <p className="text-sm font-semibold text-tech-white">
                      {rawList.length === 0 ? `Sin ${tab} aún` : 'Sin resultados'}
                    </p>
                    {rawList.length === 0 && (
                      <Link to="/inventory/stock?new=1" className="btn btn-primary btn-sm">
                        <Plus size={13} /> Agregar primer ítem
                      </Link>
                    )}
                  </div>
                ) : (
                  <div
                    className="px-6 pb-8 grid gap-3"
                    style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
                  >
                    {list.map((it) => (
                      <InventoryItemCard key={it.id} item={it} onClick={setSelectedItem} />
                    ))}
                  </div>
                )}
              </>
            );
          })()}
        </>
      )}

      <DetailDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? selected.rawId : ''}
        width={460}
      >
        <FilamentDrawerBody f={selected} />
      </DetailDrawer>
      <DetailDrawer
        open={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        title={selectedItem?.name || ''}
        width={460}
      >
        <InventoryItemDrawerBody item={selectedItem} />
      </DetailDrawer>
      <DetailDrawer
        open={!!selectedPurchase}
        onClose={() => setSelectedPurchase(null)}
        title={selectedPurchase ? `PO-${String(selectedPurchase.id).padStart(4, '0')}` : ''}
        width={460}
      >
        <PurchaseDrawerBody po={selectedPurchase} />
      </DetailDrawer>

      <footer className="mt-auto px-6 py-2.5 border-t border-[var(--color-border-soft)] bg-[var(--color-surf-sidebar)] flex flex-wrap items-center gap-4 text-[11px] text-gunmetal">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px #34D39966' }} />
          <span className="mono">CONECTADO</span>
        </span>
        <span className="w-px h-3 bg-[var(--color-border)]" />
        <span className="mono">{filaments.length} spools</span>
        <span className="mono">{(stats.totalGrams / 1000).toFixed(2)} kg</span>
        <span className="mono">{fmtCOP(stats.totalValue)}</span>
        <span className="flex-1" />
        <span className="mono">es-CO · COP</span>
      </footer>
    </div>
  );
}

function _TabPlaceholderDeprecated({ tab }) {
  // Reservado por si alguna pestaña futura necesita placeholder antes de portarse.
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
      <p className="text-sm font-semibold text-tech-white">Vista {tab} en construcción</p>
    </div>
  );
}
