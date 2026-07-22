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
  EmptyState,
  MobileSheet,
  StatusPill,
} from '../../components/ui';
import MobileAppHeader from '../../components/MobileAppHeader';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useAuth } from '../../context/AuthContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { downloadPrintLogCsv, getPrintLog, getPrinters, getUsers } from '../../services/api';
import { ACCENT, QUEUE_TABS, fmtDate, fmtTimeHours, itemView, statusBadge } from './queueHelpers';
import './PrintLogPage.css';

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

  const gramsOf = (v) => (v.weight_grams != null ? `${Number(v.weight_grams).toFixed(0)}g` : '—');
  const rows = data.items;
  const titleOf = (it) => itemView(it).piece_name || it.notes || `Item #${it.id}`;

  const DesktopFilters = (
    <div className="mk-filters-desktop">
      <div className="mk-filter-row">
        <div className="mk-search-box">
          <Search size={14} style={{ color: 'var(--cfs-text-tertiary)' }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar pieza…" />
        </div>
        <select className="mk-filter-select" value={printerId} onChange={(e) => setPrinterId(e.target.value)}>
          <option value="">Todas las impresoras</option>
          {printers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="mk-filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {isAdmin && users.length > 0 && (
          <select className="mk-filter-select" value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">Todos los usuarios</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.username}</option>)}
          </select>
        )}
        <button type="button" className="mk-btn mk-btn-secondary" onClick={handleExportCsv} disabled={exporting}>
          <Download size={14} /> {exporting ? 'Exportando…' : 'Exportar CSV'}
        </button>
      </div>
      <div className="mk-filter-presets">
        <CalendarClock size={14} style={{ color: 'var(--cfs-text-tertiary)' }} />
        {DATE_PRESETS.map((preset) => (
          <button key={preset} type="button" className={`mk-preset-pill ${activePreset === preset ? 'active' : ''}`} onClick={() => handlePreset(preset)}>
            {preset}
          </button>
        ))}
        {activePreset !== 'Todo' && dateFrom && dateTo && (
          <span className="mk-preset-range">{dateFrom} → {dateTo}</span>
        )}
      </div>
    </div>
  );

  const MobileFilterTrigger = (
    <div className="mk-filters-mobile-trigger">
      <button type="button" className="mk-filter-trigger-btn" onClick={() => setFiltersOpen(true)}>
        <span className="inline-flex items-center gap-2"><SlidersHorizontal size={15} /> Filtros</span>
        {activeFilterCount > 0 && (
          <span className="badge-count">{activeFilterCount} activo{activeFilterCount > 1 ? 's' : ''}</span>
        )}
      </button>
    </div>
  );

  const DesktopTable = (
    <div className="mk-table-card">
      <div className="mk-table-scroll">
        <table className="mk-log-table">
          <thead>
            <tr>
              <th>Fecha</th><th>Pieza</th><th>Origen</th><th>Impresora</th><th>Usuario</th><th>Estado</th>
              <th className="num">Cant.</th><th className="num">Duración</th><th className="num">Filamento</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((it) => {
              const v = itemView(it);
              const badge = statusBadge(it.status);
              return (
                <tr key={it.id}>
                  <td className="date">{fmtDate(it.created_at)}</td>
                  <td className="piece truncate">{titleOf(it)}</td>
                  <td className="capitalize">{v.source}</td>
                  <td>{v.printer_name || '—'}</td>
                  <td>{it.created_by_username || '—'}</td>
                  <td><StatusPill tone={badge.tone} icon={badge.icon}>{badge.label}</StatusPill></td>
                  <td className="num">{v.quantity ?? 1}</td>
                  <td className="num">{fmtTimeHours(v.print_time_hours)}</td>
                  <td className="num">{gramsOf(v)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  const MobileCards = (
    <div className="mk-log-cards">
      {rows.map((it) => {
        const v = itemView(it);
        const badge = statusBadge(it.status);
        return (
          <div key={it.id} className="mk-log-card">
            <div className="mk-log-card-top">
              <div className="mk-log-card-title truncate">{titleOf(it)}</div>
              <StatusPill tone={badge.tone} icon={badge.icon}>{badge.label}</StatusPill>
            </div>
            <div className="mk-log-card-secondary">
              <span className="capitalize">{v.source}</span><span className="sep">·</span>
              <span>{it.created_by_username || '—'}</span><span className="sep">·</span>
              <span>cant. {v.quantity ?? 1}</span>
            </div>
            <div className="mk-log-card-grid">
              <div><div className="mk-log-pair-label">Fecha</div><div className="mk-log-pair-value mono">{fmtDate(it.created_at)}</div></div>
              <div><div className="mk-log-pair-label">Impresora</div><div className="mk-log-pair-value">{v.printer_name || '—'}</div></div>
              <div><div className="mk-log-pair-label">Duración</div><div className="mk-log-pair-value mono">{fmtTimeHours(v.print_time_hours)}</div></div>
              <div><div className="mk-log-pair-label">Filamento</div><div className="mk-log-pair-value mono">{gramsOf(v)}</div></div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const Pagination = data.total > 0 && (
    <div className="mk-pagination-row">
      <span className="mk-pagination-count">{rangeStart}-{rangeEnd} de {data.total}</span>
      <div className="mk-pagination-controls">
        <select className="mk-page-size-select" value={pageSize} onChange={(e) => handlePageSizeChange(e.target.value)}>
          {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n} / página</option>)}
        </select>
        <button type="button" className="mk-page-btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} aria-label="Página anterior">
          <ChevronLeft size={16} />
        </button>
        <span className="mk-page-indicator">{page} / {totalPages}</span>
        <button type="button" className="mk-page-btn" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} aria-label="Página siguiente">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );

  const FilterSheet = (
    <MobileSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filtros">
      <div className="px-4 pt-2 pb-6">
        <div className="mk-sheet-field">
          <div className="mk-sheet-field-label">Buscar pieza</div>
          <input className="mk-sheet-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nombre de la pieza…" />
        </div>
        <div className="mk-sheet-field">
          <div className="mk-sheet-field-label">Impresora</div>
          <select className="mk-sheet-select" value={printerId} onChange={(e) => setPrinterId(e.target.value)}>
            <option value="">Todas las impresoras</option>
            {printers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="mk-sheet-field">
          <div className="mk-sheet-field-label">Estado</div>
          <select className="mk-sheet-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        {isAdmin && users.length > 0 && (
          <div className="mk-sheet-field">
            <div className="mk-sheet-field-label">Usuario</div>
            <select className="mk-sheet-select" value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Todos los usuarios</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.username}</option>)}
            </select>
          </div>
        )}
        <div className="mk-sheet-field">
          <div className="mk-sheet-field-label">Rango de fechas</div>
          <div className="mk-sheet-presets">
            {DATE_PRESETS.map((preset) => (
              <button key={preset} type="button" className={`mk-sheet-preset-pill ${activePreset === preset ? 'active' : ''}`} onClick={() => handlePreset(preset)}>
                {preset}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2.5 mt-4">
          <button type="button" className="mk-btn mk-btn-secondary" style={{ flex: 1 }} onClick={handleClearFilters}>Limpiar</button>
          <button type="button" className="mk-btn mk-btn-primary" style={{ flex: 2 }} onClick={() => setFiltersOpen(false)}>Aplicar filtros</button>
        </div>
      </div>
    </MobileSheet>
  );

  return (
    <div className="flex flex-col min-h-screen -m-4 md:-m-6 xl:-m-8" style={{ '--page-accent': 'var(--color-app-queue)' }}>
      {isMobile ? (
        <MobileAppHeader appName="Queue" appIcon={ScrollText} appAccent={ACCENT} title="Bitácora" onMenu={() => openSidebar?.()} />
      ) : (
        <header className="mk-page-header">
          <div className="mk-ph-icon"><ScrollText size={16} /></div>
          <div className="flex-1 min-w-0">
            <div className="mk-ph-eyebrow"><span className="mk-dot" /> Queue</div>
            <div className="mk-ph-title">Bitácora global de impresiones</div>
          </div>
        </header>
      )}

      <AppTabs
        items={QUEUE_TABS}
        value="bitacora"
        onChange={handleTabChange}
        accent={ACCENT}
        className="px-4 md:px-6"
      />

      <div className="mk-ql-max px-4 md:px-6 pt-3 pb-24">
        {DesktopFilters}
        {MobileFilterTrigger}
        {loading ? (
          <p className="py-16 text-center text-gunmetal text-sm">Cargando bitácora…</p>
        ) : rows.length === 0 ? (
          <EmptyState icon={ScrollText} accent={ACCENT} title="Sin resultados" hint="Ajusta los filtros o el rango de fechas." />
        ) : (
          <>
            {isMobile ? MobileCards : DesktopTable}
            {Pagination}
          </>
        )}
      </div>

      {FilterSheet}
    </div>
  );
}
