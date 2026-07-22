/**
 * @file Página de historial de costos de impresión de collectors-forge-studio.
 *
 * Muestra la lista de costos de impresión guardados por el usuario, con detalle,
 * edición de campos descriptivos y borrado. El PDF es exclusivo de "Historial de
 * Cotizaciones" y "Cotización manual".
 *
 * Port 1:1 del mockup projects-history.html §History (sistema `mk-`): shell dual
 * (`MobileAppHeader` <1024 / `mk-page-header` ≥1024), sub-nav de Costos como
 * AppTabs (P4, decisión 2026-07-16 — antes vivía en la sidebar), tabla de 6
 * columnas (`mk-hist-table`, wrapper overflow-x-auto siempre) → cards P2 en
 * mobile, y detalle/edición P6 dual (`MobileSheet` <1024 / `DetailDrawer` ≥1024).
 * Ruta canónica `/cost/history` intacta.
 *
 * @module pages/HistoryPage
 */

import { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { getQuotes, deleteQuote, updateQuote } from '../services/api';
import toast from 'react-hot-toast';
import { Trash2, Eye, Pencil, BarChart2, Receipt } from 'lucide-react';
import { useConfirm } from '../components/ConfirmDialog';
import { SkeletonTable } from '../components/SkeletonLoader';
import EmptyState from '../components/EmptyState';
import MobileAppHeader from '../components/MobileAppHeader';
import { useIsMobile } from '../hooks/useMediaQuery';
import { AppTabs, MobileSheet, DetailDrawer } from '../components/ui';
import './HistoryPage.css';

const ACCENT = '#2DD4BF';

/**
 * Sub-nav del módulo Cost (P4 AppTabs). Decisión 2026-07-16: el segundo nivel
 * de Cost salió de la sidebar y vive en el contenido de cada página de Cost.
 * Por ahora se cablea solo aquí (resto de páginas Cost lo adoptan en su turno).
 */
const COST_TABS = [
  { id: 'quotes',     label: 'Cotizaciones',    path: '/cost' },
  { id: 'calculator', label: 'Calcular pieza',  path: '/cost/calculator' },
  { id: 'manual',     label: 'Nueva cotización', path: '/cost/manual' },
  { id: 'history',    label: 'Historial',       path: '/cost/history' },
  { id: 'printers',   label: 'Impresoras',      path: '/cost/printers' },
  { id: 'settings',   label: 'Tarifa & ajustes', path: '/cost/settings' },
];

/** Fecha ISO → dd/mm/yyyy. */
const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/** Moneda del registro (COP si trae total en pesos, USD si no). */
const currencyOf = (q) => (q.total_price_cop ? 'COP' : 'USD');

/** Total con sufijo para la tabla desktop. */
const totalLabel = (q) =>
  q.total_price_cop
    ? `$ ${Math.round(q.total_price_cop).toLocaleString('es-CO')} COP`
    : `$ ${q.total_price.toFixed(2)}`;

/** Total compacto para la cabecera de la card mobile (sufijo solo en USD). */
const totalCompact = (q) =>
  q.total_price_cop
    ? `$ ${Math.round(q.total_price_cop).toLocaleString('es-CO')}`
    : `$ ${q.total_price.toFixed(2)} USD`;

/**
 * Página de historial de costos.
 *
 * @returns {JSX.Element}
 */
export default function HistoryPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { openSidebar } = useOutletContext() || {};
  const confirm = useConfirm();
  const [quotes, setQuotes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ piece_name: '', description: '', client_name: '', notes: '' });

  const load = async () => {
    setLoading(true);
    try {
      const res = await getQuotes();
      setQuotes(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openEdit = (q) => {
    setEditing(q);
    setEditForm({ piece_name: q.piece_name, description: q.description || '', client_name: q.client_name || '', notes: q.notes || '' });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      await updateQuote(editing.id, editForm);
      toast.success('Cotización actualizada');
      setEditing(null);
      load();
    } catch {
      toast.error('Error al actualizar');
    }
  };

  const handleDelete = async (id) => {
    if (!await confirm('¿Eliminar este registro de costo? Esta acción no se puede deshacer.', 'Eliminar')) return;
    try {
      await deleteQuote(id);
      toast.success('Registro eliminado');
      load();
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const handleTabChange = (id) => {
    const tab = COST_TABS.find((t) => t.id === id);
    if (tab && id !== 'history') navigate(tab.path);
  };

  const subNav = (
    <AppTabs
      items={COST_TABS.map((t) => (t.id === 'history' ? { ...t, count: quotes.length } : t))}
      value="history"
      onChange={handleTabChange}
      accent={ACCENT}
      className="px-4 md:px-6"
    />
  );

  const DesktopTable = (
    <div className="mk-hist-table-wrap">
      <table className="mk-hist-table">
        <thead>
          <tr>
            <th>Fecha</th><th>Pieza</th><th>Cliente</th>
            <th className="num">Cant.</th><th className="num">Total</th><th className="num">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {quotes.map((q) => (
            <tr key={q.id}>
              <td>{formatDate(q.created_at)}</td>
              <td className="piece">{q.piece_name}</td>
              <td>{q.client_name || '—'}</td>
              <td className="num mono">{q.quantity}</td>
              <td className="num total">{totalLabel(q)}</td>
              <td className="num">
                <span className="mk-row-actions">
                  <button type="button" className="mk-icon-btn" title="Ver detalle" aria-label="Ver detalle" onClick={() => setSelected(q)}><Eye size={15} /></button>
                  <button type="button" className="mk-icon-btn" title="Editar" aria-label="Editar" onClick={() => openEdit(q)}><Pencil size={15} /></button>
                  <button type="button" className="mk-icon-btn danger" title="Eliminar" aria-label="Eliminar" onClick={() => handleDelete(q.id)}><Trash2 size={15} /></button>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const MobileCards = (
    <div className="mk-hist-cards">
      {quotes.map((q) => (
        <div key={q.id} className="mk-hist-card">
          <div className="mk-hc-top">
            <div className="mk-hc-title truncate">{q.piece_name}</div>
            <div className="mk-hc-total">{totalCompact(q)}</div>
          </div>
          <div className="mk-hc-grid">
            <div className="mk-hc-pair"><label>Fecha</label><span>{formatDate(q.created_at)}</span></div>
            <div className="mk-hc-pair"><label>Cliente</label><span>{q.client_name || '—'}</span></div>
            <div className="mk-hc-pair"><label>Cantidad</label><span className="mono">{q.quantity}</span></div>
            <div className="mk-hc-pair"><label>Moneda</label><span>{currencyOf(q)}</span></div>
          </div>
          <div className="mk-hc-actions">
            <button type="button" className="mk-btn mk-btn-secondary" onClick={() => setSelected(q)}><Eye size={14} /> Ver</button>
            <button type="button" className="mk-btn mk-btn-secondary" onClick={() => openEdit(q)}><Pencil size={14} /> Editar</button>
            <button type="button" className="mk-btn mk-btn-secondary" style={{ color: 'var(--forge-rose)' }} onClick={() => handleDelete(q.id)}><Trash2 size={14} /> Eliminar</button>
          </div>
        </div>
      ))}
    </div>
  );

  const emptyState = (
    <div className="px-4 md:px-6">
      <EmptyState
        icon={BarChart2}
        title="No hay registros de costos"
        description="Calcula y guarda el costo de una impresión para verlo aquí."
        actionLabel="Ir a la calculadora"
        onAction={() => navigate('/cost/calculator')}
      />
    </div>
  );

  // Paneles P6 (dual internamente). Solo uno se monta a la vez.
  const panels = (
    <>
      <QuoteDetailPanel quote={selected} onClose={() => setSelected(null)} />
      <QuoteEditPanel
        quote={editing}
        form={editForm}
        onChange={setEditForm}
        onSubmit={handleSaveEdit}
        onClose={() => setEditing(null)}
      />
    </>
  );

  const content =
    quotes.length === 0 ? emptyState : (isMobile ? MobileCards : DesktopTable);

  return (
    <div className="flex flex-col min-h-screen -m-4 md:-m-6 xl:-m-8" style={{ '--page-accent': ACCENT }}>
      {isMobile ? (
        <MobileAppHeader
          appName="Cost · Historial"
          appIcon={Receipt}
          appAccent={ACCENT}
          title="Historial de costos"
          onMenu={() => openSidebar?.()}
        />
      ) : (
        <header className="mk-page-header">
          <div className="mk-ph-icon"><Receipt size={16} /></div>
          <div className="flex-1 min-w-0">
            <div className="mk-ph-eyebrow"><span className="mk-dot" /> Cost · Historial</div>
            <div className="mk-ph-title">
              Historial de costos de impresión
              <span className="mk-ph-count">{quotes.length}</span>
            </div>
          </div>
        </header>
      )}

      {subNav}

      <div className="mk-hist-max px-4 md:px-6 pt-1 pb-24 md:pb-10 w-full">
        {loading ? (
          <div className="pt-3"><SkeletonTable rows={6} cols={6} /></div>
        ) : (
          content
        )}
      </div>

      {panels}
    </div>
  );
}

/**
 * Detalle de un costo — P6 dual (MobileSheet <1024 / DetailDrawer ≥1024).
 *
 * @param {Object} props
 * @param {Object|null} props.quote
 * @param {() => void} props.onClose
 */
function QuoteDetailPanel({ quote, onClose }) {
  const isMobile = useIsMobile();
  if (!quote) return null;

  const money = (v) => `$ ${Number(v).toFixed(2)}`;

  const body = (
    <div style={{ '--page-accent': ACCENT }}>
      {quote.client_name && (
        <p className="text-[12.5px] mb-1" style={{ color: 'var(--cfs-text-secondary)' }}>
          Cliente: <b style={{ color: 'var(--cfs-text)' }}>{quote.client_name}</b>
        </p>
      )}
      {quote.description && (
        <p className="text-xs mb-3.5" style={{ color: 'var(--cfs-text-tertiary)' }}>{quote.description}</p>
      )}

      <div className="mk-cost-row"><span className="lbl">Material</span><span className="val">{money(quote.material_cost)}</span></div>
      <div className="mk-cost-row"><span className="lbl">Electricidad</span><span className="val">{money(quote.electricity_cost)}</span></div>
      <div className="mk-cost-row"><span className="lbl">Depreciación</span><span className="val">{money(quote.depreciation_cost)}</span></div>
      <div className="mk-cost-row"><span className="lbl">Mano de obra</span><span className="val">{money(quote.labor_cost)}</span></div>
      <div className="mk-cost-row"><span className="lbl">Absorción fallos</span><span className="val">{money(quote.failure_cost)}</span></div>
      <div className="mk-cost-row bold"><span className="lbl">Subtotal</span><span className="val">{money(quote.subtotal)}</span></div>
      <div className="mk-cost-row"><span className="lbl">Margen ({quote.margin_percent}%)</span><span className="val">{money(quote.margin_amount)}</span></div>

      <div className="mk-cost-total-usd">
        <span className="lbl">Total cotización (USD)</span>
        <span className="val">{money(quote.total_price)}</span>
      </div>
      {quote.quantity > 1 && (
        <div className="mk-cost-row" style={{ border: 'none', paddingTop: '10px' }}>
          <span className="lbl">Precio por pieza USD (÷{quote.quantity})</span>
          <span className="val">{money(quote.total_per_unit)}</span>
        </div>
      )}

      {quote.total_price_cop && (
        <>
          <div className="mk-cost-total-cop">
            <span className="lbl">Total cotización (COP)</span>
            <span className="val">$ {Math.round(quote.total_price_cop).toLocaleString('es-CO')}</span>
          </div>
          {quote.quantity > 1 && (
            <div className="mk-cost-row" style={{ border: 'none' }}>
              <span className="lbl" style={{ color: 'var(--forge-teal)' }}>Por pieza COP (÷{quote.quantity})</span>
              <span className="val" style={{ color: 'var(--forge-teal)' }}>$ {Math.round(quote.total_per_unit_cop).toLocaleString('es-CO')}</span>
            </div>
          )}
          <p className="mk-cost-rate-hint">Tasa: 1 USD = {quote.usd_to_cop_rate?.toLocaleString('es-CO')} COP</p>
        </>
      )}

      <p className="text-[11px] mt-3.5" style={{ color: 'var(--cfs-text-tertiary)' }}>
        Este registro corresponde a un cálculo de costo de impresión, no a una cotización de cliente.
      </p>
    </div>
  );

  if (isMobile) {
    return (
      <MobileSheet open onClose={onClose} title={quote.piece_name} height="full">
        <div className="px-5 pt-4 pb-6">{body}</div>
      </MobileSheet>
    );
  }
  return (
    <DetailDrawer open onClose={onClose} eyebrow="COST · HISTORIAL · DETALLE" title={quote.piece_name} width={480}>
      {body}
    </DetailDrawer>
  );
}

/**
 * Edición de campos descriptivos — P6 dual.
 *
 * @param {Object} props
 * @param {Object|null} props.quote
 * @param {Object} props.form
 * @param {(f: Object) => void} props.onChange
 * @param {(e: Event) => void} props.onSubmit
 * @param {() => void} props.onClose
 */
function QuoteEditPanel({ quote, form, onChange, onSubmit, onClose }) {
  const isMobile = useIsMobile();
  if (!quote) return null;

  const body = (
    <form id="history-edit-form" onSubmit={onSubmit} className="mk-form-grid" style={{ '--page-accent': ACCENT }}>
      <label className="mk-field full">
        <span className="lbl">Nombre de la pieza</span>
        <input value={form.piece_name} onChange={(e) => onChange({ ...form, piece_name: e.target.value })} required />
      </label>
      <label className="mk-field full">
        <span className="lbl">Cliente</span>
        <input value={form.client_name} onChange={(e) => onChange({ ...form, client_name: e.target.value })} />
      </label>
      <label className="mk-field full">
        <span className="lbl">Descripción</span>
        <input value={form.description} onChange={(e) => onChange({ ...form, description: e.target.value })} />
      </label>
      <label className="mk-field full">
        <span className="lbl">Notas</span>
        <textarea rows={3} value={form.notes} onChange={(e) => onChange({ ...form, notes: e.target.value })} />
      </label>
    </form>
  );

  const footer = (
    <div className="flex gap-2 w-full">
      <button type="button" onClick={onClose} className="mk-btn mk-btn-secondary flex-1">Cancelar</button>
      <button type="submit" form="history-edit-form" className="mk-btn mk-btn-primary flex-1">Guardar</button>
    </div>
  );

  if (isMobile) {
    return (
      <MobileSheet open onClose={onClose} title="Editar cotización" height="full">
        <div className="px-5 pt-4 pb-4">{body}</div>
        <div className="px-5 pt-3 pb-5 border-t border-[var(--color-border-soft)] sticky bottom-0 bg-[var(--color-surf-sidebar)]">
          {footer}
        </div>
      </MobileSheet>
    );
  }
  return (
    <DetailDrawer open onClose={onClose} eyebrow="COST · HISTORIAL · EDITAR" title="Editar cotización" width={460} footer={footer}>
      {body}
    </DetailDrawer>
  );
}
