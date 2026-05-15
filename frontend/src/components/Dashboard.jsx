/**
 * @file Motor de dashboard reconfigurable para Collector's Forge Studio.
 *
 * Renderiza los widgets en una grilla de 12 columnas con:
 *  - Drag & drop para reordenar (`@dnd-kit/sortable`)
 *  - Click en el botón de tamaño para ciclar quarter → half → full
 *  - Click en el ojo para ocultar; los widgets ocultos se muestran abajo
 *    para volver a agregarlos
 *
 * El estado del layout vive en `useDashboardLayout` y se persiste en
 * localStorage (`cfs.dashboard.layout`).
 *
 * @module components/Dashboard
 */

import { Suspense } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { EyeOff, GripVertical, Plus, RotateCcw } from 'lucide-react';
import { WIDGETS_BY_ID } from './widgets';
import { useDashboardLayout } from '../hooks/useDashboardLayout';

/** Grid span por tamaño (responsive: mobile=12, md=6, xl=size). */
const SIZE_CLASSES = {
  quarter: 'col-span-12 md:col-span-6 xl:col-span-3',
  half:    'col-span-12 md:col-span-6 xl:col-span-6',
  full:    'col-span-12',
};

/** Etiqueta corta del botón de tamaño. */
const SIZE_LABEL = { quarter: '¼', half: '½', full: '1' };

/**
 * Tarjeta de un widget con header (drag handle, título, acciones) + body.
 *
 * @param {{
 *   entry: { id: string, size: string },
 *   onCycleSize: (id: string) => void,
 *   onHide: (id: string) => void,
 *   dragHandle?: object,
 * }} props
 */
function WidgetCard({ entry, onCycleSize, onHide, dragHandle }) {
  const def = WIDGETS_BY_ID[entry.id];
  if (!def) return null;
  const Icon = def.icon;
  const Body = def.Component;
  return (
    <div className="bg-[#111520] border border-[#222630] rounded-2xl p-4 flex flex-col gap-3 h-full">
      <div className="flex items-center gap-2">
        {dragHandle && (
          <button
            {...dragHandle}
            type="button"
            className="p-1 text-gunmetal hover:text-tech-white cursor-grab active:cursor-grabbing"
            aria-label={`Mover ${def.title}`}
            title="Arrastrar para reordenar"
          >
            <GripVertical size={16} />
          </button>
        )}
        <Icon size={18} style={{ color: def.color }} />
        <h3 className="flex-1 text-sm font-semibold text-tech-white truncate">{def.title}</h3>
        <button
          type="button"
          onClick={() => onCycleSize(entry.id)}
          className="px-2 py-1 text-xs text-gunmetal hover:text-tech-white hover:bg-[#222630] rounded transition-colors"
          title="Cambiar tamaño"
          aria-label="Cambiar tamaño del widget"
        >
          {SIZE_LABEL[entry.size] || '½'}
        </button>
        <button
          type="button"
          onClick={() => onHide(entry.id)}
          className="p-1 text-gunmetal hover:text-rose-400 hover:bg-[#222630] rounded transition-colors"
          title="Ocultar widget"
          aria-label="Ocultar widget"
        >
          <EyeOff size={15} />
        </button>
      </div>
      <div className="flex-1 min-h-0">
        <Suspense fallback={<p className="text-sm text-gunmetal">Cargando…</p>}>
          <Body />
        </Suspense>
      </div>
    </div>
  );
}

/**
 * Wrapper sortable de @dnd-kit alrededor de un `WidgetCard`.
 *
 * @param {{ entry: object, onCycleSize: Function, onHide: Function }} props
 */
function SortableWidget({ entry, onCycleSize, onHide }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} className={SIZE_CLASSES[entry.size] || SIZE_CLASSES.half}>
      <WidgetCard entry={entry} onCycleSize={onCycleSize} onHide={onHide} dragHandle={listeners} />
    </div>
  );
}

/**
 * Panel inferior con widgets ocultos, cada uno con un botón para mostrarlos.
 *
 * @param {{ hidden: Array, onShow: (id: string) => void, onReset: () => void }} props
 */
function HiddenWidgetsRow({ hidden, onShow, onReset }) {
  if (hidden.length === 0) return null;
  return (
    <div className="mt-6 pt-4 border-t border-[#222630]">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs uppercase tracking-widest text-gunmetal">Widgets ocultos</p>
        <button
          type="button"
          onClick={onReset}
          className="text-xs text-gunmetal hover:text-tech-white inline-flex items-center gap-1"
          title="Restablecer layout por defecto"
        >
          <RotateCcw size={12} /> Restablecer
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {hidden.map((def) => {
          const Icon = def.icon;
          return (
            <button
              key={def.id}
              type="button"
              onClick={() => onShow(def.id)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#111520] border border-[#222630] text-sm text-steel hover:border-forge-teal/40 hover:text-tech-white transition-colors"
            >
              <Icon size={14} style={{ color: def.color }} />
              <span>{def.title}</span>
              <Plus size={12} className="text-gunmetal" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Dashboard reconfigurable.
 *
 * @returns {JSX.Element}
 */
export default function Dashboard() {
  const { visibleLayout, hiddenWidgets, reorder, cycleSize, hide, show, reset } =
    useDashboardLayout();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    reorder(active.id, over.id);
  };

  if (visibleLayout.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gunmetal text-sm mb-4">Todos los widgets están ocultos.</p>
        <button
          type="button"
          onClick={reset}
          className="tf-btn-ghost inline-flex items-center gap-2"
        >
          <RotateCcw size={14} /> Restablecer dashboard
        </button>
      </div>
    );
  }

  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visibleLayout.map((e) => e.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-12 gap-4">
            {visibleLayout.map((entry) => (
              <SortableWidget
                key={entry.id}
                entry={entry}
                onCycleSize={cycleSize}
                onHide={hide}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <HiddenWidgetsRow hidden={hiddenWidgets} onShow={show} onReset={reset} />
    </div>
  );
}

