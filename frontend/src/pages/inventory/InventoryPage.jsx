/**
 * @file Página de la app Inventario.
 *
 * Layout de pestañas: Filamentos · Insumos · Herramientas · Consumibles · Compras.
 *
 * La pestaña Filamentos tiene el tratamiento completo (KPIs, toolbar con
 * search + chips de material + sort + toggle grid/table, grupos por stock
 * bajo y por material, drawer de detalle con form de edición).
 *
 * Usa primitives de `components/ui/` (Card, Chip, KPI, Sparkline, Swatch,
 * DetailDrawer, Button) y el adapter `utils/inventoryAdapter.js`.
 *
 * @module pages/inventory/InventoryPage
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  Beaker,
  Bell,
  Box,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  Droplet,
  Edit3,
  Filter,
  Grid3x3,
  History,
  List,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Scissors,
  Search,
  ShoppingCart,
  Trash2,
  Truck,
  TrendingUp,
  Upload,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  AppTabs,
  Button,
  Card,
  Chip,
  DetailDrawer,
  EmptyState,
  KPI,
  KPIStrip as KPIStripBase,
  LineItems,
  MobileSheet,
  Sparkline,
  StatusPill,
  Swatch,
} from '../../components/ui';
import MobileAppHeader from '../../components/MobileAppHeader';
import { useConfirm } from '../../components/ConfirmDialog';
import { useIsMobile } from '../../hooks/useMediaQuery';
import InventoryNavTabs from './InventoryNavTabs';
import {
  arrivePurchaseOrder,
  createInventoryItem,
  deleteInventoryItem,
  createPurchaseOrder,
  getFilamentProfile,
  getInventoryItems,
  getPurchaseOrders,
  updateInventoryItem,
  updatePurchaseOrder,
  upsertFilamentProfile,
} from '../../services/api';
import { MATERIALS, MATERIAL_ORDER } from '../../config/materials';
import {
  computeFilamentStats,
  fillPercent,
  fmtCOP,
  fmtG,
  fmtKg,
  fmtUSD,
  groupFilaments,
  mapToFilament,
  stockLevel,
} from '../../utils/inventoryAdapter';
import './InventoryPage.css';

// Placeholder de consumo diario hasta que tengamos el endpoint real.
// 14 días, gramos por día. Cuando tengamos historial real, viene del backend.
const CONSUMPTION_PLACEHOLDER = [240, 180, 95, 310, 280, 420, 360, 145, 0, 0, 290, 510, 380, 295];

// ─── KPI Strip ───────────────────────────────────────────────────────────────

// KPIStrip local → shared <KPIStrip> (P5): desktop flex-wrap como hoy;
// mobile scroll-snap + fade derecho (indicador de que hay más a la derecha).
function KPIStrip({ stats, openPOs, openPOsValue }) {
  return (
    <KPIStripBase className="px-6 pt-4 pb-2">
      <KPI
        label="Capital"
        value={fmtUSD(stats.totalValue)}
        unit="USD"
        sub="valor en inventario"
        accent="#3B82F6"
        icon={ArrowUpRight}
      />
      <KPI
        label="Material"
        value={(stats.totalGrams / 1000).toFixed(2)}
        unit="kg"
        sub={`${stats.spoolCount} spools`}
        accent="#94A0AE"
        icon={Droplet}
      />
      <KPI
        label="Consumo · 14d"
        value={(CONSUMPTION_PLACEHOLDER.reduce((s, n) => s + n, 0) / 1000).toFixed(2)}
        unit="kg"
        sub="placeholder · pronto desde quotes"
        accent="#2DD4BF"
        sparkline={CONSUMPTION_PLACEHOLDER}
      />
      <KPI
        label="Stock bajo"
        value={stats.lowCount}
        unit="ítems"
        sub={`${stats.criticalCount} críticos`}
        accent="#FBBF24"
        icon={AlertTriangle}
      />
      <KPI
        label="Próx. compras"
        value={openPOs}
        unit="POs"
        sub={openPOsValue > 0 ? `${fmtCOP(openPOsValue)} en ruta` : 'sin pedidos abiertos'}
        accent="#8B5CF6"
        icon={ShoppingCart}
      />
    </KPIStripBase>
  );
}

// ─── Category tabs ───────────────────────────────────────────────────────────

const TABS = [
  { id: 'filamentos',   label: 'Filamentos',   shortLabel: 'Filamentos',   icon: Droplet },
  { id: 'insumos',      label: 'Insumos',      shortLabel: 'Insumos',      icon: Box },
  { id: 'herramientas', label: 'Herramientas', shortLabel: 'Herram.',      icon: Scissors },
  { id: 'consumibles',  label: 'Consumibles',  shortLabel: 'Consum.',      icon: Beaker },
  { id: 'compras',      label: 'Compras',      shortLabel: 'Compras',      icon: ShoppingCart },
];

// CategoryTabs → AppTabs (P4): overflow-x + scroll-snap + fade derecho, con
// badge de conteo por categoría. Ref: inventory.html §CategoryTabs.
function CategoryTabs({ value, onChange, counts }) {
  return (
    <AppTabs
      items={TABS.map((t) => ({ id: t.id, label: t.label, icon: t.icon, count: counts[t.id] ?? 0 }))}
      value={value}
      onChange={onChange}
      accent="var(--color-app-inventory)"
      className="px-6"
    />
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
          data-search-input
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
          <option value="recent">Uso reciente</option>
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
  // Issue #59: cuando el filamento está crítico, borde amarillo en TODO
  // el card (mismo patrón visual del círculo del swatch). El nivel BAJO
  // recibe acento más suave para diferenciar visualmente del CRÍTICO.
  const criticalBorder = level === 'critical'
    ? 'ring-1 ring-amber-400/60 border-amber-400/40'
    : level === 'low'
      ? 'ring-1 ring-amber-400/25 border-amber-400/25'
      : '';
  return (
    <Card
      as="button"
      interactive
      onClick={() => onClick(f)}
      className={`relative flex flex-col gap-3 p-3.5 text-left w-full ${criticalBorder}`}
    >
      {/* Top: swatch + meta */}
      <div className="flex gap-3 items-start">
        <Swatch color={f.color} size={48} level={level} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <span className="mono text-[9.5px] px-1.5 py-px rounded-sm bg-white/5 border border-[var(--color-border)] text-steel tracking-wider">
              {f.material}
            </span>
            {f.subtype && (
              <span className="mono text-[9.5px] px-1.5 py-px rounded-sm bg-white/5 border border-[var(--color-border-soft)] text-gunmetal tracking-wider">
                {f.subtype}
              </span>
            )}
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
          <span className="mono text-xs text-tech-white whitespace-nowrap">{fmtUSD(f.costPerKg)}</span>
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
      {/* Fix #15: overflow-x-auto (antes overflow-hidden) + min-width para que
          en 1024-1279px (contenido ~736px con sidebar) la tabla haga scroll-x
          en vez de comprimir columnas ilegiblemente. Ref: inventory.html. */}
      <div className="border border-[var(--color-border)] rounded-xl overflow-x-auto bg-[var(--color-surf-card)]">
        <table className="w-full border-collapse min-w-[860px]">
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
                  <td className="px-3 py-3 w-[110px] mono text-xs text-tech-white">{fmtUSD(f.costPerKg)}</td>
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

function FilamentDrawerBody({ f, onReassign, onAddToPurchase, onDelete }) {
  if (!f) return null;
  const level = stockLevel(f);
  const p = fillPercent(f);
  // costPerKg está en USD, los gramos restantes / 1000 → kg → valor USD
  const remainValueUsd = (f.remaining / 1000) * f.costPerKg;
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
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <span className="mono text-[10px] px-1.5 py-0.5 rounded-sm bg-white/5 border border-[var(--color-border)] text-steel tracking-wider">
              {f.material}
            </span>
            {f.subtype && (
              <span className="mono text-[10px] px-1.5 py-0.5 rounded-sm bg-white/5 border border-[var(--color-border-soft)] text-gunmetal tracking-wider">
                {f.subtype}
              </span>
            )}
            {level !== 'ok' && (
              <span className={`mono inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-sm bg-amber-400/10 border border-amber-400/30 text-amber-400 tracking-wider ${level === 'critical' ? 'pulse-soft' : ''}`}>
                <AlertTriangle size={10} />
                {level === 'critical' ? 'CRÍTICO' : 'BAJO'}
              </span>
            )}
          </div>
          <h2 className="text-xl font-semibold text-tech-white tracking-tight leading-tight truncate">
            {f.colorName}
          </h2>
          <p className="mono text-[10.5px] text-gunmetal mt-1 truncate">
            {f.batch ? `${f.batch} · ` : ''}
            {f.vendor && f.vendor !== '—' ? f.vendor : ''}
            {f.color ? ` · ${String(f.color).toUpperCase()}` : ''}
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
        <div className="relative h-2 bg-white/5 rounded overflow-hidden mb-2">
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
          <span className="mono text-[11px] text-gunmetal">{fmtG(Math.max(0, f.total - f.remaining))} usados</span>
        </div>
      </div>

      {/* Stats grid 2×3+ */}
      <div className="grid grid-cols-2 gap-1.5">
        <SheetStat label="Valor restante" value={fmtUSD(remainValueUsd)} />
        <SheetStat label="Costo / kg" value={fmtUSD(f.costPerKg)} />
        <SheetStat
          label="Precio venta / kg"
          value={f.salePerKg != null ? fmtUSD(f.salePerKg) : '—'}
        />
        <SheetStat label="Spool original" value={fmtKg(f.total)} />
        <SheetStat label="Ubicación" value={locationShort} icon={MapPin} />
        <SheetStat label="Último uso" value={lastUsedLabel} icon={Clock} />
        {f.minQuantity > 0 && (
          <SheetStat
            label="Stock mínimo"
            value={`${fmtG(f.minQuantity)} ${f.unit || 'g'}`}
          />
        )}
      </div>

      {/* Notes */}
      {f.notes && (
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Notas</span>
          <p className="text-sm text-steel whitespace-pre-wrap mt-1">{f.notes}</p>
        </Card>
      )}

      {/* Acciones inline (1:1 design Claude — antes del Historial, no en footer) */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onAddToPurchase?.(f)}
          className="btn btn-primary btn-sm flex-1 justify-center"
        >
          <ShoppingCart size={13} /> Agregar a compras
        </button>
        <button
          type="button"
          onClick={() => onReassign?.(f)}
          className="btn btn-sm flex-1 justify-center"
        >
          <RefreshCw size={13} /> Reasignar batch
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(f)}
            className="btn btn-sm justify-center text-rose-400 border border-rose-400/30 hover:bg-rose-400/10"
            title="Eliminar filamento"
            aria-label="Eliminar filamento"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* Historial reciente — placeholder hasta endpoint real (quotes/queue) */}
      <div>
        <div className="lbl-eyebrow mb-2 inline-flex items-center gap-1.5">
          <History size={11} /> Historial reciente
        </div>
        <p className="text-[10.5px] text-gunmetal mb-2">
          Pendiente: integrar consumo desde cola e impresiones reales.
        </p>
        {f.updatedAt && (
          <div className="flex items-center gap-2.5 py-2 border-b border-dashed border-[var(--color-border-soft)]">
            <span className="mono text-[11px] text-gunmetal min-w-[60px] shrink-0 whitespace-nowrap">
              {lastUsedFromDate(f.updatedAt)}
            </span>
            <span className="flex-1 min-w-0 text-[12.5px] text-tech-white truncate">
              Última actualización del spool
            </span>
          </div>
        )}
      </div>
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

function InventoryItemDrawerBody({ item, onDelete }) {
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

      {/* "Editar en vista clásica" eliminado — ahora la edición vive en el
          ItemFormDrawer accesible vía el ícono Pencil del header del view drawer. */}

      {onDelete && (
        <div className="flex gap-2 pt-2 border-t border-[var(--color-border-soft)]">
          <button
            type="button"
            onClick={() => onDelete(item)}
            className="btn btn-sm justify-center w-full text-rose-400 border border-rose-400/30 hover:bg-rose-400/10"
          >
            <Trash2 size={13} /> Eliminar {meta.label.toLowerCase()}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Purchase card / row / drawer (compras) ─────────────────────────────────

/**
 * Devuelve metadatos del badge para un status de PO.
 * Mapeo de tonos:
 *   - `done`     → completado (verde)
 *   - `printing` → en camino (azul, replica del design "en ruta")
 *   - `warn`     → procesando (amber, replica del design)
 *   - `danger`   → cancelado (rojo)
 *   - `neutral`  → borrador / sin estado
 */
function purchaseStatusBadge(status) {
  const s = (status || '').toLowerCase();
  if (s.includes('complet'))
    return { label: 'Completado', tone: 'done', icon: Check };
  if (s.includes('camino') || s.includes('ship') || s.includes('transit'))
    return { label: 'En camino', tone: 'printing', icon: Truck };
  if (s.includes('proces') || s.includes('pending') || s.includes('pend'))
    return { label: 'Procesando', tone: 'warn', icon: Clock };
  if (s.includes('borrador') || s.includes('draft'))
    return { label: 'Borrador', tone: 'neutral', icon: Edit3 };
  if (s.includes('cancel'))
    return { label: 'Cancelado', tone: 'danger', icon: X };
  return { label: status || 'Sin estado', tone: 'neutral', icon: null };
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
            <StatusPill tone={badge.tone} icon={badge.icon || undefined}>
              {badge.label}
            </StatusPill>
          </div>
          <p className="text-sm font-semibold text-tech-white truncate">
            {po.supplier || 'Proveedor sin nombre'}
          </p>
          <p className="mono text-[10.5px] text-gunmetal mt-0.5 truncate">
            {itemsCount} ítem{itemsCount === 1 ? '' : 's'}
            {po.created_at ? ` · ${String(po.created_at).split('T')[0]}` : ''}
            {po.estimated_arrival ? ` · llega ${String(po.estimated_arrival).split('T')[0]}` : ''}
          </p>
        </div>
        <span className="mono text-base font-semibold text-forge-teal whitespace-nowrap shrink-0">
          {fmtCOP(poTotal(po))}
        </span>
      </div>
      {Array.isArray(po.items) && po.items.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-2 border-t border-dashed border-[var(--color-border-soft)]">
          {po.items.slice(0, 6).map((line, i) => (
            <span
              key={i}
              className="mono text-[10px] px-1.5 py-0.5 rounded-sm bg-white/5 border border-[var(--color-border-soft)] text-steel whitespace-nowrap truncate max-w-[180px]"
              title={line.name || line.item_name}
            >
              {line.name || line.item_name || `Ítem ${i + 1}`}
            </span>
          ))}
          {po.items.length > 6 && (
            <span className="mono text-[10px] text-gunmetal self-center">
              +{po.items.length - 6}
            </span>
          )}
        </div>
      )}
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
          <StatusPill tone={badge.tone} icon={badge.icon || undefined}>
            {badge.label}
          </StatusPill>
        </div>
        <p className="text-sm font-semibold text-tech-white truncate">{po.supplier || 'Proveedor'}</p>
        <p className="mono text-[10px] text-gunmetal mt-0.5">PO-{String(po.id).padStart(4, '0')}</p>
      </div>
      <span className="mono text-sm text-tech-white whitespace-nowrap shrink-0">{fmtCOP(poTotal(po))}</span>
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
          <StatusPill tone={badge.tone} icon={badge.icon || undefined} size="lg">
            {badge.label}
          </StatusPill>
          <span className="mono text-[10px] text-gunmetal">PO-{String(po.id).padStart(4, '0')}</span>
        </div>
        <h2 className="text-lg font-semibold text-tech-white truncate">
          {po.supplier || 'Proveedor sin nombre'}
        </h2>
        {(po.created_at || po.estimated_arrival) && (
          <p className="mono text-[11.5px] text-gunmetal mt-0.5">
            {po.created_at ? `Pedido ${String(po.created_at).split('T')[0]}` : ''}
            {po.estimated_arrival ? ` · llega ${String(po.estimated_arrival).split('T')[0]}` : ''}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Total</span>
          <p className="mono text-base font-semibold text-forge-teal mt-0.5">{fmtCOP(poTotal(po))}</p>
        </Card>
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Ítems</span>
          <p className="mono text-base font-semibold text-tech-white mt-0.5">{items.length || po.items_count || '—'}</p>
        </Card>
        {po.tracking_number && (
          <Card className="p-3 col-span-2">
            <span className="lbl-eyebrow text-[9px]">Tracking</span>
            <p className="mono text-sm text-tech-white mt-0.5 break-all">{po.tracking_number}</p>
            {po.carrier && (
              <p className="mono text-[11px] text-gunmetal">{po.carrier}</p>
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

      {/* "Editar en vista clásica" eliminado — usar Pencil del drawer header */}
    </div>
  );
}

// ─── Mobile shell ────────────────────────────────────────────────────────────
// Nota: el header (logo + hamburger) lo provee AppLayout vía Studio Sidebar.
// Esta vista sólo renderiza el contenido específico del inventario.

/**
 * Overlay de búsqueda mobile (replica `inventory-mobile.jsx::SearchOverlay`).
 * Aparece flotando sobre el header y permite buscar por color/batch/ubicación.
 */
function MobileSearchOverlay({ open, onClose, query, onQuery }) {
  if (!open) return null;
  return (
    <div
      className="fixed top-16 left-4 right-4 z-40 flex items-center gap-2 px-3 py-2.5 rounded-xl border border-[var(--color-border-strong)] shadow-2xl"
      style={{ background: 'var(--color-surf-card)', boxShadow: '0 12px 24px rgba(0,0,0,0.4)' }}
      role="dialog"
      aria-label="Buscar"
    >
      <Search size={15} className="text-gunmetal shrink-0" />
      <input
        autoFocus
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="Color, batch, ubicación…"
        className="flex-1 min-w-0 bg-transparent border-0 outline-0 text-tech-white text-sm placeholder:text-gunmetal-dim"
      />
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar búsqueda"
        className="text-gunmetal hover:text-tech-white shrink-0"
      >
        <X size={15} />
      </button>
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
                {fmtUSD(stats.totalValue)}
              </span>
              <span className="mono text-xs text-gunmetal">USD</span>
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
    <div className="phone-scroll mt-3 px-4 pb-3 flex gap-1.5 overflow-x-auto">
      {TABS.map((t) => {
        const Icon = t.icon;
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[12.5px] font-medium whitespace-nowrap shrink-0 transition-colors border ${
              active
                ? 'bg-blue-500/14 border-blue-500/45 text-blue-300'
                : 'bg-transparent border-[var(--color-border)] text-steel'
            }`}
          >
            <Icon size={13} style={{ color: active ? 'var(--color-app-inventory)' : 'var(--color-gunmetal)' }} />
            {t.shortLabel || t.label}
            <span
              className={`mono text-[9.5px] px-1.5 py-px rounded-full border ${
                active
                  ? 'bg-blue-500/15 border-blue-500/25 text-blue-300'
                  : 'bg-white/5 border-[var(--color-border)] text-gunmetal'
              }`}
            >
              {counts[t.id] ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Nota: el search bar mobile fue removido a petición del usuario. El diseño
// Claude Design accede al search vía overlay en el header; CFS prefiere no
// tenerlo en mobile por ahora. Se conserva la function comentada por si más
// adelante se requiere reactivar.
//
// eslint-disable-next-line no-unused-vars
function _MobileSearchBarDeprecated({ query, onQuery }) {
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
      className="w-full text-left flex items-center gap-3 px-3 py-3 rounded-xl bg-[var(--color-surf-card)] border border-[var(--color-border)] active:scale-[0.98] active:bg-[var(--color-surf-hover)] hover:bg-[var(--color-surf-hover)]/60 transition-all"
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
      <div className="flex flex-col items-end shrink-0 gap-1 min-w-[60px]">
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
      className="fixed bottom-20 right-4 z-40 inline-flex items-center gap-2 pl-4 pr-5 py-3.5 rounded-full bg-forge-teal text-[#0A1014] font-semibold text-sm shadow-2xl active:scale-95 transition-transform"
      style={{ boxShadow: '0 8px 24px rgba(45, 212, 191, 0.35)' }}
      aria-label={label}
    >
      <Plus size={16} strokeWidth={2.5} />
      {label}
    </button>
  );
}

// ─── Filament Form Drawer (create/edit) ────────────────────────────────────

/**
 * Estado inicial del form. En modo `edit` se rellena desde `mapToFilament`'d
 * filament + raw fields. En modo `create` arranca vacío con defaults.
 *
 * Mapeo de defaults para `filament_density` por tipo (g/cm³) — datos
 * típicos de hojas técnicas de proveedores.
 */
const FILAMENT_DENSITY_DEFAULTS = {
  PLA: 1.24,
  'PLA-CF': 1.30,
  PETG: 1.27,
  'PETG-CF': 1.30,
  ABS: 1.04,
  ASA: 1.07,
  TPU: 1.21,
  Nylon: 1.14,
};

// ─── Reusable form helpers (module-level — CRÍTICO) ─────────────────────────
// Estos componentes DEBEN vivir fuera del form drawer. Si se definen
// dentro de la función del drawer, cada re-render crea componentes NUEVOS,
// React desmonta/remonta los inputs en cada keystroke, y el foco salta
// al primer input con `autoFocus` (bug reportado: cursor salta a "Nombre
// interno" cada vez que escribís en otro campo).

// Port mk-: el input del mockup (mk-f-input) — bg surface-card-2, borde,
// 44px min-height, focus azul. `mono`/`resize-y`/`uppercase` se siguen
// apilando por los call-sites que lo necesitan.
const FORM_INPUT_CLS = 'mk-f-input';

function FormFieldRow({ label, required, error, children }) {
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="mk-f-label flex items-center gap-1">
        {label}
        {required && <span className="text-rose-400" aria-label="requerido">*</span>}
        {error && (
          <span className="ml-auto text-rose-300 normal-case tracking-normal text-[10px] font-normal">
            {error}
          </span>
        )}
      </span>
      {children}
    </label>
  );
}

function FormSectionTitle({ children }) {
  return <div className="mk-fsec-title">{children}</div>;
}

function emptyFilamentForm() {
  return {
    name: '',
    description: '',
    color_name: '',
    color_hex: '#3B82F6',
    filament_type: 'PLA',
    filament_subtype: '',
    filament_brand: '',
    batch: '',
    weight_per_roll: 1000,
    quantity: 1000,
    min_quantity: '',
    price_per_kg: '',
    sale_price: '',
    filament_diameter: 1.75,
    filament_density: '',
    location: '',
    supplier_name: '',
    supplier_contact: '',
    needs_purchase: false,
    notes: '',
    // Perfil de impresión (slicer) — referencia, no afecta costo.
    nozzle_temp_min: '',
    nozzle_temp_max: '',
    bed_temp: '',
    bed_temp_first_layer: '',
    print_speed_mms: '',
    retraction_distance_mm: '',
    retraction_speed_mms: '',
    flow_ratio: '',
    fan_speed_percent: '',
    // K-value manual (issue #118) — calibrado por el usuario, sin sync con
    // ninguna impresora (no hay una en LAN). `nozzle_diameter` acompaña
    // porque el K depende del diámetro con el que se calibró.
    k_value: '',
    nozzle_diameter: '0.4',
    calibrated_at: '',
    profile_notes: '',
  };
}

/** Pre-fill de los campos de perfil de slicer desde FilamentProfileResponse. */
function profileToForm(p) {
  return {
    nozzle_temp_min: p?.nozzle_temp_min ?? '',
    nozzle_temp_max: p?.nozzle_temp_max ?? '',
    bed_temp: p?.bed_temp ?? '',
    bed_temp_first_layer: p?.bed_temp_first_layer ?? '',
    print_speed_mms: p?.print_speed_mms ?? '',
    retraction_distance_mm: p?.retraction_distance_mm ?? '',
    retraction_speed_mms: p?.retraction_speed_mms ?? '',
    flow_ratio: p?.flow_ratio ?? '',
    fan_speed_percent: p?.fan_speed_percent ?? '',
    k_value: p?.k_value ?? '',
    nozzle_diameter: p?.nozzle_diameter ?? '0.4',
    calibrated_at: p?.calibrated_at ? p.calibrated_at.slice(0, 10) : '',
    profile_notes: p?.notes ?? '',
  };
}

/**
 * Pre-fill desde un `Filament` (modo edit). Lee tanto los campos mapeados
 * como los raw del backend (vía la prop `raw` que se inyecta al click del
 * editar — ver `setEditing()` en InventoryPage).
 */
function filamentToForm(raw) {
  return {
    name: raw?.name || '',
    description: raw?.description || '',
    color_name: raw?.color_name || '',
    color_hex: raw?.color_hex || '#3B82F6',
    filament_type: raw?.filament_type || 'PLA',
    filament_subtype: raw?.filament_subtype || '',
    filament_brand: raw?.filament_brand || '',
    batch: raw?.batch || '',
    weight_per_roll: Number(raw?.weight_per_roll) || 1000,
    quantity: Number(raw?.quantity) || 0,
    min_quantity: raw?.min_quantity != null ? Number(raw.min_quantity) : '',
    price_per_kg: raw?.price_per_kg != null ? Number(raw.price_per_kg) : '',
    sale_price: raw?.sale_price != null ? Number(raw.sale_price) : '',
    filament_diameter: raw?.filament_diameter != null ? Number(raw.filament_diameter) : 1.75,
    filament_density: raw?.filament_density != null ? Number(raw.filament_density) : '',
    location: raw?.location || '',
    supplier_name: raw?.supplier_name || '',
    supplier_contact: raw?.supplier_contact || '',
    needs_purchase: !!raw?.needs_purchase,
    notes: raw?.notes || '',
  };
}

/**
 * Drawer derecho (desktop) o bottom sheet (mobile) para crear o editar un
 * filamento. Reemplaza el modal centrado anterior — replica el patrón
 * visual del view-drawer (mismo wrapper, mismo width).
 *
 * @param {Object} props
 * @param {boolean}              props.open
 * @param {() => void}           props.onClose
 * @param {'create'|'edit'}      [props.mode='create']
 * @param {Object}               [props.initial]    - Filament raw para modo edit
 * @param {(item: Object) => void} [props.onSaved]  - Callback con el item creado/editado
 * @param {boolean}              props.isMobile
 */
function FilamentFormDrawer({ open, onClose, mode = 'create', initial, onSaved, isMobile }) {
  const [form, setForm] = useState(emptyFilamentForm());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  // Una vez que el InventoryItem se crea con éxito, guardamos su id acá.
  // Si el upsert del perfil de slicer falla justo después y el drawer
  // se queda abierto para reintentar, un segundo submit debe actualizar
  // ese item (no crear uno duplicado) aunque `mode` siga siendo 'create'.
  const [savedItemId, setSavedItemId] = useState(null);

  useEffect(() => {
    if (!open) return;
    setForm(mode === 'edit' && initial ? filamentToForm(initial) : emptyFilamentForm());
    setErrors({});
    setSavedItemId(null);
    // Perfil de slicer vive en tabla separada — se carga aparte. 404 = sin
    // perfil guardado todavía, el form de perfil queda en blanco.
    // `cancelled` evita que un fetch lento de un filamento previo (ej. si
    // el admin cierra y abre el drawer de otro filamento rápido) pise el
    // form del filamento que está abierto ahora.
    let cancelled = false;
    if (mode === 'edit' && initial?.id) {
      getFilamentProfile(initial.id)
        .then((res) => { if (!cancelled) setForm((cur) => ({ ...cur, ...profileToForm(res.data) })); })
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, [open, mode, initial]);

  // Guard temprano: si no está abierto, no rendereamos nada — evita que
  // un crash dentro del form (ej. ícono undefined) deje DOM zombi visible
  // en la pantalla y previene side-effects de wrappers que igual hacen
  // body scroll lock con open=false.
  if (!open) return null;

  const update = (k, v) => setForm((cur) => ({ ...cur, [k]: v }));

  const onTypeChange = (v) => {
    setForm((cur) => ({
      ...cur,
      filament_type: v,
      // Auto-fill densidad si está vacío (no sobreescribe si el user ya editó).
      filament_density:
        cur.filament_density === '' && FILAMENT_DENSITY_DEFAULTS[v] != null
          ? FILAMENT_DENSITY_DEFAULTS[v]
          : cur.filament_density,
    }));
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = 'Requerido';
    if (!form.color_name.trim()) next.color_name = 'Requerido';
    if (!form.filament_type) next.filament_type = 'Requerido';
    const wpr = Number(form.weight_per_roll);
    if (!wpr || wpr <= 0) next.weight_per_roll = 'Debe ser > 0';
    const q = Number(form.quantity);
    if (q < 0 || q > wpr) next.quantity = `0 — ${wpr} g`;
    const dia = Number(form.filament_diameter);
    if (form.filament_diameter !== '' && (!dia || dia <= 0)) next.filament_diameter = '> 0';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        category: 'Filamento',
        unit: 'g',
        description: form.description.trim() || null,
        quantity: Number(form.quantity),
        weight_per_roll: Number(form.weight_per_roll),
        filament_type: form.filament_type,
        filament_subtype: form.filament_subtype.trim() || null,
        filament_brand: form.filament_brand.trim() || null,
        batch: form.batch.trim() || null,
        color_name: form.color_name.trim(),
        color_hex: form.color_hex,
        price_per_kg: form.price_per_kg !== '' ? Number(form.price_per_kg) : null,
        sale_price: form.sale_price !== '' ? Number(form.sale_price) : null,
        filament_diameter: form.filament_diameter !== '' ? Number(form.filament_diameter) : null,
        filament_density: form.filament_density !== '' ? Number(form.filament_density) : null,
        location: form.location.trim() || null,
        supplier_name: form.supplier_name.trim() || null,
        supplier_contact: form.supplier_contact.trim() || null,
        needs_purchase: form.needs_purchase,
        min_quantity: form.min_quantity !== '' ? Number(form.min_quantity) : 0,
        notes: form.notes.trim() || null,
      };
      // Si un intento anterior ya creó el item pero falló el perfil,
      // `savedItemId` ya existe — un reintento debe actualizar, no crear
      // un segundo InventoryItem duplicado.
      const isEditLike = mode === 'edit' || savedItemId != null;
      const targetId = mode === 'edit' ? initial.id : savedItemId;
      const res = isEditLike
        ? await updateInventoryItem(targetId, payload)
        : await createInventoryItem(payload);
      toast.success(
        isEditLike
          ? `Filamento "${payload.color_name}" actualizado`
          : `Filamento "${payload.color_name}" agregado`,
      );

      const itemId = isEditLike ? targetId : res.data?.id;
      if (itemId) setSavedItemId(itemId);

      // Perfil de slicer — se guarda junto con el filamento. Si falla,
      // NO cerramos el drawer: el usuario debe ver el error y poder
      // reintentar, en vez de creer que todo quedó guardado.
      if (itemId) {
        const profilePayload = {
          nozzle_temp_min: form.nozzle_temp_min !== '' ? Number(form.nozzle_temp_min) : null,
          nozzle_temp_max: form.nozzle_temp_max !== '' ? Number(form.nozzle_temp_max) : null,
          bed_temp: form.bed_temp !== '' ? Number(form.bed_temp) : null,
          bed_temp_first_layer: form.bed_temp_first_layer !== '' ? Number(form.bed_temp_first_layer) : null,
          print_speed_mms: form.print_speed_mms !== '' ? Number(form.print_speed_mms) : null,
          retraction_distance_mm: form.retraction_distance_mm !== '' ? Number(form.retraction_distance_mm) : null,
          retraction_speed_mms: form.retraction_speed_mms !== '' ? Number(form.retraction_speed_mms) : null,
          flow_ratio: form.flow_ratio !== '' ? Number(form.flow_ratio) : null,
          fan_speed_percent: form.fan_speed_percent !== '' ? Number(form.fan_speed_percent) : null,
          k_value: form.k_value !== '' ? Number(form.k_value) : null,
          nozzle_diameter: form.nozzle_diameter.trim() || null,
          calibrated_at: form.calibrated_at || null,
          notes: form.profile_notes.trim() || null,
        };
        try {
          await upsertFilamentProfile(itemId, profilePayload);
        } catch {
          toast.error(
            'El filamento se guardó, pero el perfil de impresión NO — revisa los valores y presiona Guardar de nuevo.',
            { duration: 8000 },
          );
          onSaved?.(res.data);
          return; // Drawer queda abierto para reintentar solo el perfil.
        }
      }

      onSaved?.(res.data);
      onClose?.();
    } catch (err) {
      const msg = err?.response?.data?.detail || 'No se pudo guardar el filamento';
      toast.error(typeof msg === 'string' ? msg : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const body = (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] text-gunmetal">
        Los campos marcados con <span className="text-rose-400">*</span> son obligatorios.
      </p>

      <FormSectionTitle>Identificación</FormSectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormFieldRow label="Nombre interno" required error={errors.name}>
          <input
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="ej. Spool A-2611"
            className={FORM_INPUT_CLS}
            autoFocus
          />
        </FormFieldRow>
        <FormFieldRow label="Nombre del color" required error={errors.color_name}>
          <input
            value={form.color_name}
            onChange={(e) => update('color_name', e.target.value)}
            placeholder="ej. Carbon Black"
            className={FORM_INPUT_CLS}
          />
        </FormFieldRow>
        <FormFieldRow label="Material" required error={errors.filament_type}>
          <select
            value={form.filament_type}
            onChange={(e) => onTypeChange(e.target.value)}
            className={FORM_INPUT_CLS}
          >
            {MATERIALS.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </FormFieldRow>
        <FormFieldRow label="Subtipo" hint="Silk, Matte, Basic, CF, 95A…">
          <input
            value={form.filament_subtype}
            onChange={(e) => update('filament_subtype', e.target.value)}
            placeholder="ej. Silk"
            list="filament-subtypes"
            className={FORM_INPUT_CLS}
          />
          <datalist id="filament-subtypes">
            <option value="Basic" />
            <option value="Silk" />
            <option value="Matte" />
            <option value="Wood" />
            <option value="Glow" />
            <option value="CF" />
            <option value="Translucent" />
            <option value="95A" />
            <option value="85A" />
          </datalist>
        </FormFieldRow>
        <FormFieldRow label="Color (hex)">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form.color_hex}
              onChange={(e) => update('color_hex', e.target.value)}
              className="w-10 h-9 rounded border border-[var(--color-border-strong)] bg-transparent shrink-0 cursor-pointer"
              aria-label="Selector de color"
            />
            <input
              value={form.color_hex}
              onChange={(e) => update('color_hex', e.target.value)}
              placeholder="#3B82F6"
              className={`${FORM_INPUT_CLS} mono uppercase`}
            />
          </div>
        </FormFieldRow>
        <div className="sm:col-span-2">
          <FormFieldRow label="Descripción">
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="Detalles adicionales (acabado, opacidad, recomendaciones de uso…)"
              className={`${FORM_INPUT_CLS} resize-y`}
            />
          </FormFieldRow>
        </div>
      </div>

      <FormSectionTitle>Stock</FormSectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormFieldRow label="Peso total spool (g)" required error={errors.weight_per_roll}>
          <input
            type="number"
            min="1"
            step="1"
            value={form.weight_per_roll}
            onChange={(e) => {
              const v = e.target.value;
              update('weight_per_roll', v);
              if (Number(form.quantity) > Number(v)) update('quantity', v);
            }}
            className={`${FORM_INPUT_CLS} mono`}
          />
        </FormFieldRow>
        <FormFieldRow label="Restante actual (g)" required error={errors.quantity}>
          <input
            type="number"
            min="0"
            step="1"
            value={form.quantity}
            onChange={(e) => update('quantity', e.target.value)}
            className={`${FORM_INPUT_CLS} mono`}
          />
        </FormFieldRow>
        <FormFieldRow label="Stock mínimo (g)">
          <input
            type="number"
            min="0"
            step="1"
            value={form.min_quantity}
            onChange={(e) => update('min_quantity', e.target.value)}
            placeholder="ej. 200"
            className={`${FORM_INPUT_CLS} mono`}
          />
        </FormFieldRow>
        <FormFieldRow label="¿Marcar como necesario comprar?">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.needs_purchase}
              onChange={(e) => update('needs_purchase', e.target.checked)}
              className="w-4 h-4 accent-amber-400"
            />
            <span className="text-[12px] text-steel">
              {form.needs_purchase ? 'Sí — aparece en el listado de pendientes' : 'No, stock OK'}
            </span>
          </label>
        </FormFieldRow>
      </div>

      <FormSectionTitle>Técnico</FormSectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormFieldRow label="Diámetro (mm)" error={errors.filament_diameter}>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.filament_diameter}
            onChange={(e) => update('filament_diameter', e.target.value)}
            placeholder="1.75"
            className={`${FORM_INPUT_CLS} mono`}
          />
        </FormFieldRow>
        <FormFieldRow label="Densidad (g/cm³)">
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.filament_density}
            onChange={(e) => update('filament_density', e.target.value)}
            placeholder={FILAMENT_DENSITY_DEFAULTS[form.filament_type] || '1.24'}
            className={`${FORM_INPUT_CLS} mono`}
          />
        </FormFieldRow>
      </div>

      <FormSectionTitle>Perfil de impresión (slicer)</FormSectionTitle>
      <p className="text-[11.5px] text-gunmetal -mt-1.5">
        Referencia rápida al laminar — no afecta el cálculo de costo.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormFieldRow label="Temp. boquilla mín (°C)">
          <input
            type="number" min="0" max="400" step="1"
            value={form.nozzle_temp_min}
            onChange={(e) => update('nozzle_temp_min', e.target.value)}
            placeholder="ej. 200"
            className={`${FORM_INPUT_CLS} mono`}
          />
        </FormFieldRow>
        <FormFieldRow label="Temp. boquilla máx (°C)">
          <input
            type="number" min="0" max="400" step="1"
            value={form.nozzle_temp_max}
            onChange={(e) => update('nozzle_temp_max', e.target.value)}
            placeholder="ej. 220"
            className={`${FORM_INPUT_CLS} mono`}
          />
        </FormFieldRow>
        <FormFieldRow label="Temp. cama (°C)">
          <input
            type="number" min="0" max="200" step="1"
            value={form.bed_temp}
            onChange={(e) => update('bed_temp', e.target.value)}
            placeholder="ej. 55"
            className={`${FORM_INPUT_CLS} mono`}
          />
        </FormFieldRow>
        <FormFieldRow label="Temp. cama 1ra capa (°C)">
          <input
            type="number" min="0" max="200" step="1"
            value={form.bed_temp_first_layer}
            onChange={(e) => update('bed_temp_first_layer', e.target.value)}
            placeholder="ej. 60"
            className={`${FORM_INPUT_CLS} mono`}
          />
        </FormFieldRow>
        <FormFieldRow label="Velocidad impresión (mm/s)">
          <input
            type="number" min="0" step="1"
            value={form.print_speed_mms}
            onChange={(e) => update('print_speed_mms', e.target.value)}
            placeholder="ej. 250"
            className={`${FORM_INPUT_CLS} mono`}
          />
        </FormFieldRow>
        <FormFieldRow label="Flow ratio">
          <input
            type="number" min="0" step="0.01"
            value={form.flow_ratio}
            onChange={(e) => update('flow_ratio', e.target.value)}
            placeholder="ej. 0.98"
            className={`${FORM_INPUT_CLS} mono`}
          />
        </FormFieldRow>
        <FormFieldRow label="Distancia retracción (mm)">
          <input
            type="number" min="0" step="0.1"
            value={form.retraction_distance_mm}
            onChange={(e) => update('retraction_distance_mm', e.target.value)}
            placeholder="ej. 0.8"
            className={`${FORM_INPUT_CLS} mono`}
          />
        </FormFieldRow>
        <FormFieldRow label="Velocidad retracción (mm/s)">
          <input
            type="number" min="0" step="1"
            value={form.retraction_speed_mms}
            onChange={(e) => update('retraction_speed_mms', e.target.value)}
            placeholder="ej. 40"
            className={`${FORM_INPUT_CLS} mono`}
          />
        </FormFieldRow>
        <FormFieldRow label="Fan speed (%)">
          <input
            type="number" min="0" max="100" step="1"
            value={form.fan_speed_percent}
            onChange={(e) => update('fan_speed_percent', e.target.value)}
            placeholder="ej. 100"
            className={`${FORM_INPUT_CLS} mono`}
          />
        </FormFieldRow>
        <FormFieldRow label="K-value" hint="Calibrado a mano — no sincroniza con ninguna impresora">
          <input
            type="number" min="0" max="99" step="0.001"
            value={form.k_value}
            onChange={(e) => update('k_value', e.target.value)}
            placeholder="ej. 0.020"
            className={`${FORM_INPUT_CLS} mono`}
          />
        </FormFieldRow>
        <FormFieldRow label="Diámetro de boquilla usado" hint="El K-value depende de esto">
          <input
            value={form.nozzle_diameter}
            onChange={(e) => update('nozzle_diameter', e.target.value)}
            placeholder="ej. 0.4"
            className={`${FORM_INPUT_CLS} mono`}
          />
        </FormFieldRow>
        <FormFieldRow label="Calibrado el">
          <input
            type="date"
            value={form.calibrated_at}
            onChange={(e) => update('calibrated_at', e.target.value)}
            className={`${FORM_INPUT_CLS} mono`}
          />
        </FormFieldRow>
        <div className="sm:col-span-2">
          <FormFieldRow label="Notas de perfil">
            <textarea
              rows={2}
              value={form.profile_notes}
              onChange={(e) => update('profile_notes', e.target.value)}
              placeholder="ej. necesita enclosure, usar chamber heater…"
              className={`${FORM_INPUT_CLS} resize-y`}
            />
          </FormFieldRow>
        </div>
      </div>

      <FormSectionTitle>Proveedor & costo</FormSectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormFieldRow label="Marca">
          <input
            value={form.filament_brand}
            onChange={(e) => update('filament_brand', e.target.value)}
            placeholder="ej. BambuLab"
            className={FORM_INPUT_CLS}
          />
        </FormFieldRow>
        <FormFieldRow label="Batch">
          <input
            value={form.batch}
            onChange={(e) => update('batch', e.target.value)}
            placeholder="ej. A-2611"
            className={`${FORM_INPUT_CLS} mono`}
          />
        </FormFieldRow>
        <FormFieldRow label="Proveedor (vendor)">
          <input
            value={form.supplier_name}
            onChange={(e) => update('supplier_name', e.target.value)}
            placeholder="ej. 3D Hardware Colombia"
            className={FORM_INPUT_CLS}
          />
        </FormFieldRow>
        <FormFieldRow label="Contacto proveedor">
          <input
            value={form.supplier_contact}
            onChange={(e) => update('supplier_contact', e.target.value)}
            placeholder="email / tel / link"
            className={FORM_INPUT_CLS}
          />
        </FormFieldRow>
        <FormFieldRow label="Precio costo por kg (USD)">
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.price_per_kg}
            onChange={(e) => update('price_per_kg', e.target.value)}
            placeholder="ej. 25.00"
            className={`${FORM_INPUT_CLS} mono`}
          />
        </FormFieldRow>
        <FormFieldRow label="Precio de venta por kg (USD)">
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.sale_price}
            onChange={(e) => update('sale_price', e.target.value)}
            placeholder="ej. 40.00"
            className={`${FORM_INPUT_CLS} mono`}
          />
        </FormFieldRow>
        <FormFieldRow label="Ubicación">
          <input
            value={form.location}
            onChange={(e) => update('location', e.target.value)}
            placeholder="ej. Estante 1 · Caja A"
            className={FORM_INPUT_CLS}
          />
        </FormFieldRow>
        <div /> {/* spacer */}
      </div>

      <FormSectionTitle>Notas</FormSectionTitle>
      <FormFieldRow label="Observaciones">
        <textarea
          rows={3}
          value={form.notes}
          onChange={(e) => update('notes', e.target.value)}
          placeholder="Condiciones de almacenamiento, intentos previos, configuración recomendada…"
          className={`${FORM_INPUT_CLS} resize-y`}
        />
      </FormFieldRow>
    </div>
  );

  const footerSlot = (
    <>
      <button
        type="button"
        onClick={onClose}
        className="btn btn-sm flex-1 justify-center"
        disabled={saving}
      >
        Cancelar
      </button>
      <button
        type="button"
        onClick={submit}
        disabled={saving}
        className="btn btn-primary btn-sm flex-1 justify-center disabled:opacity-50"
      >
        {saving
          ? 'Guardando…'
          : mode === 'edit'
            ? (<><Pencil size={13} /> Guardar cambios</>)
            : (<><Plus size={13} /> Agregar</>)}
      </button>
    </>
  );

  const title = mode === 'edit'
    ? (initial?.color_name || initial?.name || 'Editar filamento')
    : 'Agregar filamento';
  const eyebrow = mode === 'edit'
    ? `Editando · ${initial?.color_name || 'filamento'}`
    : 'Inventario · nuevo';

  if (isMobile) {
    return (
      <MobileSheet open={open} onClose={onClose} title={title} height="full">
        <div className="px-5 pt-4 pb-2">{body}</div>
        {open && (
          <div className="px-5 pt-3 pb-5 border-t border-[var(--color-border-soft)] flex gap-2 sticky bottom-0 bg-[var(--color-surf-sidebar)]">
            {footerSlot}
          </div>
        )}
      </MobileSheet>
    );
  }

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      title={title}
      eyebrow={eyebrow}
      width={520}
      footer={footerSlot}
    >
      {body}
    </DetailDrawer>
  );
}

// ─── Item Form Drawer (Insumo / Herramienta / Consumible) ────────────────

/**
 * Defaults por categoría — unidad y nombre display del header del drawer.
 */
const CATEGORY_DEFAULTS = {
  Insumo:      { unit: 'unidades', accent: '#3B82F6', icon: Box,      label: 'insumo' },
  Herramienta: { unit: 'unidades', accent: '#94A0AE', icon: Scissors, label: 'herramienta' },
  Consumible:  { unit: 'unidades', accent: '#FBBF24', icon: Beaker,   label: 'consumible' },
};

function emptyItemForm(category) {
  const cd = CATEGORY_DEFAULTS[category] || { unit: 'unidades' };
  return {
    name: '',
    description: '',
    unit: cd.unit,
    quantity: 0,
    min_quantity: '',
    unit_cost: '',
    sale_price: '',
    supplier_name: '',
    supplier_contact: '',
    location: '',
    needs_purchase: false,
    notes: '',
    // Consumible-specific
    useful_life_hours: '',
  };
}

function itemToForm(raw) {
  return {
    name: raw?.name || '',
    description: raw?.description || '',
    unit: raw?.unit || 'unidades',
    quantity: Number(raw?.quantity) || 0,
    min_quantity: raw?.min_quantity != null ? Number(raw.min_quantity) : '',
    unit_cost: raw?.unit_cost != null ? Number(raw.unit_cost) : '',
    sale_price: raw?.sale_price != null ? Number(raw.sale_price) : '',
    supplier_name: raw?.supplier_name || '',
    supplier_contact: raw?.supplier_contact || '',
    location: raw?.location || '',
    needs_purchase: !!raw?.needs_purchase,
    notes: raw?.notes || '',
    useful_life_hours: raw?.useful_life_hours != null ? Number(raw.useful_life_hours) : '',
  };
}

/**
 * Drawer para crear/editar Insumos, Herramientas y Consumibles.
 * Sustituye la vista clásica `/inventory/stock?edit=X`.
 *
 * @param {Object} props
 * @param {boolean}              props.open
 * @param {() => void}           props.onClose
 * @param {'Insumo'|'Herramienta'|'Consumible'} props.category
 * @param {'create'|'edit'}      [props.mode='create']
 * @param {Object}               [props.initial]
 * @param {(item: Object) => void} [props.onSaved]
 * @param {boolean}              props.isMobile
 */
function ItemFormDrawer({ open, onClose, category, mode = 'create', initial, onSaved, isMobile }) {
  const [form, setForm] = useState(emptyItemForm(category));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(mode === 'edit' && initial ? itemToForm(initial) : emptyItemForm(category));
    setErrors({});
  }, [open, mode, initial, category]);

  if (!open) return null;

  const cd = CATEGORY_DEFAULTS[category] || CATEGORY_DEFAULTS.Insumo;
  const CategoryIcon = cd.icon;
  const update = (k, v) => setForm((cur) => ({ ...cur, [k]: v }));

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = 'Requerido';
    if (!form.unit.trim()) next.unit = 'Requerido';
    const q = Number(form.quantity);
    if (q < 0) next.quantity = '≥ 0';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        category,
        description: form.description.trim() || null,
        unit: form.unit.trim(),
        quantity: Number(form.quantity),
        min_quantity: form.min_quantity !== '' ? Number(form.min_quantity) : 0,
        unit_cost: form.unit_cost !== '' ? Number(form.unit_cost) : 0,
        sale_price: form.sale_price !== '' ? Number(form.sale_price) : null,
        supplier_name: form.supplier_name.trim() || null,
        supplier_contact: form.supplier_contact.trim() || null,
        location: form.location.trim() || null,
        needs_purchase: form.needs_purchase,
        notes: form.notes.trim() || null,
      };
      if (category === 'Consumible' && form.useful_life_hours !== '') {
        payload.useful_life_hours = Number(form.useful_life_hours);
      }
      const res = mode === 'edit'
        ? await updateInventoryItem(initial.id, payload)
        : await createInventoryItem(payload);
      toast.success(mode === 'edit' ? `"${payload.name}" actualizado` : `"${payload.name}" agregado`);
      onSaved?.(res.data);
      onClose?.();
    } catch (err) {
      const msg = err?.response?.data?.detail || 'No se pudo guardar';
      toast.error(typeof msg === 'string' ? msg : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const body = (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] text-gunmetal">
        Los campos marcados con <span className="text-rose-400">*</span> son obligatorios.
      </p>

      <FormSectionTitle>Identificación</FormSectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormFieldRow label={`Nombre del ${cd.label}`} required error={errors.name}>
          <input
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder={`ej. Boquilla 0.4mm`}
            className={FORM_INPUT_CLS}
            autoFocus
          />
        </FormFieldRow>
        <FormFieldRow label="Unidad" required error={errors.unit}>
          <input
            value={form.unit}
            onChange={(e) => update('unit', e.target.value)}
            placeholder="ej. unidades, ml, g"
            className={FORM_INPUT_CLS}
          />
        </FormFieldRow>
        <div className="sm:col-span-2">
          <FormFieldRow label="Descripción">
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="Detalles adicionales"
              className={`${FORM_INPUT_CLS} resize-y`}
            />
          </FormFieldRow>
        </div>
      </div>

      <FormSectionTitle>Stock</FormSectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormFieldRow label="Cantidad actual" required error={errors.quantity}>
          <input
            type="number"
            min="0"
            step="1"
            value={form.quantity}
            onChange={(e) => update('quantity', e.target.value)}
            className={`${FORM_INPUT_CLS} mono`}
          />
        </FormFieldRow>
        <FormFieldRow label="Stock mínimo">
          <input
            type="number"
            min="0"
            step="1"
            value={form.min_quantity}
            onChange={(e) => update('min_quantity', e.target.value)}
            placeholder="ej. 5"
            className={`${FORM_INPUT_CLS} mono`}
          />
        </FormFieldRow>
        <FormFieldRow label="¿Marcar como necesario comprar?">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.needs_purchase}
              onChange={(e) => update('needs_purchase', e.target.checked)}
              className="w-4 h-4 accent-amber-400"
            />
            <span className="text-[12px] text-steel">
              {form.needs_purchase ? 'Sí — aparece en pendientes' : 'No, stock OK'}
            </span>
          </label>
        </FormFieldRow>
      </div>

      <FormSectionTitle>Costo & venta</FormSectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormFieldRow label="Costo unitario (COP)">
          <input
            type="number"
            min="0"
            step="100"
            value={form.unit_cost}
            onChange={(e) => update('unit_cost', e.target.value)}
            placeholder="ej. 5000"
            className={`${FORM_INPUT_CLS} mono`}
          />
        </FormFieldRow>
        <FormFieldRow label="Precio de venta (COP)">
          <input
            type="number"
            min="0"
            step="100"
            value={form.sale_price}
            onChange={(e) => update('sale_price', e.target.value)}
            placeholder="ej. 8000"
            className={`${FORM_INPUT_CLS} mono`}
          />
        </FormFieldRow>
        {category === 'Consumible' && (
          <FormFieldRow label="Vida útil (horas de impresión)">
            <input
              type="number"
              min="0"
              step="1"
              value={form.useful_life_hours}
              onChange={(e) => update('useful_life_hours', e.target.value)}
              placeholder="ej. 500"
              className={`${FORM_INPUT_CLS} mono`}
            />
          </FormFieldRow>
        )}
      </div>

      <FormSectionTitle>Proveedor & ubicación</FormSectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormFieldRow label="Proveedor (vendor)">
          <input
            value={form.supplier_name}
            onChange={(e) => update('supplier_name', e.target.value)}
            placeholder="ej. 3D Hardware Colombia"
            className={FORM_INPUT_CLS}
          />
        </FormFieldRow>
        <FormFieldRow label="Contacto proveedor">
          <input
            value={form.supplier_contact}
            onChange={(e) => update('supplier_contact', e.target.value)}
            placeholder="email / tel / link"
            className={FORM_INPUT_CLS}
          />
        </FormFieldRow>
        <FormFieldRow label="Ubicación">
          <input
            value={form.location}
            onChange={(e) => update('location', e.target.value)}
            placeholder="ej. Cajón A · Estante 2"
            className={FORM_INPUT_CLS}
          />
        </FormFieldRow>
      </div>

      <FormSectionTitle>Notas</FormSectionTitle>
      <FormFieldRow label="Observaciones">
        <textarea
          rows={3}
          value={form.notes}
          onChange={(e) => update('notes', e.target.value)}
          placeholder="Información extra, recomendaciones de uso…"
          className={`${FORM_INPUT_CLS} resize-y`}
        />
      </FormFieldRow>
    </div>
  );

  const footerSlot = (
    <>
      <button
        type="button"
        onClick={onClose}
        className="btn btn-sm flex-1 justify-center"
        disabled={saving}
      >
        Cancelar
      </button>
      <button
        type="button"
        onClick={submit}
        disabled={saving}
        className="btn btn-primary btn-sm flex-1 justify-center disabled:opacity-50"
      >
        {saving
          ? 'Guardando…'
          : mode === 'edit'
            ? (<><Pencil size={13} /> Guardar cambios</>)
            : (<><Plus size={13} /> Agregar</>)}
      </button>
    </>
  );

  const title = mode === 'edit'
    ? (initial?.name || `Editar ${cd.label}`)
    : `Agregar ${cd.label}`;
  const eyebrow = mode === 'edit'
    ? `Editando · ${cd.label}`
    : `Inventario · nuevo ${cd.label}`;

  if (isMobile) {
    return (
      <MobileSheet open={open} onClose={onClose} title={title} height="full">
        <div className="px-5 pt-4 pb-2">{body}</div>
        <div className="px-5 pt-3 pb-5 border-t border-[var(--color-border-soft)] flex gap-2 sticky bottom-0 bg-[var(--color-surf-sidebar)]">
          {footerSlot}
        </div>
      </MobileSheet>
    );
  }

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      title={title}
      eyebrow={eyebrow}
      width={520}
      footer={footerSlot}
    >
      {body}
    </DetailDrawer>
  );
}

// ─── Purchase Order Form Drawer (Compras) ────────────────────────────────

const PO_STATUS_OPTIONS = [
  { value: 'pendiente',   label: 'Pendiente',  tone: 'warn'     },
  { value: 'en_transito', label: 'En tránsito', tone: 'printing' },
  { value: 'llegado',     label: 'Llegado',    tone: 'done'     },
  { value: 'cancelado',   label: 'Cancelado',  tone: 'danger'   },
];

/**
 * Calcula el total de una orden de compra sumando quantity × unit_cost
 * de todos sus ítems. Backend no persiste un total — se computa siempre.
 *
 * @param {{ items?: Array<{ quantity?: number|string, unit_cost?: number|string }> }} po
 * @returns {number}
 */
function poTotal(po) {
  if (!po || !Array.isArray(po.items)) return 0;
  return po.items.reduce(
    (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_cost) || 0),
    0,
  );
}

function emptyPOForm() {
  return {
    supplier: '',
    carrier: '',
    tracking_number: '',
    estimated_arrival: '',
    status: 'pendiente',
    notes: '',
    items: [
      // 1 línea vacía por defecto
      { name: '', quantity: 1, unit_cost: '', inventory_item_id: null, notes: '' },
    ],
  };
}

function poToForm(raw) {
  return {
    supplier: raw?.supplier || raw?.supplier_name || raw?.vendor || '',
    carrier: raw?.carrier || raw?.tracking_carrier || '',
    tracking_number: raw?.tracking_number || '',
    estimated_arrival: raw?.estimated_arrival
      ? String(raw.estimated_arrival).split('T')[0]
      : '',
    status: raw?.status || 'pendiente',
    notes: raw?.notes || '',
    items: Array.isArray(raw?.items) && raw.items.length > 0
      ? raw.items.map((it) => ({
          name: it.name || '',
          quantity: Number(it.quantity) || 1,
          unit_cost: it.unit_cost != null ? Number(it.unit_cost) : '',
          inventory_item_id: it.inventory_item_id ?? null,
          notes: it.notes || '',
        }))
      : [{ name: '', quantity: 1, unit_cost: '', inventory_item_id: null, notes: '' }],
  };
}

/**
 * Drawer para crear/editar Purchase Orders. Sustituye al wizard externo
 * `/inventory/purchases`. Soporta line items editables (agregar/quitar
 * rows, link opcional a inventory item, subtotal auto-calc).
 *
 * @param {Object} props
 * @param {boolean}              props.open
 * @param {() => void}           props.onClose
 * @param {'create'|'edit'}      [props.mode='create']
 * @param {Object}               [props.initial]
 * @param {(po: Object) => void} [props.onSaved]
 * @param {Array}                [props.inventoryItems]  // pool para link opcional
 * @param {boolean}              props.isMobile
 */
function PurchaseOrderFormDrawer({ open, onClose, mode = 'create', initial, onSaved, inventoryItems = [], isMobile }) {
  const [form, setForm] = useState(emptyPOForm());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    // En modo `edit` siempre usa initial. En modo `create` también acepta
    // un `initial` (prefill) — útil para abrir el form desde "Agregar a
    // compras" del drawer del filamento con la línea ya pre-cargada.
    setForm(initial ? poToForm(initial) : emptyPOForm());
    setErrors({});
  }, [open, mode, initial]);

  if (!open) return null;

  const update = (k, v) => setForm((cur) => ({ ...cur, [k]: v }));

  const updateItem = (idx, k, v) => {
    setForm((cur) => {
      const next = [...cur.items];
      next[idx] = { ...next[idx], [k]: v };
      return { ...cur, items: next };
    });
  };

  const addItem = () => {
    setForm((cur) => ({
      ...cur,
      items: [...cur.items, { name: '', quantity: 1, unit_cost: '', inventory_item_id: null, notes: '' }],
    }));
  };

  const removeItem = (idx) => {
    setForm((cur) => {
      if (cur.items.length <= 1) return cur; // mínimo 1
      return { ...cur, items: cur.items.filter((_, i) => i !== idx) };
    });
  };

  const linkInventoryItem = (idx, inventoryItemId) => {
    const item = inventoryItems.find((i) => i.id === Number(inventoryItemId));
    setForm((cur) => {
      const next = [...cur.items];
      next[idx] = {
        ...next[idx],
        inventory_item_id: inventoryItemId ? Number(inventoryItemId) : null,
        ...(item && {
          name: item.name,
          unit_cost: item.unit_cost ? Number(item.unit_cost) : '',
        }),
      };
      return { ...cur, items: next };
    });
  };

  const total = form.items.reduce(
    (s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_cost) || 0),
    0,
  );

  const validate = () => {
    const next = {};
    if (!form.supplier.trim()) next.supplier = 'Requerido';
    if (form.items.length === 0) next.items = 'Mínimo 1 ítem';
    form.items.forEach((it, i) => {
      if (!it.name.trim()) next[`item_${i}_name`] = 'Requerido';
      const q = Number(it.quantity);
      if (!q || q < 1) next[`item_${i}_qty`] = '≥ 1';
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      // Detectar transición pendiente/en_transito → llegado.
      // Stock se suma vía POST /arrive (endpoint dedicado). PUT con
      // status=llegado NO dispara la lógica de inventario.
      const isLlegadoTransition =
        mode === 'edit'
        && form.status === 'llegado'
        && initial?.status !== 'llegado';

      const payload = {
        supplier: form.supplier.trim(),
        carrier: form.carrier.trim() || null,
        tracking_number: form.tracking_number.trim() || null,
        estimated_arrival: form.estimated_arrival || null,
        notes: form.notes.trim() || null,
        items: form.items.map((it) => ({
          name: it.name.trim(),
          quantity: Number(it.quantity),
          unit_cost: it.unit_cost !== '' ? Number(it.unit_cost) : 0,
          inventory_item_id: it.inventory_item_id || null,
          notes: it.notes?.trim() || null,
        })),
      };
      // Status solo en update (Create siempre arranca en 'pendiente' backend).
      // En transición a llegado lo omitimos del PUT — lo aplica /arrive.
      if (mode === 'edit' && !isLlegadoTransition) payload.status = form.status;

      let res;
      if (mode === 'edit') {
        res = await updatePurchaseOrder(initial.id, payload);
        if (isLlegadoTransition) {
          res = await arrivePurchaseOrder(initial.id);
        }
      } else {
        res = await createPurchaseOrder(payload);
      }
      toast.success(
        isLlegadoTransition
          ? `Orden de ${payload.supplier} marcada como llegada. Stock actualizado.`
          : mode === 'edit'
            ? `Orden de ${payload.supplier} actualizada`
            : `Orden de ${payload.supplier} creada`,
      );
      onSaved?.(res.data);
      onClose?.();
    } catch (err) {
      const msg = err?.response?.data?.detail || 'No se pudo guardar la orden';
      toast.error(typeof msg === 'string' ? msg : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const body = (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] text-gunmetal">
        Los campos marcados con <span className="text-rose-400">*</span> son obligatorios. La orden empieza en estado <span className="text-amber-400">Pendiente</span>; al marcar como <span className="text-emerald-300">Llegado</span> se suma al inventario la cantidad de cada ítem vinculado.
      </p>

      <FormSectionTitle>Proveedor</FormSectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormFieldRow label="Proveedor" required error={errors.supplier}>
          <input
            value={form.supplier}
            onChange={(e) => update('supplier', e.target.value)}
            placeholder="ej. 3D Hardware Colombia"
            className={FORM_INPUT_CLS}
            autoFocus
          />
        </FormFieldRow>
        {mode === 'edit' && (
          <FormFieldRow label="Estado">
            <select
              value={form.status}
              onChange={(e) => update('status', e.target.value)}
              className={FORM_INPUT_CLS}
            >
              {PO_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </FormFieldRow>
        )}
      </div>

      <FormSectionTitle>Envío</FormSectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormFieldRow label="Transportista (carrier)">
          <input
            value={form.carrier}
            onChange={(e) => update('carrier', e.target.value)}
            placeholder="ej. Servientrega, Coordinadora"
            className={FORM_INPUT_CLS}
          />
        </FormFieldRow>
        <FormFieldRow label="Número de tracking">
          <input
            value={form.tracking_number}
            onChange={(e) => update('tracking_number', e.target.value)}
            placeholder="ej. 1234567890"
            className={`${FORM_INPUT_CLS} mono`}
          />
        </FormFieldRow>
        <FormFieldRow label="Fecha estimada de llegada">
          <input
            type="date"
            value={form.estimated_arrival}
            onChange={(e) => update('estimated_arrival', e.target.value)}
            className={`${FORM_INPUT_CLS} mono`}
          />
        </FormFieldRow>
      </div>

      <FormSectionTitle>Ítems del pedido</FormSectionTitle>
      <div className="flex flex-col gap-2">
        {/* Fix #5 (P1 LineItems): cards apiladas <1024 (vínculo full-width,
            cant+costo grid-cols-2, subtotal al pie) / grid minmax(0,fr) ≥1024.
            onRemove condicional para preservar el mínimo de 1 ítem. */}
        <LineItems
          columns={[
            {
              key: 'name', label: 'Nombre', width: '1.7fr',
              render: (it, idx) => (
                <>
                  <input
                    value={it.name}
                    onChange={(e) => updateItem(idx, 'name', e.target.value)}
                    placeholder="ej. Filamento PLA 1kg Negro"
                    className={`${FORM_INPUT_CLS} ${errors[`item_${idx}_name`] ? 'border-rose-400/60' : ''}`}
                  />
                  {errors[`item_${idx}_name`] && (
                    <span className="block mt-0.5 text-[10px] text-rose-400">{errors[`item_${idx}_name`]}</span>
                  )}
                </>
              ),
            },
            {
              key: 'quantity', label: 'Cant.', width: '0.6fr',
              render: (it, idx) => (
                <>
                  <input
                    type="number" min="1" step="1" value={it.quantity}
                    onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                    className={`${FORM_INPUT_CLS} mono text-right ${errors[`item_${idx}_qty`] ? 'border-rose-400/60' : ''}`}
                  />
                  {errors[`item_${idx}_qty`] && (
                    <span className="block mt-0.5 text-[10px] text-rose-400">{errors[`item_${idx}_qty`]}</span>
                  )}
                </>
              ),
            },
            {
              key: 'unit_cost', label: 'Costo unit (COP)', width: '0.9fr',
              render: (it, idx) => (
                <input
                  type="number" min="0" step="100" value={it.unit_cost}
                  onChange={(e) => updateItem(idx, 'unit_cost', e.target.value)}
                  placeholder="ej. 80000"
                  className={`${FORM_INPUT_CLS} mono text-right`}
                />
              ),
            },
            {
              key: 'inventory_item_id', label: 'Vincular a inventario', width: '1.4fr', full: true,
              render: (it, idx) => (
                <select
                  value={it.inventory_item_id || ''}
                  onChange={(e) => linkInventoryItem(idx, e.target.value)}
                  className={FORM_INPUT_CLS}
                >
                  <option value="">— Sin vincular —</option>
                  {inventoryItems.map((inv) => (
                    <option key={inv.id} value={inv.id}>[{inv.category}] {inv.name}</option>
                  ))}
                </select>
              ),
            },
            {
              key: 'subtotal', label: 'Subtotal', width: '0.9fr', mobile: false,
              render: (it) => (
                <span className="mono text-[13px] font-semibold text-tech-white">
                  {fmtCOP((Number(it.quantity) || 0) * (Number(it.unit_cost) || 0))}
                </span>
              ),
            },
          ]}
          items={form.items}
          onRemove={form.items.length > 1 ? (_it, idx) => removeItem(idx) : undefined}
          mobileFoot={(it) => fmtCOP((Number(it.quantity) || 0) * (Number(it.unit_cost) || 0))}
          removeLabel="Eliminar línea"
          minWidth={660}
        />
        <button
          type="button"
          onClick={addItem}
          className="btn btn-sm self-start"
        >
          <Plus size={13} /> Agregar línea
        </button>
        <div className="flex items-baseline justify-between pt-2 border-t border-dashed border-[var(--color-border-soft)]">
          <span className="lbl-eyebrow">Total estimado</span>
          <span className="mono text-base font-semibold text-tech-white">
            {fmtCOP(total)} <span className="text-gunmetal text-[11px]">COP</span>
          </span>
        </div>
      </div>

      <FormSectionTitle>Notas</FormSectionTitle>
      <FormFieldRow label="Observaciones">
        <textarea
          rows={3}
          value={form.notes}
          onChange={(e) => update('notes', e.target.value)}
          placeholder="Términos de pago, urgencia, comentarios…"
          className={`${FORM_INPUT_CLS} resize-y`}
        />
      </FormFieldRow>
    </div>
  );

  const footerSlot = (
    <>
      <button
        type="button"
        onClick={onClose}
        className="btn btn-sm flex-1 justify-center"
        disabled={saving}
      >
        Cancelar
      </button>
      <button
        type="button"
        onClick={submit}
        disabled={saving}
        className="btn btn-primary btn-sm flex-1 justify-center disabled:opacity-50"
      >
        {saving
          ? 'Guardando…'
          : mode === 'edit'
            ? (<><Pencil size={13} /> Guardar cambios</>)
            : (<><Plus size={13} /> Crear orden</>)}
      </button>
    </>
  );

  const title = mode === 'edit'
    ? `PO-${String(initial?.id || '').padStart(4, '0')}`
    : 'Nueva orden de compra';
  const eyebrow = mode === 'edit'
    ? `Editando · ${initial?.supplier || 'orden'}`
    : 'Inventario · nueva PO';

  if (isMobile) {
    return (
      <MobileSheet open={open} onClose={onClose} title={title} height="full">
        <div className="px-5 pt-4 pb-2">{body}</div>
        <div className="px-5 pt-3 pb-5 border-t border-[var(--color-border-soft)] flex gap-2 sticky bottom-0 bg-[var(--color-surf-sidebar)]">
          {footerSlot}
        </div>
      </MobileSheet>
    );
  }

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      title={title}
      eyebrow={eyebrow}
      width={620}
      footer={footerSlot}
    >
      {body}
    </DetailDrawer>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

/**
 * Página principal de inventario.
 *
 * @returns {JSX.Element}
 */
export default function InventoryPage({ section = 'resumen' }) {
  const isMobile = useIsMobile();
  const confirm = useConfirm();
  // El AppLayout expone `openSidebar` para que el header mobile pueda
  // abrir el drawer (replica el `onMenu` del design).
  const { openSidebar } = useOutletContext() || {};
  // Nav consolidada (PR A): la sección viene de la ruta, no de tabs in-page.
  // 'bobinas' mapea a la lista de filamentos; 'resumen' es el overview.
  // Insumos y el tab in-page 'compras' fueron soft-deleteados del frontend.
  const tab = section === 'bobinas' ? 'filamentos' : section;
  const [view, setView] = useState('grid');
  const [query, setQuery] = useState('');
  const [materialFilters, setMaterialFilters] = useState([]);
  const [sort, setSort] = useState('lowFirst');
  const [searchOpen, setSearchOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editingRaw, setEditingRaw] = useState(null);  // raw backend item para edit mode (filamento)
  // Item form drawer (insumo/herramienta/consumible)
  const [itemFormCategory, setItemFormCategory] = useState(null); // null | 'Insumo' | 'Herramienta' | 'Consumible'
  const [itemFormMode, setItemFormMode] = useState('create');     // 'create' | 'edit'
  const [editingItemRaw, setEditingItemRaw] = useState(null);     // raw backend item
  // Purchase Order form drawer (compras)
  const [poFormOpen, setPoFormOpen] = useState(false);
  const [poFormMode, setPoFormMode] = useState('create');
  const [editingPoRaw, setEditingPoRaw] = useState(null);
  // Drawer/sheet state — un slot por tipo para no mezclar bodies.
  const [selected, setSelected] = useState(null);            // filamento
  const [selectedItem, setSelectedItem] = useState(null);    // insumo / herramienta / consumible
  const [selectedPurchase, setSelectedPurchase] = useState(null); // PO

  const [filaments, setFilaments] = useState([]);
  // Mapa id → raw backend item para editar (no perder fields que el mapper
  // descarta, ej. supplier_*, description, filament_density, etc.)
  const [filamentsRawById, setFilamentsRawById] = useState({});
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
        const rawFilaments = all.filter((i) => i.category === 'Filamento');
        setFilaments(rawFilaments.map(mapToFilament));
        setFilamentsRawById(
          Object.fromEntries(rawFilaments.map((i) => [i.id, i])),
        );
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

  /**
   * Eliminar un item de inventario (filamento, insumo, herramienta, consumible).
   * Backend `DELETE /api/inventory/items/{id}`. Cierra el drawer + actualiza
   * el estado local sin re-fetch completo. Issue #80.
   *
   * @param {{ id: number, name?: string, colorName?: string, category?: string }} item
   * @param {'filament' | 'item'} kind - cuál slot del estado actualizar
   */
  const handleDeleteItem = async (item, kind) => {
    if (!item?.id) return;
    const label = item.colorName || item.name || `#${item.id}`;
    const ok = await confirm(`¿Eliminar "${label}"? Esta acción no se puede deshacer.`, 'Eliminar');
    if (!ok) return;
    try {
      await deleteInventoryItem(item.id);
      // Quitar del estado local
      if (kind === 'filament') {
        setFilaments((cur) => cur.filter((f) => f.id !== item.id));
        setFilamentsRawById((cur) => {
          const next = { ...cur };
          delete next[item.id];
          return next;
        });
        setSelected(null);
      } else {
        const cat = item.category;
        if (cat === 'Insumo') setSupplies((cur) => cur.filter((i) => i.id !== item.id));
        else if (cat === 'Herramienta') setTools((cur) => cur.filter((i) => i.id !== item.id));
        else if (cat === 'Consumible') setConsumables((cur) => cur.filter((i) => i.id !== item.id));
        setSelectedItem(null);
      }
      toast.success(`"${label}" eliminado`);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast.error(detail || 'No se pudo eliminar el item');
    }
  };

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
      case 'recent':
        arr.sort(
          (a, b) =>
            new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime(),
        );
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
            (p.supplier || '').toLowerCase().includes(q) ||
            (p.tracking_number || '').toLowerCase().includes(q) ||
            (p.status || '').toLowerCase().includes(q) ||
            String(p.id).includes(q),
        )
      : [...purchases];
    return arr.sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
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

  // ── Nav consolidada: label/conteo de la sección + overview de Resumen ────
  const SECTION_LABELS = {
    resumen: 'Resumen',
    filamentos: 'Bobinas',
    herramientas: 'Herramientas',
    consumibles: 'Consumibles',
  };
  const sectionLabel = SECTION_LABELS[tab] || tab;
  const sectionCount =
    tab === 'resumen'
      ? filaments.length + tools.length + consumables.length
      : counts[tab] ?? 0;

  // Ítems que necesitan atención (stock bajo/crítico) — cruzan categorías.
  const attentionFilaments = useMemo(
    () => filaments.filter((f) => stockLevel(f) !== 'ok'),
    [filaments],
  );
  const attentionItems = useMemo(
    () => [...tools, ...consumables].filter((i) => itemLevel(i) !== 'ok'),
    [tools, consumables],
  );

  // Overview de Resumen: KPIs (arriba) + lo que necesita atención + accesos.
  const ResumenOverview = (
    <div className="px-4 md:px-6 pt-3 pb-24 md:pb-10 flex flex-col gap-6">
      <section>
        <div className="mk-section-title flex items-center gap-2 mb-2.5">
          <AlertTriangle size={13} className="text-amber-400" />
          Necesita atención
          <span className="mono text-[11px] text-gunmetal font-normal">
            {attentionFilaments.length + attentionItems.length}
          </span>
        </div>
        {loading ? (
          <p className="text-sm text-gunmetal py-6 text-center">Cargando…</p>
        ) : attentionFilaments.length === 0 && attentionItems.length === 0 ? (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surf-card)] px-4 py-6 text-center">
            <Check size={20} className="text-emerald-400 mx-auto mb-1.5" />
            <p className="text-sm text-tech-white font-semibold">Todo el stock está OK</p>
            <p className="text-xs text-gunmetal mt-0.5">Ningún ítem bajo el mínimo.</p>
          </div>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
            {attentionFilaments.map((f) => (
              <FilamentCard key={`f-${f.id}`} f={f} onClick={setSelected} />
            ))}
            {attentionItems.map((it) => (
              <InventoryItemCard key={`i-${it.id}`} item={it} onClick={setSelectedItem} />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mk-section-title mb-2.5">Accesos</div>
        <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {[
            { to: '/inventory/bobinas', icon: Droplet, label: 'Bobinas', count: filaments.length },
            { to: '/inventory/herramientas', icon: Scissors, label: 'Herramientas', count: tools.length },
            { to: '/inventory/consumibles', icon: Beaker, label: 'Consumibles', count: consumables.length },
            { to: '/inventory/purchases', icon: ShoppingCart, label: 'Pedidos', count: purchases.length },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.to}
                to={s.to}
                className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surf-card)] px-3.5 py-3 hover:border-[var(--color-border-bright)] transition-colors"
              >
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg shrink-0" style={{ background: 'rgba(59,130,246,.12)', color: '#3B82F6', border: '1px solid rgba(59,130,246,.28)' }}>
                  <Icon size={16} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-tech-white truncate">{s.label}</p>
                  <p className="mono text-[11px] text-gunmetal">{s.count} ítems</p>
                </div>
                <ChevronRight size={15} className="text-gunmetal-dim shrink-0" />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );

  // ── Shell mobile ───────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="flex flex-col">
        <MobileAppHeader
          appName="Inventario"
          appIcon={Box}
          appAccent="#3B82F6"
          title={sectionLabel}
          onMenu={() => openSidebar?.()}
          onSearch={() => setSearchOpen(true)}
        />
        <InventoryNavTabs className="px-4" />
        <MobileSearchOverlay
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          query={query}
          onQuery={setQuery}
        />
        {/* Hero + mini KPIs visibles en TODOS los tabs — son indicadores
            globales del inventario, no específicos del tab filamentos. */}
        <MobileHeroStatus stats={stats} consumption14d={CONSUMPTION_PLACEHOLDER} />
        <MobileMiniKPIs stats={stats} openPOs={openPOs} openPOsValue={openPOsValue} />
        {tab === 'resumen' ? (
          ResumenOverview
        ) : tab === 'filamentos' ? (
          <>
            <MobileChips materialFilters={materialFilters} onToggleMat={toggleMat} />
            <div className="flex items-center justify-between px-4 mt-2 mb-1">
              <span className="mono text-[11px] text-gunmetal">
                {filteredFilaments.length} de {filaments.length} spools
              </span>
              {materialFilters.length > 0 && (
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
              <EmptyState
                icon={filaments.length === 0 ? Droplet : Search}
                accent="#3B82F6"
                title={filaments.length === 0 ? 'Sin filamentos aún' : 'Sin resultados'}
                hint={
                  filaments.length === 0
                    ? 'Toca el botón + para agregar el primer filamento.'
                    : 'Ajusta los filtros o limpia la búsqueda.'
                }
              />
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
                    <ul className="px-4 flex flex-col gap-2">
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
        ) : (
          <>
            <div className="flex items-center justify-between px-4 mt-2 mb-1">
              <span className="mono text-[11px] text-gunmetal">
                {tab === 'herramientas'
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
                  <EmptyState
                    icon={Icon}
                    accent={meta.color}
                    title={rawList.length === 0 ? `Sin ${tab} aún` : 'Sin resultados'}
                  />
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

        {tab !== 'resumen' && (
          <MobileFAB
            onClick={() => {
              if (tab === 'filamentos') {
                setAddOpen(true);
                return;
              }
              // Herramienta / Consumible → ItemFormDrawer
              const catMap = {
                herramientas: 'Herramienta',
                consumibles: 'Consumible',
              };
              const cat = catMap[tab];
              if (cat) {
                setItemFormCategory(cat);
                setItemFormMode('create');
                setEditingItemRaw(null);
              }
            }}
          />
        )}

        <MobileSheet
          open={!!selected}
          onClose={() => setSelected(null)}
          title={selected?.colorName}
          height="full"
          onEdit={
            selected
              ? () => {
                  const raw = filamentsRawById[selected.id];
                  if (raw) {
                    setEditingRaw(raw);
                    setSelected(null);
                  } else {
                    toast.error('No se encontró el item en el cache local');
                  }
                }
              : undefined
          }
        >
          <FilamentDrawerBody
            f={selected}
            onReassign={() => toast('Reasignar batch llega pronto.')}
            onAddToPurchase={(filament) => {
              // Pre-fill PO form con el filamento como línea, vinculado
              const raw = filamentsRawById[filament.id];
              setEditingPoRaw({
                supplier: raw?.supplier_name || raw?.filament_brand || '',
                items: [{
                  name: raw?.name || filament.colorName,
                  quantity: 1,
                  unit_cost: raw?.price_per_kg || '',
                  inventory_item_id: filament.id,
                }],
              });
              setPoFormMode('create');
              setPoFormOpen(true);
              setSelected(null);
            }}
            onDelete={(filament) => handleDeleteItem(filament, 'filament')}
          />
        </MobileSheet>
        <MobileSheet
          open={!!selectedItem}
          onClose={() => setSelectedItem(null)}
          title={selectedItem?.name}
          height="full"
          onEdit={
            selectedItem
              ? () => {
                  setEditingItemRaw(selectedItem);
                  setItemFormCategory(selectedItem.category);
                  setItemFormMode('edit');
                  setSelectedItem(null);
                }
              : undefined
          }
        >
          <InventoryItemDrawerBody item={selectedItem} onDelete={(it) => handleDeleteItem(it, 'item')} />
        </MobileSheet>
        <MobileSheet
          open={!!selectedPurchase}
          onClose={() => setSelectedPurchase(null)}
          title={selectedPurchase ? `PO-${String(selectedPurchase.id).padStart(4, '0')}` : ''}
          height="full"
          onEdit={
            selectedPurchase
              ? () => {
                  setEditingPoRaw(selectedPurchase);
                  setPoFormMode('edit');
                  setPoFormOpen(true);
                  setSelectedPurchase(null);
                }
              : undefined
          }
        >
          <PurchaseDrawerBody po={selectedPurchase} />
        </MobileSheet>

        <FilamentFormDrawer
          open={addOpen || !!editingRaw}
          onClose={() => {
            setAddOpen(false);
            setEditingRaw(null);
          }}
          mode={editingRaw ? 'edit' : 'create'}
          initial={editingRaw}
          isMobile={isMobile}
          onSaved={(item) => {
            if (item?.category !== 'Filamento') return;
            setFilamentsRawById((cur) => ({ ...cur, [item.id]: item }));
            setFilaments((cur) => {
              const mapped = mapToFilament(item);
              const idx = cur.findIndex((f) => f.id === item.id);
              if (idx === -1) return [mapped, ...cur];
              const next = [...cur];
              next[idx] = mapped;
              return next;
            });
          }}
        />

        <ItemFormDrawer
          open={!!itemFormCategory}
          onClose={() => {
            setItemFormCategory(null);
            setEditingItemRaw(null);
          }}
          category={itemFormCategory || 'Insumo'}
          mode={itemFormMode}
          initial={editingItemRaw}
          isMobile={isMobile}
          onSaved={(item) => {
            const upsert = (list, setList) => setList((cur) => {
              const idx = cur.findIndex((x) => x.id === item.id);
              if (idx === -1) return [item, ...cur];
              const next = [...cur];
              next[idx] = item;
              return next;
            });
            if (item?.category === 'Insumo') upsert(supplies, setSupplies);
            else if (item?.category === 'Herramienta') upsert(tools, setTools);
            else if (item?.category === 'Consumible') upsert(consumables, setConsumables);
          }}
        />

        <PurchaseOrderFormDrawer
          open={poFormOpen}
          onClose={() => {
            setPoFormOpen(false);
            setEditingPoRaw(null);
          }}
          mode={poFormMode}
          initial={editingPoRaw}
          isMobile={isMobile}
          inventoryItems={[
            ...filaments.map((f) => filamentsRawById[f.id]).filter(Boolean),
            ...supplies, ...tools, ...consumables,
          ]}
          onSaved={(po) => {
            setPurchases((cur) => {
              const idx = cur.findIndex((p) => p.id === po.id);
              if (idx === -1) return [po, ...cur];
              const next = [...cur];
              next[idx] = po;
              return next;
            });
          }}
        />
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
          <span className="text-sm font-semibold text-tech-white whitespace-nowrap">
            {sectionLabel}
          </span>
          <span className="mono text-[10px] px-1.5 py-0.5 rounded-sm bg-white/6 border border-[var(--color-border)] text-steel tracking-wider whitespace-nowrap shrink-0 ml-1">
            {sectionCount} ítems
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
          {tab !== 'resumen' && (
            <button
              type="button"
              onClick={() => {
                if (tab === 'filamentos') {
                  setAddOpen(true);
                  return;
                }
                const catMap = {
                  herramientas: 'Herramienta',
                  consumibles: 'Consumible',
                };
                const cat = catMap[tab];
                if (cat) {
                  setItemFormCategory(cat);
                  setItemFormMode('create');
                  setEditingItemRaw(null);
                }
              }}
              className="btn btn-primary btn-sm"
            >
              <Plus size={13} /> Agregar
            </button>
          )}
        </div>
      </header>

      <InventoryNavTabs className="px-6 border-b border-[var(--color-border)]" />

      <KPIStrip stats={stats} openPOs={openPOs} openPOsValue={openPOsValue} />

      {tab === 'resumen' ? (
        ResumenOverview
      ) : tab === 'filamentos' ? (
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
            <EmptyState
              icon={filaments.length === 0 ? Droplet : Search}
              accent="#3B82F6"
              title={filaments.length === 0 ? 'Sin filamentos aún' : 'Sin resultados'}
              hint={
                filaments.length === 0
                  ? 'Agrega un filamento para empezar a usarlo en la calculadora y la cola.'
                  : 'Ajusta los filtros o limpia la búsqueda para ver todos los spools.'
              }
              action={
                filaments.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => setAddOpen(true)}
                    className="btn btn-primary btn-sm"
                  >
                    <Plus size={13} /> Agregar primer filamento
                  </button>
                ) : null
              }
            />
          ) : view === 'grid' ? (
            <FilamentGrid groups={groups} onCardClick={setSelected} />
          ) : (
            <FilamentTable items={filteredFilaments} onRowClick={setSelected} />
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
                  <EmptyState
                    icon={Icon}
                    accent={meta.color}
                    title={rawList.length === 0 ? `Sin ${tab} aún` : 'Sin resultados'}
                    hint={
                      rawList.length === 0
                        ? `Agrega tu primer ítem en la categoría ${meta.label.toLowerCase()}.`
                        : 'Ajusta la búsqueda o el sort.'
                    }
                    action={
                      rawList.length === 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            const catMap = {
                              insumos: 'Insumo',
                              herramientas: 'Herramienta',
                              consumibles: 'Consumible',
                            };
                            const cat = catMap[tab];
                            if (cat) {
                              setItemFormCategory(cat);
                              setItemFormMode('create');
                              setEditingItemRaw(null);
                            }
                          }}
                          className="btn btn-primary btn-sm"
                        >
                          <Plus size={13} /> Agregar primer ítem
                        </button>
                      ) : null
                    }
                  />
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
        eyebrow={selected?.rawId}
        title={selected?.colorName || ''}
        width={460}
        onEdit={
          selected
            ? () => {
                const raw = filamentsRawById[selected.id];
                if (raw) {
                  setEditingRaw(raw);
                  setSelected(null);
                } else {
                  toast.error('No se encontró el item en el cache local');
                }
              }
            : undefined
        }
      >
        <FilamentDrawerBody
          f={selected}
          onReassign={() => toast('Reasignar batch llega pronto.')}
          onAddToPurchase={(filament) => {
            const raw = filamentsRawById[filament.id];
            setEditingPoRaw({
              supplier: raw?.supplier_name || raw?.filament_brand || '',
              items: [{
                name: raw?.name || filament.colorName,
                quantity: 1,
                unit_cost: raw?.price_per_kg || '',
                inventory_item_id: filament.id,
              }],
            });
            setPoFormMode('create');
            setPoFormOpen(true);
            setSelected(null);
          }}
          onDelete={(filament) => handleDeleteItem(filament, 'filament')}
        />
      </DetailDrawer>
      <DetailDrawer
        open={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        title={selectedItem?.name || ''}
        width={460}
        onEdit={
          selectedItem
            ? () => {
                setEditingItemRaw(selectedItem);
                setItemFormCategory(selectedItem.category);
                setItemFormMode('edit');
                setSelectedItem(null);
              }
            : undefined
        }
      >
        <InventoryItemDrawerBody item={selectedItem} onDelete={(it) => handleDeleteItem(it, 'item')} />
      </DetailDrawer>
      <DetailDrawer
        open={!!selectedPurchase}
        onClose={() => setSelectedPurchase(null)}
        title={selectedPurchase ? `PO-${String(selectedPurchase.id).padStart(4, '0')}` : ''}
        width={460}
        onEdit={
          selectedPurchase
            ? () => {
                setEditingPoRaw(selectedPurchase);
                setPoFormMode('edit');
                setPoFormOpen(true);
                setSelectedPurchase(null);
              }
            : undefined
        }
      >
        <PurchaseDrawerBody po={selectedPurchase} />
      </DetailDrawer>

      <FilamentFormDrawer
        open={addOpen || !!editingRaw}
        onClose={() => {
          setAddOpen(false);
          setEditingRaw(null);
        }}
        mode={editingRaw ? 'edit' : 'create'}
        initial={editingRaw}
        isMobile={isMobile}
        onSaved={(item) => {
          if (item?.category !== 'Filamento') return;
          // Cache raw + actualizar/insertar mapped en la lista.
          setFilamentsRawById((cur) => ({ ...cur, [item.id]: item }));
          setFilaments((cur) => {
            const mapped = mapToFilament(item);
            const idx = cur.findIndex((f) => f.id === item.id);
            if (idx === -1) return [mapped, ...cur];
            const next = [...cur];
            next[idx] = mapped;
            return next;
          });
        }}
      />

      <ItemFormDrawer
        open={!!itemFormCategory}
        onClose={() => {
          setItemFormCategory(null);
          setEditingItemRaw(null);
        }}
        category={itemFormCategory || 'Insumo'}
        mode={itemFormMode}
        initial={editingItemRaw}
        isMobile={isMobile}
        onSaved={(item) => {
          const upsert = (list, setList) => setList((cur) => {
            const idx = cur.findIndex((x) => x.id === item.id);
            if (idx === -1) return [item, ...cur];
            const next = [...cur];
            next[idx] = item;
            return next;
          });
          if (item?.category === 'Insumo') upsert(supplies, setSupplies);
          else if (item?.category === 'Herramienta') upsert(tools, setTools);
          else if (item?.category === 'Consumible') upsert(consumables, setConsumables);
        }}
      />

      <PurchaseOrderFormDrawer
        open={poFormOpen}
        onClose={() => {
          setPoFormOpen(false);
          setEditingPoRaw(null);
        }}
        mode={poFormMode}
        initial={editingPoRaw}
        isMobile={isMobile}
        inventoryItems={[
          ...filaments.map((f) => filamentsRawById[f.id]).filter(Boolean),
          ...supplies, ...tools, ...consumables,
        ]}
        onSaved={(po) => {
          setPurchases((cur) => {
            const idx = cur.findIndex((p) => p.id === po.id);
            if (idx === -1) return [po, ...cur];
            const next = [...cur];
            next[idx] = po;
            return next;
          });
        }}
      />

      <footer className="mt-auto px-6 py-2.5 border-t border-[var(--color-border-soft)] bg-[var(--color-surf-sidebar)] flex flex-wrap items-center gap-4 text-[11px] text-gunmetal">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px #34D39966' }} />
          <span className="mono">CONECTADO</span>
        </span>
        <span className="w-px h-3 bg-[var(--color-border)]" />
        <span className="mono">{filaments.length} spools</span>
        <span className="mono">{(stats.totalGrams / 1000).toFixed(2)} kg</span>
        <span className="mono">{fmtUSD(stats.totalValue)}</span>
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
