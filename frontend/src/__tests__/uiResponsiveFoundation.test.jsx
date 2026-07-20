/**
 * @file Tests de los primitives v3 foundation responsive (issue #160).
 *
 * Cubre CardGrid (P3), AppTabs (P4), KPIStrip (P5), LineItems (P1),
 * ResponsiveTable (P2), DesktopPageHeader (P7), el fix de max-width en
 * SearchField y el trigger touch de ContextMenu (useContextMenuTrigger).
 *
 * El breakpoint mobile/desktop se controla mockeando `useIsMobile`.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Clock, ListOrdered } from 'lucide-react';

vi.mock('../hooks/useMediaQuery', () => ({
  useMediaQuery: vi.fn(() => false),
  useIsMobile: vi.fn(() => false),
}));

import { useIsMobile } from '../hooks/useMediaQuery';
import {
  AppTabs,
  CardGrid,
  DesktopPageHeader,
  KPIStrip,
  LineItems,
  ResponsiveTable,
  SearchField,
  useContextMenuTrigger,
} from '../components/ui';

beforeEach(() => {
  useIsMobile.mockReturnValue(false);
});

// ─── CardGrid (P3) ──────────────────────────────────────────────────────────

describe('CardGrid', () => {
  it('genera repeat(auto-fill, minmax(min, 1fr)) con el min indicado', () => {
    const { container } = render(<CardGrid min={320}>x</CardGrid>);
    expect(container.firstChild.style.gridTemplateColumns).toBe(
      'repeat(auto-fill, minmax(320px, 1fr))',
    );
  });

  it('default min=240 y gap=12', () => {
    const { container } = render(<CardGrid>x</CardGrid>);
    expect(container.firstChild.style.gridTemplateColumns).toContain('240px');
    expect(container.firstChild.style.gap).toBe('12px');
  });
});

// ─── AppTabs (P4) ───────────────────────────────────────────────────────────

const TAB_ITEMS = [
  { id: 'activa', label: 'Cola activa', icon: ListOrdered, count: 4 },
  { id: 'historial', label: 'Historial', icon: Clock, count: 128 },
  { id: 'timeline', label: 'Timeline' },
];

describe('AppTabs', () => {
  it('renderiza todas las tabs con role=tab y sus contadores', () => {
    render(<AppTabs items={TAB_ITEMS} value="activa" onChange={() => {}} />);
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('128')).toBeInTheDocument();
  });

  it('marca la tab activa con aria-selected', () => {
    render(<AppTabs items={TAB_ITEMS} value="historial" onChange={() => {}} />);
    const active = screen.getByRole('tab', { selected: true });
    expect(active).toHaveTextContent('Historial');
  });

  it('dispara onChange con el id al hacer click', () => {
    const onChange = vi.fn();
    render(<AppTabs items={TAB_ITEMS} value="activa" onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: /Timeline/ }));
    expect(onChange).toHaveBeenCalledWith('timeline');
  });

  it('tab sin count no renderiza badge', () => {
    render(<AppTabs items={TAB_ITEMS} value="activa" onChange={() => {}} />);
    const timeline = screen.getByRole('tab', { name: /Timeline/ });
    expect(timeline.querySelector('.mono')).toBeNull();
  });
});

// ─── KPIStrip (P5) ──────────────────────────────────────────────────────────

const KPI_ITEMS = [
  { label: 'Modelos', value: 32 },
  { label: 'En cola', value: 4 },
];

describe('KPIStrip', () => {
  it('desktop: flex-wrap con wrappers min-width', () => {
    const { container } = render(<KPIStrip items={KPI_ITEMS} />);
    expect(container.firstChild.className).toContain('flex-wrap');
    expect(screen.getByText('Modelos')).toBeInTheDocument();
    expect(screen.getByText('En cola')).toBeInTheDocument();
  });

  it('mobile: carrusel scroll-x con scroll-snap y fade', () => {
    useIsMobile.mockReturnValue(true);
    const { container } = render(<KPIStrip items={KPI_ITEMS} />);
    const scroll = container.querySelector('.overflow-x-auto');
    expect(scroll).not.toBeNull();
    expect(scroll.style.scrollSnapType).toBe('x mandatory');
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('acepta children <KPI> directos además de items', async () => {
    const { default: KPI } = await import('../components/ui/KPI');
    render(
      <KPIStrip>
        <KPI label="Hijos" value={1} />
      </KPIStrip>,
    );
    expect(screen.getByText('Hijos')).toBeInTheDocument();
  });
});

// ─── LineItems (P1) ─────────────────────────────────────────────────────────

const LI_COLUMNS = [
  { key: 'name', label: 'Producto', width: '2.2fr', render: (it) => <input defaultValue={it.name} /> },
  { key: 'qty', label: 'Cant.', width: '0.7fr', render: (it) => <input defaultValue={it.qty} /> },
  { key: 'subtotal', label: 'Subtotal', render: (it) => <span>{it.subtotal}</span> },
];
const LI_ITEMS = [
  { id: 1, name: 'Soporte en L', qty: 2, subtotal: '$ 90.000' },
  { id: 2, name: 'Llavero animalito', qty: 100, subtotal: '$ 105.000' },
];

describe('LineItems', () => {
  it('desktop: cabecera de columnas + tracks fr envueltos en minmax(0, …)', () => {
    const { container } = render(
      <LineItems columns={LI_COLUMNS} items={LI_ITEMS} itemKey={(it) => it.id} onRemove={() => {}} />,
    );
    expect(screen.getByText('Producto')).toBeInTheDocument();
    const head = container.querySelector('[style*="grid-template-columns"]');
    expect(head.style.gridTemplateColumns).toBe('minmax(0, 2.2fr) minmax(0, 0.7fr) minmax(0, 1fr) 44px');
  });

  it('desktop: onRemove renderiza botón quitar por fila y dispara con item+índice', () => {
    const onRemove = vi.fn();
    render(<LineItems columns={LI_COLUMNS} items={LI_ITEMS} itemKey={(it) => it.id} onRemove={onRemove} />);
    const btns = screen.getAllByRole('button', { name: 'Quitar ítem' });
    expect(btns).toHaveLength(2);
    fireEvent.click(btns[1]);
    expect(onRemove).toHaveBeenCalledWith(LI_ITEMS[1], 1);
  });

  it('desktop: footer se renderiza al pie', () => {
    render(
      <LineItems columns={LI_COLUMNS} items={LI_ITEMS} footer={<span>Total: $ 195.000</span>} />,
    );
    expect(screen.getByText('Total: $ 195.000')).toBeInTheDocument();
  });

  it('mobile: cards apiladas con labels de campo, "Ítem i de n" y mobileFoot', () => {
    useIsMobile.mockReturnValue(true);
    render(
      <LineItems
        columns={LI_COLUMNS}
        items={LI_ITEMS}
        itemKey={(it) => it.id}
        onRemove={() => {}}
        mobileFoot={(it) => it.subtotal}
      />,
    );
    // labels de campos cortos (la primaria va sin label, full-width)
    expect(screen.getByText('Ítem 1 de 2')).toBeInTheDocument();
    expect(screen.getByText('Ítem 2 de 2')).toBeInTheDocument();
    expect(screen.getAllByText('Cant.')).toHaveLength(2);
    expect(screen.queryByText('Producto')).toBeNull();
    expect(screen.getAllByText('$ 90.000')).toHaveLength(2); // celda + foot
  });

  it('mobile: columna con mobile=false no aparece en la card', () => {
    useIsMobile.mockReturnValue(true);
    const cols = [LI_COLUMNS[0], { ...LI_COLUMNS[1], mobile: false }, LI_COLUMNS[2]];
    render(<LineItems columns={cols} items={LI_ITEMS} itemKey={(it) => it.id} />);
    expect(screen.queryByText('Cant.')).toBeNull();
    expect(screen.getAllByText('Subtotal')).toHaveLength(2);
  });
});

// ─── ResponsiveTable (P2) ───────────────────────────────────────────────────

const RT_COLUMNS = [
  { key: 'item', label: 'Ítem', strong: true },
  { key: 'fecha', label: 'Fecha' },
  { key: 'origen', label: 'Origen', mobile: false },
];
const RT_ROWS = [
  { id: 'a', item: 'Soporte en L', fecha: '14/07/2026', origen: 'COT-0007' },
  { id: 'b', item: 'Llavero x100', fecha: '13/07/2026', origen: 'COT-0006' },
];

describe('ResponsiveTable', () => {
  it('desktop: <table> con wrapper overflow-x-auto siempre', () => {
    const { container } = render(
      <ResponsiveTable columns={RT_COLUMNS} rows={RT_ROWS} rowKey={(r) => r.id} />,
    );
    expect(container.querySelector('table')).not.toBeNull();
    expect(container.firstChild.className).toContain('overflow-x-auto');
    expect(screen.getByText('COT-0007')).toBeInTheDocument();
  });

  it('desktop: onRowClick dispara con la fila', () => {
    const onRowClick = vi.fn();
    render(
      <ResponsiveTable columns={RT_COLUMNS} rows={RT_ROWS} rowKey={(r) => r.id} onRowClick={onRowClick} />,
    );
    fireEvent.click(screen.getByText('Llavero x100'));
    expect(onRowClick).toHaveBeenCalledWith(RT_ROWS[1], 1);
  });

  it('mobile: cards automáticas — primera columna como título, mobile=false colapsada', () => {
    useIsMobile.mockReturnValue(true);
    const { container } = render(
      <ResponsiveTable columns={RT_COLUMNS} rows={RT_ROWS} rowKey={(r) => r.id} />,
    );
    expect(container.querySelector('table')).toBeNull();
    expect(screen.getByText('Soporte en L')).toBeInTheDocument();
    expect(screen.queryByText('COT-0007')).toBeNull(); // Origen no sobrevive
    expect(screen.getAllByText('Fecha')).toHaveLength(2); // label por card
  });

  it('mobile: mobileCard reemplaza la card automática', () => {
    useIsMobile.mockReturnValue(true);
    render(
      <ResponsiveTable
        columns={RT_COLUMNS}
        rows={RT_ROWS}
        rowKey={(r) => r.id}
        mobileCard={(row) => <article>custom {row.id}</article>}
      />,
    );
    expect(screen.getByText('custom a')).toBeInTheDocument();
    expect(screen.queryByText('Fecha')).toBeNull();
  });

  it('rows vacío renderiza el slot empty', () => {
    render(
      <ResponsiveTable columns={RT_COLUMNS} rows={[]} empty={<p>Sin registros</p>} />,
    );
    expect(screen.getByText('Sin registros')).toBeInTheDocument();
  });
});

// ─── DesktopPageHeader (P7) ─────────────────────────────────────────────────

describe('DesktopPageHeader', () => {
  it('renderiza eyebrow + title + count + actions', () => {
    render(
      <DesktopPageHeader
        icon={ListOrdered}
        eyebrow="Queue · Cola"
        title="Cola activa"
        count={4}
        actions={<button>Agregar</button>}
      />,
    );
    expect(screen.getByText('Queue · Cola')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Cola activa/ })).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar' })).toBeInTheDocument();
  });

  it('count=0 sí se muestra (solo null/undefined lo ocultan)', () => {
    render(<DesktopPageHeader title="X" count={0} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('sin icon ni eyebrow renderiza solo el título', () => {
    const { container } = render(<DesktopPageHeader title="Solo título" />);
    expect(screen.getByText('Solo título')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeNull();
  });
});

// ─── SearchField fix (max-width) ────────────────────────────────────────────

describe('SearchField responsive fix', () => {
  it('aplica maxWidth 100% junto al width fijo', () => {
    const { container } = render(<SearchField value="" onChange={() => {}} width={260} />);
    expect(container.firstChild.style.maxWidth).toBe('100%');
    expect(container.firstChild.style.width).toBe('260px');
  });
});

// ─── useContextMenuTrigger (touch) ──────────────────────────────────────────

function TriggerProbe({ open }) {
  const props = useContextMenuTrigger(open);
  return <div data-testid="probe" {...props} />;
}

describe('useContextMenuTrigger', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('click derecho abre con coords del evento', () => {
    const open = vi.fn();
    render(<TriggerProbe open={open} />);
    fireEvent.contextMenu(screen.getByTestId('probe'), { clientX: 120, clientY: 80 });
    expect(open).toHaveBeenCalledWith({ x: 120, y: 80 });
  });

  it('long-press de 500ms abre en la coord inicial del touch', () => {
    const open = vi.fn();
    render(<TriggerProbe open={open} />);
    fireEvent.touchStart(screen.getByTestId('probe'), { touches: [{ clientX: 50, clientY: 60 }] });
    vi.advanceTimersByTime(499);
    expect(open).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(open).toHaveBeenCalledWith({ x: 50, y: 60 });
  });

  it('soltar antes de 500ms NO abre', () => {
    const open = vi.fn();
    render(<TriggerProbe open={open} />);
    const probe = screen.getByTestId('probe');
    fireEvent.touchStart(probe, { touches: [{ clientX: 50, clientY: 60 }] });
    vi.advanceTimersByTime(300);
    fireEvent.touchEnd(probe);
    vi.advanceTimersByTime(500);
    expect(open).not.toHaveBeenCalled();
  });

  it('mover el dedo >10px (scroll) cancela el long-press', () => {
    const open = vi.fn();
    render(<TriggerProbe open={open} />);
    const probe = screen.getByTestId('probe');
    fireEvent.touchStart(probe, { touches: [{ clientX: 50, clientY: 60 }] });
    fireEvent.touchMove(probe, { touches: [{ clientX: 50, clientY: 90 }] });
    vi.advanceTimersByTime(600);
    expect(open).not.toHaveBeenCalled();
  });
});
