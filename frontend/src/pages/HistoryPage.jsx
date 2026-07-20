/**
 * @file Página de historial de costos de impresión de collectors-forge-studio.
 *
 * Muestra la lista de costos de impresión guardados por el usuario, con detalle,
 * edición de campos descriptivos y borrado. El PDF es exclusivo de "Historial de
 * Cotizaciones" y "Cotización manual".
 *
 * Fix #167 (P2): página legacy pre-#126 modernizada — shell dual
 * (`MobileAppHeader` <1024 / header desktop), tabla de 6 columnas a
 * `<ResponsiveTable>` (cards en mobile) y modales detalle/edición a P6
 * (`MobileSheet` <1024 / `DetailDrawer` ≥1024). El confirm de eliminar es corto
 * y se queda centrado. Ruta canónica `/cost/history` intacta.
 * Ref: agent-docs/ui-responsive/mockups/projects-history.html §History.
 *
 * @module pages/HistoryPage
 */

import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getQuotes, deleteQuote, updateQuote } from '../services/api';
import toast from 'react-hot-toast';
import { Trash2, Eye, Pencil, BarChart2, Receipt } from 'lucide-react';
import { useConfirm } from '../components/ConfirmDialog';
import { SkeletonTable } from '../components/SkeletonLoader';
import EmptyState from '../components/EmptyState';
import MobileAppHeader from '../components/MobileAppHeader';
import { useIsMobile } from '../hooks/useMediaQuery';
import { ResponsiveTable, MobileSheet, DetailDrawer } from '../components/ui';

const ACCENT = '#2DD4BF';

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
    if (!await confirm('¿Eliminar este registro?', 'Eliminar')) return;
    try {
      await deleteQuote(id);
      toast.success('Registro eliminado');
      load();
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const RowActions = ({ q }) => (
    <span className="inline-flex items-center gap-1.5 justify-end">
      <button onClick={() => setSelected(q)} className="tf-btn-ghost" title="Ver detalle"><Eye size={16} /></button>
      <button onClick={() => openEdit(q)} className="tf-btn-ghost" title="Editar"><Pencil size={16} /></button>
      <button onClick={() => handleDelete(q.id)} className="tf-btn-danger" title="Eliminar"><Trash2 size={16} /></button>
    </span>
  );

  const columns = [
    { key: 'fecha', label: 'Fecha', render: (q) => <span className="text-gunmetal">{formatDate(q.created_at)}</span> },
    { key: 'pieza', label: 'Pieza', strong: true, render: (q) => q.piece_name },
    { key: 'cliente', label: 'Cliente', render: (q) => <span className="text-steel">{q.client_name || '—'}</span> },
    { key: 'cant', label: 'Cant.', className: 'text-right', mobile: false, render: (q) => <span className="mono text-steel">{q.quantity}</span> },
    { key: 'total', label: 'Total', className: 'text-right', mobile: false, render: (q) => <span className="mono font-semibold text-forge-teal">{totalLabel(q)}</span> },
    { key: 'acciones', label: 'Acciones', className: 'text-right', mobile: false, render: (q) => <RowActions q={q} /> },
  ];

  // Card mobile 1:1 con el mockup: pieza + total en la primera línea, pares
  // fecha/cliente/cant./moneda en grid-cols-2 y fila de acciones abajo.
  const mobileCard = (q) => (
    <div className="bg-[var(--color-surf-panel)] border border-[var(--color-border)] rounded-xl p-3.5 mb-2.5">
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <span className="text-sm font-semibold text-tech-white min-w-0 truncate">{q.piece_name}</span>
        <span className="mono text-sm font-bold text-forge-teal shrink-0">{totalCompact(q)}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 mb-3">
        {[
          ['Fecha', formatDate(q.created_at)],
          ['Cliente', q.client_name || '—'],
          ['Cantidad', q.quantity],
          ['Moneda', currencyOf(q)],
        ].map(([label, value]) => (
          <div key={label}>
            <label className="block mono text-[9.5px] font-bold uppercase tracking-wider text-gunmetal mb-0.5">{label}</label>
            <span className="text-[12.5px] text-steel">{value}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-2.5 border-t border-[var(--color-border-soft)]">
        <button onClick={() => setSelected(q)} className="btn btn-secondary btn-sm flex-1 justify-center"><Eye size={14} /> Ver</button>
        <button onClick={() => openEdit(q)} className="btn btn-secondary btn-sm flex-1 justify-center"><Pencil size={14} /> Editar</button>
        <button onClick={() => handleDelete(q.id)} className="btn btn-secondary btn-sm flex-1 justify-center" style={{ color: 'var(--forge-rose)' }}><Trash2 size={14} /> Eliminar</button>
      </div>
    </div>
  );

  const emptyState = (
    <EmptyState
      icon={BarChart2}
      title="No hay registros de costos"
      description="Calcula y guarda el costo de una impresión para verlo aquí."
      actionLabel="Ir a la calculadora"
      onAction={() => { window.location.href = '/cost/calculator'; }}
    />
  );

  const table = (
    <ResponsiveTable
      columns={columns}
      rows={quotes}
      rowKey={(q) => q.id}
      mobileCard={mobileCard}
      minWidth={640}
      empty={emptyState}
    />
  );

  // Paneles P6 (dual internamente). Se incluyen en ambos shells; solo uno se
  // monta a la vez, así que no se duplican.
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

  if (loading) return <SkeletonTable rows={6} cols={6} />;

  if (isMobile) {
    return (
      <div className="flex flex-col">
        <MobileAppHeader
          appName="Cost · Historial"
          appIcon={Receipt}
          appAccent={ACCENT}
          title="Historial de costos"
          onMenu={() => openSidebar?.()}
        />
        <div className="px-4 pt-2 pb-8">{table}</div>
        {panels}
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen -m-4 md:-m-6 xl:-m-8">
      <header className="flex items-center gap-4 px-6 py-3.5 border-b border-[var(--color-border-soft)] bg-[var(--color-surf-sidebar)] sticky top-0 z-20">
        <span
          className="inline-flex items-center justify-center w-6 h-6 rounded-md shrink-0"
          style={{ background: `${ACCENT}1F`, color: ACCENT, border: `1px solid ${ACCENT}40` }}
        >
          <Receipt size={13} />
        </span>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm font-semibold text-tech-white whitespace-nowrap">Historial de costos de impresión</span>
          <span className="mono text-[10px] px-1.5 py-0.5 rounded-sm bg-white/5 border border-[var(--color-border)] text-steel ml-1">
            {quotes.length}
          </span>
        </div>
      </header>

      <div className="px-6 py-4">{table}</div>
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

  const body = (
    <div className="space-y-2 text-sm">
      {quote.client_name && <p className="text-steel mb-2">Cliente: {quote.client_name}</p>}
      {quote.description && <p className="text-gunmetal mb-4">{quote.description}</p>}
      <Row label="Material" value={quote.material_cost} />
      <Row label="Electricidad" value={quote.electricity_cost} />
      <Row label="Depreciación" value={quote.depreciation_cost} />
      <Row label="Mano de obra" value={quote.labor_cost} />
      <Row label="Absorción fallos" value={quote.failure_cost} />
      <hr className="tf-hr" />
      <Row label="Subtotal" value={quote.subtotal} bold />
      <Row label={`Margen (${quote.margin_percent}%)`} value={quote.margin_amount} />
      <hr className="tf-hr" />
      <Row label="Total cotización (USD)" value={quote.total_price} bold highlight />
      {quote.quantity > 1 && (
        <Row label={`Precio por pieza USD (÷${quote.quantity})`} value={quote.total_per_unit} bold />
      )}
      {quote.total_price_cop && (
        <>
          <div className="flex justify-between items-baseline gap-2 bg-[#0A2530] border border-forge-teal/20 px-3 py-2 rounded-lg">
            <span className="font-semibold text-forge-teal min-w-0">Total cotización (COP)</span>
            <span className="font-bold text-forge-teal text-lg shrink-0">$ {Math.round(quote.total_price_cop).toLocaleString('es-CO')}</span>
          </div>
          {quote.quantity > 1 && (
            <div className="flex justify-between items-baseline gap-2 bg-[#0A2530]/60 px-3 py-1 rounded">
              <span className="font-semibold text-forge-teal text-sm min-w-0">Por pieza COP (÷{quote.quantity})</span>
              <span className="font-bold text-forge-teal shrink-0">$ {Math.round(quote.total_per_unit_cop).toLocaleString('es-CO')}</span>
            </div>
          )}
          <p className="text-xs text-gunmetal">Tasa: 1 USD = {quote.usd_to_cop_rate?.toLocaleString('es-CO')} COP</p>
        </>
      )}
      <p className="mt-4 text-xs text-gunmetal">
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
    <DetailDrawer open onClose={onClose} eyebrow="COST · HISTORIAL" title={quote.piece_name} width={480}>
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
    <form id="history-edit-form" onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="tf-label">Nombre de la pieza</label>
        <input className="tf-input" value={form.piece_name} onChange={(e) => onChange({ ...form, piece_name: e.target.value })} required />
      </div>
      <div>
        <label className="tf-label">Cliente</label>
        <input className="tf-input" value={form.client_name} onChange={(e) => onChange({ ...form, client_name: e.target.value })} />
      </div>
      <div>
        <label className="tf-label">Descripción</label>
        <input className="tf-input" value={form.description} onChange={(e) => onChange({ ...form, description: e.target.value })} />
      </div>
      <div>
        <label className="tf-label">Notas</label>
        <textarea className="tf-input" rows={3} value={form.notes} onChange={(e) => onChange({ ...form, notes: e.target.value })} />
      </div>
    </form>
  );

  const footer = (
    <div className="flex gap-2 w-full">
      <button type="button" onClick={onClose} className="tf-btn-ghost flex-1">Cancelar</button>
      <button type="submit" form="history-edit-form" className="tf-btn-primary flex-1">Guardar</button>
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
    <DetailDrawer open onClose={onClose} eyebrow="COST · HISTORIAL" title="Editar cotización" width={460} footer={footer}>
      {body}
    </DetailDrawer>
  );
}

/**
 * Fila del desglose de costos (label izquierda / valor monetario derecha).
 *
 * @param {Object} props
 * @param {string} props.label
 * @param {number} props.value
 * @param {boolean} [props.bold]
 * @param {boolean} [props.highlight]
 * @returns {JSX.Element}
 */
function Row({ label, value, bold, highlight }) {
  return (
    <div className={`tf-cost-row ${highlight ? 'bg-forge-teal/10 -mx-2 px-2 py-2 rounded-lg' : ''}`}>
      <span className={`${bold ? 'font-semibold text-tech-white' : 'text-steel'} min-w-0`}>{label}</span>
      <span className={`${bold ? 'font-bold' : ''} ${highlight ? 'text-forge-teal' : 'text-tech-white'} shrink-0`}>$ {value.toFixed(2)}</span>
    </div>
  );
}
