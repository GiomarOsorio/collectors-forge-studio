/**
 * @file Página de gestión de impresoras 3D (Cost · Impresoras).
 *
 * CRUD de impresoras. Cada equipo alimenta el cálculo de costos (depreciación
 * por horas y energía por watts). Rediseño 1:1 con el mockup
 * `agent-docs/ui-responsive/mockups/cost.html` §Impresoras (P3 CardGrid +
 * barra "uso de vida útil" + form P6 dual MobileSheet/DetailDrawer).
 *
 * @module pages/PrintersPage
 */

import { useState, useEffect } from 'react';
import { getPrinters, createPrinter, updatePrinter, deletePrinter } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Printer } from 'lucide-react';
import { useConfirm } from '../components/ConfirmDialog';
import { useIsMobile } from '../hooks/useMediaQuery';
import { DetailDrawer, MobileSheet } from '../components/ui';

const ACCENT = '#2DD4BF';

const emptyForm = {
  name: '', model: '', purchase_price: '', power_consumption_watts: '',
  estimated_lifespan_hours: '5000', current_hours: '0',
  notes: '',
};

const fmtNum = (n) => Number(n || 0).toLocaleString('es-CO');

/** Tarjeta de impresora — icono + specs + barra de uso de vida útil (mockup). */
function PrinterCard({ printer, onEdit, onDelete }) {
  const life = Number(printer.estimated_lifespan_hours) || 0;
  const used = Number(printer.current_hours) || 0;
  const pct = life > 0 ? Math.min(100, Math.round((used / life) * 100)) : 0;
  const warn = pct >= 80;

  return (
    <div className="bg-[var(--color-surf-card)] border border-[var(--color-border)] rounded-2xl p-4 flex flex-col gap-3 min-w-0">
      <div className="flex items-start gap-2.5">
        <span
          className="w-9 h-9 rounded-[10px] shrink-0 inline-flex items-center justify-center"
          style={{ background: `${ACCENT}1F`, color: ACCENT, border: `1px solid ${ACCENT}40` }}
        >
          <Printer size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-bold text-tech-white truncate" title={printer.name}>{printer.name}</p>
          <p className="mono text-[10.5px] text-gunmetal truncate">{printer.model}</p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onEdit(printer)}
            className="w-11 h-11 lg:w-8 lg:h-8 rounded-[9px] border border-[var(--color-border-strong)] text-gunmetal hover:text-tech-white inline-flex items-center justify-center"
            aria-label="Editar impresora"
          >
            <Pencil size={13} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(printer.id)}
            className="w-11 h-11 lg:w-8 lg:h-8 rounded-[9px] border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 inline-flex items-center justify-center"
            aria-label="Eliminar impresora"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2 pt-2.5 border-t border-dashed border-[var(--color-border-soft)]">
        {[
          ['Costo', `$ ${fmtNum(Math.round(printer.purchase_price))}`, ''],
          ['Consumo', fmtNum(printer.power_consumption_watts), 'W'],
          ['Vida útil', fmtNum(printer.estimated_lifespan_hours), 'h'],
          ['Horas usadas', fmtNum(printer.current_hours), 'h'],
        ].map(([k, v, u]) => (
          <div key={k}>
            <div className="mono text-[8.5px] uppercase tracking-[0.1em] text-gunmetal mb-0.5">{k}</div>
            <div className="mono text-[12.5px] font-bold text-tech-white">
              {v}{u && <span className="text-[9.5px] text-gunmetal font-medium"> {u}</span>}
            </div>
          </div>
        ))}
      </div>

      <div>
        <div className="flex justify-between items-baseline mb-1.5">
          <span className="mono text-[8.5px] uppercase tracking-[0.1em] text-gunmetal">Uso de vida útil</span>
          <span className={`mono text-[10px] font-bold ${warn ? 'text-amber-400' : 'text-forge-teal'}`}>{pct}%</span>
        </div>
        <div className="h-[5px] rounded-full bg-[var(--color-surf-card-2)] border border-[var(--color-border-soft)] overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, background: warn ? 'linear-gradient(90deg,#D97706,#F59E0B)' : `linear-gradient(90deg,#0D9488,${ACCENT})` }}
          />
        </div>
      </div>

      {printer.notes && (
        <p className="text-[11.5px] text-gunmetal border-t border-dashed border-[var(--color-border-soft)] pt-2.5">
          {printer.notes}
        </p>
      )}
    </div>
  );
}

export default function PrintersPage() {
  const confirm = useConfirm();
  const isMobile = useIsMobile();
  const [printers, setPrinters] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = () => getPrinters().then((res) => setPrinters(res.data));
  useEffect(() => { load(); }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const openNew = () => { setForm(emptyForm); setEditingId(null); setShowForm(true); };
  const openEdit = (p) => {
    const f = {};
    for (const key of Object.keys(emptyForm)) f[key] = p[key] != null ? p[key].toString() : '';
    setForm(f);
    setEditingId(p.id);
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditingId(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = {};
    for (const [key, val] of Object.entries(form)) {
      data[key] = key === 'name' || key === 'model' || key === 'notes'
        ? (val || (key === 'notes' ? null : val))
        : parseFloat(val) || 0;
    }
    if (!data.notes) data.notes = null;
    try {
      if (editingId) {
        await updatePrinter(editingId, data);
        toast.success('Impresora actualizada');
      } else {
        await createPrinter(data);
        toast.success('Impresora creada');
      }
      closeForm();
      setForm(emptyForm);
      load();
    } catch {
      toast.error('Error al guardar');
    }
  };

  const handleDelete = async (id) => {
    if (!await confirm('¿Eliminar esta impresora?', 'Eliminar')) return;
    try {
      await deletePrinter(id);
      toast.success('Impresora eliminada');
      load();
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const FORM_INPUT = 'w-full bg-[var(--color-surf-card-2)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-2 text-tech-white text-sm focus:outline-none focus:border-teal-500 min-h-[44px]';

  const formBody = (
    <form id="printer-form" onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-xs text-gunmetal mb-1">Nombre *</span>
          <input name="name" value={form.name} onChange={handleChange} required className={FORM_INPUT} />
        </label>
        <label className="block">
          <span className="block text-xs text-gunmetal mb-1">Modelo *</span>
          <input name="model" value={form.model} onChange={handleChange} required className={FORM_INPUT} />
        </label>
        <label className="block">
          <span className="block text-xs text-gunmetal mb-1">Precio de compra ($) *</span>
          <input name="purchase_price" type="number" step="0.01" value={form.purchase_price} onChange={handleChange} required className={FORM_INPUT} />
        </label>
        <label className="block">
          <span className="block text-xs text-gunmetal mb-1">Consumo (watts) *</span>
          <input name="power_consumption_watts" type="number" value={form.power_consumption_watts} onChange={handleChange} required className={FORM_INPUT} />
        </label>
        <label className="block">
          <span className="block text-xs text-gunmetal mb-1">Vida útil (horas)</span>
          <input name="estimated_lifespan_hours" type="number" value={form.estimated_lifespan_hours} onChange={handleChange} className={FORM_INPUT} />
        </label>
        <label className="block">
          <span className="block text-xs text-gunmetal mb-1">Horas de uso actual</span>
          <input name="current_hours" type="number" value={form.current_hours} onChange={handleChange} className={FORM_INPUT} />
        </label>
      </div>
      <label className="block">
        <span className="block text-xs text-gunmetal mb-1">Notas</span>
        <textarea name="notes" value={form.notes} onChange={handleChange} rows={2} className={`${FORM_INPUT} min-h-0 resize-y`} />
      </label>
    </form>
  );

  const formFooter = (
    <div className="flex gap-2 w-full">
      <button type="button" onClick={closeForm} className="tf-btn-ghost flex-1">Cancelar</button>
      <button type="submit" form="printer-form" className="tf-btn-primary flex-1">
        {editingId ? 'Actualizar' : 'Crear'}
      </button>
    </div>
  );

  const title = editingId ? 'Editar impresora' : 'Nueva impresora';

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="text-[15px] font-bold text-tech-white">Impresoras</h2>
          <p className="mono text-[10px] text-gunmetal mt-0.5">
            {printers.length} equipo{printers.length === 1 ? '' : 's'} · usadas en depreciación y energía de la calculadora
          </p>
        </div>
        <button onClick={openNew} className="tf-btn-primary">
          <Plus size={18} /> Agregar impresora
        </button>
      </div>

      {printers.length === 0 ? (
        <div className="border border-dashed border-[var(--color-border-strong)] rounded-2xl py-10 px-4 text-center text-gunmetal text-[12.5px]">
          No hay impresoras configuradas.
        </div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
          {printers.map((p) => (
            <PrinterCard key={p.id} printer={p} onEdit={openEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Form P6 dual — MobileSheet <1024 / DetailDrawer ≥1024. */}
      {isMobile ? (
        <MobileSheet open={showForm} onClose={closeForm} title={title} height="full">
          {showForm && (
            <>
              <div className="px-5 pt-4 pb-4">{formBody}</div>
              <div className="px-5 pt-3 pb-5 border-t border-[var(--color-border-soft)] sticky bottom-0 bg-[var(--color-surf-sidebar)]">
                {formFooter}
              </div>
            </>
          )}
        </MobileSheet>
      ) : (
        <DetailDrawer open={showForm} onClose={closeForm} eyebrow="COST · IMPRESORAS" title={title} width={480} footer={showForm ? formFooter : undefined}>
          {showForm && formBody}
        </DetailDrawer>
      )}
    </div>
  );
}
