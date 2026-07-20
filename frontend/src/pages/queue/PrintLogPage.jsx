/**
 * @file Bitácora global de impresiones (issue #131) — tabla cronológica
 * de TODA la actividad de la cola (pending/printing/done/cancelled), con
 * filtros server-side, paginación y export CSV.
 *
 * A diferencia del tab "Historial" de QueuePage (solo done/cancelled,
 * sin filtros), esta página trae `GET /api/queue/log` — endpoint nuevo,
 * separado, para no romper el contrato del tab existente.
 *
 * @module pages/queue/PrintLogPage
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Download,
  ScrollText,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  AppTabs,
  Button,
  EmptyState,
  MobileSheet,
  ResponsiveTable,
  StatusPill,
} from '../../components/ui';
import MobileAppHeader from '../../components/MobileAppHeader';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useAuth } from '../../context/AuthContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { downloadPrintLogCsv, getPrintLog, getPrinters, getUsers } from '../../services/api';
import { ACCENT, QUEUE_TABS, fmtDate, fmtTimeHours, itemView, statusBadge } from './queueHelpers';

const PAGE_SIZE_KEY = 'cfs-printlog-pagesize';
const PAGE_SIZE_OPTIONS = [25, 50, 100];

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'printing', label: 'Imprimiendo' },
  { value: 'done', label: 'Listo' },
  { value: 'cancelled', label: 'Cancelado' },
];

const DATE_PRESETS = ['Hoy', 'Semana', 'Mes', 'Todo'];

function localISODate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function presetToRange(preset) {
  const today = new Date();
  if (preset === 'Todo') return { date_from: '', date_to: '' };
  if (preset === 'Hoy') {
    const iso = localISODate(today);
    return { date_from: iso, date_to: iso };
  }
  const days = preset === 'Semana' ? 6 : 29;
  const from = new Date(today);
  from.setDate(from.getDate() - days);
  return { date_from: localISODate(from), date_to: localISODate(today) };
}

function readPersistedPageSize() {
  const raw = Number(localStorage.getItem(PAGE_SIZE_KEY));
  return PAGE_SIZE_OPTIONS.includes(raw) ? raw : 25;
}

export default function PrintLogPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { openSidebar } = useOutletContext() || {};
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // AppTabs fusiona Bitácora con los tabs internos de QueuePage (#181):
  // click en cualquier otro id navega de vuelta a /queue con ese tab activo.
  const handleTabChange = (id) => {
    if (id === 'bitacora') return;
    navigate('/queue', { state: { tab: id } });
  };

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 350);
  const [printerId, setPrinterId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [userId, setUserId] = useState('');
  const [activePreset, setActivePreset] = useState('Todo');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [printers, setPrinters] = useState([]);
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(readPersistedPageSize);
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    getPrinters()
      .then((res) => setPrinters(res.data || []))
      .catch(() => {});
    if (isAdmin) {
      getUsers()
        .then((res) => setUsers(res.data || []))
        .catch(() => {});
    }
  }, [isAdmin]);

  const filters = useMemo(
    () => ({
      q: debouncedQuery.trim() || undefined,
      printer_id: printerId || undefined,
      status: statusFilter || undefined,
      user_id: isAdmin ? userId || undefined : undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    }),
    [debouncedQuery, printerId, statusFilter, userId, dateFrom, dateTo, isAdmin],
  );

  // Cualquier cambio de filtro vuelve a página 1 (evita quedar en una
  // página vacía si el nuevo filtro trae menos resultados).
  useEffect(() => {
    setPage(1);
  }, [filters]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getPrintLog({ ...filters, page, page_size: pageSize })
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch(() => {
        if (!cancelled) toast.error('No se pudo cargar la bitácora');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters, page, pageSize]);

  const handlePageSizeChange = (value) => {
    const n = Number(value);
    setPageSize(n);
    setPage(1);
    localStorage.setItem(PAGE_SIZE_KEY, String(n));
  };

  const handlePreset = (preset) => {
    setActivePreset(preset);
    const range = presetToRange(preset);
    setDateFrom(range.date_from);
    setDateTo(range.date_to);
  };

  // Nº de filtros activos → badge del botón "Filtros" en mobile.
  const activeFilterCount =
    (debouncedQuery.trim() ? 1 : 0) +
    (printerId ? 1 : 0) +
    (statusFilter ? 1 : 0) +
    (userId ? 1 : 0) +
    (activePreset !== 'Todo' ? 1 : 0);

  const handleClearFilters = () => {
    setQuery('');
    setPrinterId('');
    setStatusFilter('');
    setUserId('');
    handlePreset('Todo');
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      await downloadPrintLogCsv(filters);
    } catch {
      toast.error('No se pudo exportar el CSV');
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));
  const rangeStart = data.total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, data.total);

  const Filters = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-2 bg-[var(--color-surf-card)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-1.5 min-w-[200px] flex-1 max-w-sm">
          <Search size={13} className="text-gunmetal" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar pieza…"
            className="flex-1 bg-transparent border-0 outline-0 text-tech-white text-sm placeholder:text-gunmetal-dim"
          />
        </div>
        <select
          value={printerId}
          onChange={(e) => setPrinterId(e.target.value)}
          className="bg-[var(--color-surf-card)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-1.5 text-tech-white text-sm focus:outline-none focus:border-teal-500"
        >
          <option value="">Todas las impresoras</option>
          {printers.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[var(--color-surf-card)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-1.5 text-tech-white text-sm focus:outline-none focus:border-teal-500"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        {isAdmin && users.length > 0 && (
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="bg-[var(--color-surf-card)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-1.5 text-tech-white text-sm focus:outline-none focus:border-teal-500"
          >
            <option value="">Todos los usuarios</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.username}</option>
            ))}
          </select>
        )}
        <Button
          variant="ghost"
          size="sm"
          icon={Download}
          onClick={handleExportCsv}
          disabled={exporting}
        >
          {exporting ? 'Exportando…' : 'Exportar CSV'}
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5 items-center">
        <CalendarClock size={13} className="text-gunmetal shrink-0" />
        {DATE_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => handlePreset(preset)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              activePreset === preset
                ? 'bg-teal-500/15 border-teal-500/40 text-teal-300'
                : 'bg-transparent border-[var(--color-border)] text-steel hover:text-tech-white'
            }`}
          >
            {preset}
          </button>
        ))}
        {activePreset !== 'Todo' && dateFrom && dateTo && (
          <span className="mono text-[10.5px] text-gunmetal">
            {dateFrom} → {dateTo}
          </span>
        )}
      </div>
    </div>
  );

  // Columnas del ResponsiveTable (P2). Desktop: tabla como hoy. Mobile: la
  // card la controla `mobileCard` (línea secundaria origen/usuario/cant. +
  // grid de 4 pares), según mockup `queue-printlog.html`.
  const gramsOf = (v) => (v.weight_grams != null ? `${Number(v.weight_grams).toFixed(0)}g` : '—');
  const columns = [
    { key: 'date', label: 'Fecha', className: 'mono text-[11px]', render: (it) => fmtDate(it.created_at) },
    {
      key: 'piece',
      label: 'Pieza',
      strong: true,
      className: 'max-w-[220px] truncate',
      render: (it) => itemView(it).piece_name || it.notes || `Item #${it.id}`,
    },
    { key: 'source', label: 'Origen', className: 'capitalize', render: (it) => itemView(it).source },
    { key: 'printer', label: 'Impresora', render: (it) => itemView(it).printer_name || '—' },
    { key: 'user', label: 'Usuario', render: (it) => it.created_by_username || '—' },
    {
      key: 'status',
      label: 'Estado',
      render: (it) => {
        const badge = statusBadge(it.status);
        return <StatusPill tone={badge.tone} icon={badge.icon}>{badge.label}</StatusPill>;
      },
    },
    { key: 'quantity', label: 'Cant.', className: 'text-right mono', render: (it) => itemView(it).quantity ?? 1 },
    { key: 'duration', label: 'Duración', className: 'text-right mono', render: (it) => fmtTimeHours(itemView(it).print_time_hours) },
    { key: 'filament', label: 'Filamento', className: 'text-right mono', render: (it) => gramsOf(itemView(it)) },
  ];

  const pair = (label, value, mono) => (
    <div>
      <div className="mono text-[8.5px] font-bold uppercase tracking-[0.08em] text-gunmetal mb-0.5">{label}</div>
      <div className={`text-[12.5px] font-semibold text-tech-white ${mono ? 'mono' : ''}`}>{value}</div>
    </div>
  );

  const mobileCard = (it) => {
    const v = itemView(it);
    const badge = statusBadge(it.status);
    return (
      <div className="bg-[var(--color-surf-card)] border border-[var(--color-border)] rounded-xl px-3.5 py-3.5 mb-2.5">
        <div className="flex items-start justify-between gap-2.5 mb-1">
          <div className="text-[14.5px] font-bold text-tech-white leading-snug min-w-0 flex-1">
            {v.piece_name || it.notes || `Item #${it.id}`}
          </div>
          <StatusPill tone={badge.tone} icon={badge.icon}>{badge.label}</StatusPill>
        </div>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[11px] text-gunmetal mb-2.5">
          <span className="capitalize">{v.source}</span>
          <span className="text-[var(--color-border-bright)]">·</span>
          <span>{it.created_by_username || '—'}</span>
          <span className="text-[var(--color-border-bright)]">·</span>
          <span>cant. {v.quantity ?? 1}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 pt-2.5 border-t border-dashed border-[var(--color-border-soft)]">
          {pair('Fecha', fmtDate(it.created_at), true)}
          {pair('Impresora', v.printer_name || '—', false)}
          {pair('Duración', fmtTimeHours(v.print_time_hours), true)}
          {pair('Filamento', gramsOf(v), true)}
        </div>
      </div>
    );
  };

  const emptyState = !loading && (
    <EmptyState
      icon={ScrollText}
      accent={ACCENT}
      title="Sin resultados"
      hint="Ajusta los filtros o el rango de fechas."
    />
  );

  const Table = (
    <ResponsiveTable
      columns={columns}
      rows={data.items}
      rowKey={(it) => it.id}
      mobileCard={mobileCard}
      minWidth={920}
      empty={data.items.length === 0 ? emptyState : null}
    />
  );

  const Pagination = data.total > 0 && (
    <div className="flex flex-wrap items-center gap-3 justify-between">
      <span className="mono text-[11px] text-gunmetal">
        {rangeStart}-{rangeEnd} de {data.total}
      </span>
      <div className="flex items-center gap-2">
        <select
          value={pageSize}
          onChange={(e) => handlePageSizeChange(e.target.value)}
          className="bg-[var(--color-surf-card)] border border-[var(--color-border-strong)] rounded-md px-2 py-1 text-tech-white text-xs focus:outline-none"
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>{n} / página</option>
          ))}
        </select>
        <Button
          variant="ghost"
          size="sm"
          icon={ChevronLeft}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          aria-label="Página anterior"
        />
        <span className="mono text-xs text-steel">{page} / {totalPages}</span>
        <Button
          variant="ghost"
          size="sm"
          icon={ChevronRight}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          aria-label="Página siguiente"
        />
      </div>
    </div>
  );

  // Botón que abre el sheet de filtros en mobile (los 4 filtros + presets
  // no caben en una fila sin apilar 4 líneas). Badge = nº de filtros activos.
  const FiltersTrigger = (
    <button
      type="button"
      onClick={() => setFiltersOpen(true)}
      className="flex items-center justify-between gap-2.5 w-full px-3.5 py-2.5 rounded-[10px] bg-[var(--color-surf-card)] border border-[var(--color-border-strong)] text-tech-white text-[13.5px] font-semibold min-h-[44px]"
    >
      <span className="inline-flex items-center gap-2">
        <SlidersHorizontal size={14} /> Filtros
      </span>
      {activeFilterCount > 0 && (
        <span className="mono text-[10.5px] font-bold bg-teal-500/[0.16] text-teal-300 rounded-full px-2 py-0.5">
          {activeFilterCount} activo{activeFilterCount > 1 ? 's' : ''}
        </span>
      )}
    </button>
  );

  const sheetSelectCls =
    'w-full px-3 py-2.5 rounded-[9px] bg-[var(--color-surf-card-2)] border border-[var(--color-border)] text-tech-white text-sm outline-none min-h-[44px] focus:border-teal-500';
  const sheetLabelCls =
    'mono text-[9.5px] font-bold uppercase tracking-[0.1em] text-gunmetal mb-1.5';

  const FilterSheet = (
    <MobileSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filtros">
      <div className="px-4 pt-3 pb-6">
        <div className="mb-3.5">
          <div className={sheetLabelCls}>Buscar pieza</div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nombre de la pieza…"
            className={sheetSelectCls}
          />
        </div>
        <div className="mb-3.5">
          <div className={sheetLabelCls}>Impresora</div>
          <select value={printerId} onChange={(e) => setPrinterId(e.target.value)} className={sheetSelectCls}>
            <option value="">Todas las impresoras</option>
            {printers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="mb-3.5">
          <div className={sheetLabelCls}>Estado</div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={sheetSelectCls}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        {isAdmin && users.length > 0 && (
          <div className="mb-3.5">
            <div className={sheetLabelCls}>Usuario</div>
            <select value={userId} onChange={(e) => setUserId(e.target.value)} className={sheetSelectCls}>
              <option value="">Todos los usuarios</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.username}</option>
              ))}
            </select>
          </div>
        )}
        <div className="mb-3.5">
          <div className={sheetLabelCls}>Rango de fechas</div>
          <div className="flex flex-wrap gap-2">
            {DATE_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handlePreset(preset)}
                className={`px-3.5 py-2 rounded-full text-[13px] font-semibold border transition-colors min-h-[40px] ${
                  activePreset === preset
                    ? 'bg-teal-500/15 border-teal-500/40 text-teal-300'
                    : 'bg-transparent border-[var(--color-border)] text-steel'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2.5 mt-4">
          <Button variant="ghost" className="flex-1" onClick={handleClearFilters}>
            Limpiar
          </Button>
          <Button variant="primary" className="flex-[2]" onClick={() => setFiltersOpen(false)}>
            Aplicar filtros
          </Button>
        </div>
      </div>
    </MobileSheet>
  );

  if (isMobile) {
    return (
      <div className="flex flex-col gap-3">
        <MobileAppHeader
          appName="Bitácora"
          appIcon={ScrollText}
          appAccent={ACCENT}
          title="Bitácora"
          onMenu={() => openSidebar?.()}
        />
        <AppTabs
          items={QUEUE_TABS}
          value="bitacora"
          onChange={handleTabChange}
          accent={ACCENT}
          className="px-4"
        />
        <div className="px-4">{FiltersTrigger}</div>
        <div className="px-4">
          {loading ? (
            <p className="py-12 text-center text-gunmetal text-sm">Cargando…</p>
          ) : (
            Table
          )}
        </div>
        <div className="px-4 pb-6">{Pagination}</div>
        {FilterSheet}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <header className="flex items-center gap-2">
        <span
          className="inline-flex items-center justify-center w-6 h-6 rounded-md shrink-0"
          style={{ background: `${ACCENT}1F`, color: ACCENT, border: `1px solid ${ACCENT}40` }}
        >
          <ScrollText size={13} />
        </span>
        <span className="text-sm text-gunmetal">Queue</span>
        <span className="text-gunmetal-dim">›</span>
        <span className="text-sm font-semibold text-tech-white">Bitácora</span>
      </header>
      <AppTabs
        items={QUEUE_TABS}
        value="bitacora"
        onChange={handleTabChange}
        accent={ACCENT}
      />
      {Filters}
      {loading ? (
        <p className="py-16 text-center text-gunmetal text-sm">Cargando bitácora…</p>
      ) : (
        Table
      )}
      {Pagination}
    </div>
  );
}
