/**
 * @file Tests de los primitives v2 (port `claude design/components.jsx`).
 *
 * Cubre PageShell, PageHeader, KPITile, StatusPill, EmptyState (v2),
 * DropZone, ToolbarRow, SearchField, ProgressBar y la nueva API
 * (eyebrow + footer) del DetailDrawer.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Box, Cpu, Package, Upload } from 'lucide-react';

import {
  DetailDrawer,
  DropZone,
  EmptyState,
  KPITile,
  PageHeader,
  PageShell,
  ProgressBar,
  SearchField,
  STATUS_PRESETS,
  StatusPill,
  ToolbarRow,
} from '../components/ui';

// ─── PageShell ──────────────────────────────────────────────────────────────

describe('PageShell', () => {
  it('renderiza children y expone --page-accent en style inline', () => {
    const { container } = render(<PageShell appAccent="#FF0000">hi</PageShell>);
    const root = container.firstChild;
    expect(root.style.getPropertyValue('--page-accent')).toBe('#FF0000');
    expect(root).toHaveTextContent('hi');
  });

  it('usa accent default cuando no se pasa', () => {
    const { container } = render(<PageShell>x</PageShell>);
    const root = container.firstChild;
    expect(root.style.getPropertyValue('--page-accent')).toBe('var(--color-app-inventory)');
  });
});

// ─── PageHeader ─────────────────────────────────────────────────────────────

describe('PageHeader', () => {
  it('renderiza title obligatorio', () => {
    render(<PageHeader title="Filamentos" />);
    expect(screen.getByRole('heading', { name: 'Filamentos' })).toBeInTheDocument();
  });

  it('renderiza appName como eyebrow', () => {
    render(<PageHeader title="X" appName="Inventario" />);
    expect(screen.getByText('Inventario')).toBeInTheDocument();
  });

  it('renderiza subtitle opcional', () => {
    render(<PageHeader title="X" subtitle="Descripción larga" />);
    expect(screen.getByText('Descripción larga')).toBeInTheDocument();
  });

  it('renderiza icon en el badge cuando se pasa', () => {
    const { container } = render(<PageHeader title="X" icon={Package} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renderiza actions slot a la derecha', () => {
    render(
      <PageHeader title="X" actions={<button>Save</button>} />,
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('renderiza children slot (debajo de subtitle)', () => {
    render(<PageHeader title="X"><p>extra</p></PageHeader>);
    expect(screen.getByText('extra')).toBeInTheDocument();
  });
});

// ─── KPITile ────────────────────────────────────────────────────────────────

describe('KPITile', () => {
  it('renderiza label + value + unit + sub', () => {
    render(<KPITile label="Spools" value="22" unit="docs" sub="hace 12s" />);
    expect(screen.getByText('Spools')).toBeInTheDocument();
    expect(screen.getByText('22')).toBeInTheDocument();
    expect(screen.getByText('docs')).toBeInTheDocument();
    expect(screen.getByText('hace 12s')).toBeInTheDocument();
  });

  it('warn=true colorea el value en amber', () => {
    render(<KPITile label="x" value="5" warn />);
    const val = screen.getByText('5');
    expect(val.style.color).toContain('forge-amber');
  });

  it('trend positivo verde con TrendingUp', () => {
    const { container } = render(<KPITile label="x" value="1" trend="+4%" />);
    expect(screen.getByText('4%')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('trend negativo rojo con TrendingDown', () => {
    const { container } = render(<KPITile label="x" value="1" trend="-2%" />);
    expect(screen.getByText('2%')).toBeInTheDocument();
    // Ícono TrendingDown renderiza un svg distinto al TrendingUp — chequear que
    // hay 2 svgs (el del trend + el del icon prop si lo hubiera). Solo el del trend.
    expect(container.querySelectorAll('svg').length).toBe(1);
  });

  it('renderiza icon prop opcional', () => {
    const { container } = render(<KPITile label="x" value="1" icon={Cpu} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});

// ─── StatusPill ─────────────────────────────────────────────────────────────

describe('StatusPill', () => {
  it('tone default neutral', () => {
    render(<StatusPill>NEUTRAL</StatusPill>);
    const pill = screen.getByText('NEUTRAL');
    expect(pill.style.color).toBeTruthy();
  });

  it('tone printing aplica colores azul', () => {
    render(<StatusPill tone="printing">IMP</StatusPill>);
    const pill = screen.getByText('IMP');
    expect(pill.style.color).toBe('rgb(59, 130, 246)');
  });

  it('tone danger aplica colores rojo', () => {
    render(<StatusPill tone="danger">FAIL</StatusPill>);
    const pill = screen.getByText('FAIL');
    expect(pill.style.color).toBe('rgb(248, 113, 113)');
  });

  it('size lg usa text-[11px]', () => {
    render(<StatusPill size="lg">x</StatusPill>);
    const pill = screen.getByText('x');
    expect(pill.className).toContain('text-[11px]');
  });

  it('renderiza icon opcional', () => {
    const { container } = render(<StatusPill icon={Cpu}>x</StatusPill>);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('STATUS_PRESETS expone los 9 tonos esperados', () => {
    expect(Object.keys(STATUS_PRESETS).sort()).toEqual([
      'active', 'danger', 'done', 'info', 'neutral',
      'paused', 'pending', 'printing', 'warn',
    ]);
  });
});

// ─── EmptyState (v2) ────────────────────────────────────────────────────────

describe('EmptyState v2', () => {
  it('renderiza icon + title + hint + action', () => {
    render(
      <EmptyState
        icon={Box}
        title="Vacío"
        hint="Sin datos aún"
        action={<button>Crear</button>}
      />,
    );
    expect(screen.getByText('Vacío')).toBeInTheDocument();
    expect(screen.getByText('Sin datos aún')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear' })).toBeInTheDocument();
  });

  it('hint y action son opcionales', () => {
    render(<EmptyState icon={Box} title="Solo title" />);
    expect(screen.getByText('Solo title')).toBeInTheDocument();
  });
});

// ─── DropZone ───────────────────────────────────────────────────────────────

describe('DropZone', () => {
  it('renderiza hint + cta', () => {
    render(<DropZone hint="Tira archivos" cta="Buscar" />);
    expect(screen.getByText('Tira archivos')).toBeInTheDocument();
    expect(screen.getByText('Buscar')).toBeInTheDocument();
  });

  it('meta default deriva del accept', () => {
    render(<DropZone accept=".3mf" />);
    expect(screen.getByText(/\.3mf/)).toBeInTheDocument();
  });

  it('input file tiene atributo accept correcto', () => {
    const { container } = render(<DropZone accept=".stl,.3mf" />);
    const input = container.querySelector('input[type="file"]');
    expect(input).toHaveAttribute('accept', '.stl,.3mf');
  });

  it('onFiles dispara cuando se select archivo', () => {
    const onFiles = vi.fn();
    const { container } = render(<DropZone onFiles={onFiles} />);
    const input = container.querySelector('input[type="file"]');
    const file = new File(['x'], 'test.3mf', { type: 'model/3mf' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFiles).toHaveBeenCalledTimes(1);
  });
});

// ─── ToolbarRow ─────────────────────────────────────────────────────────────

describe('ToolbarRow', () => {
  it('renderiza children con border-bottom + bg', () => {
    const { container } = render(
      <ToolbarRow>
        <button>x</button>
      </ToolbarRow>,
    );
    expect(container.firstChild.className).toContain('border-b');
    expect(screen.getByRole('button', { name: 'x' })).toBeInTheDocument();
  });
});

// ─── SearchField ────────────────────────────────────────────────────────────

describe('SearchField', () => {
  it('renderiza input con placeholder', () => {
    render(<SearchField placeholder="Buscar pieza" value="" onChange={() => {}} />);
    expect(screen.getByPlaceholderText('Buscar pieza')).toBeInTheDocument();
  });

  it('dispara onChange al teclear', () => {
    const onChange = vi.fn();
    render(<SearchField value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'abc' } });
    expect(onChange).toHaveBeenCalledWith('abc');
  });

  it('renderiza ícono Search', () => {
    const { container } = render(<SearchField value="" onChange={() => {}} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});

// ─── ProgressBar ────────────────────────────────────────────────────────────

describe('ProgressBar', () => {
  it('width del fill = pct correcto', () => {
    const { container } = render(<ProgressBar value={50} max={100} />);
    const fill = container.firstChild.firstChild;
    expect(fill.style.width).toBe('50%');
  });

  it('clampea value > max a 100%', () => {
    const { container } = render(<ProgressBar value={150} max={100} />);
    expect(container.firstChild.firstChild.style.width).toBe('100%');
  });

  it('value negativo se clampa a 0%', () => {
    const { container } = render(<ProgressBar value={-10} max={100} />);
    expect(container.firstChild.firstChild.style.width).toBe('0%');
  });

  it('warn cuando ratio ≤ warnAt aplica forge-amber', () => {
    const { container } = render(<ProgressBar value={15} max={100} warnAt={0.2} />);
    const fill = container.firstChild.firstChild;
    expect(fill.style.background).toContain('forge-amber');
  });

  it('sin warn usa accent', () => {
    const { container } = render(<ProgressBar value={80} max={100} accent="#3B82F6" />);
    const fill = container.firstChild.firstChild;
    // jsdom normaliza hex a rgb
    expect(fill.style.background).toBe('rgb(59, 130, 246)');
  });
});

// ─── DetailDrawer (v2 API: eyebrow + footer) ────────────────────────────────

describe('DetailDrawer v2 API', () => {
  it('renderiza eyebrow sobre el title', () => {
    render(
      <DetailDrawer open={true} onClose={() => {}} title="Detalle" eyebrow="ITEM-0042">
        body
      </DetailDrawer>,
    );
    expect(screen.getByText('ITEM-0042')).toBeInTheDocument();
    expect(screen.getByText('Detalle')).toBeInTheDocument();
  });

  it('renderiza footer slot fijo abajo', () => {
    render(
      <DetailDrawer open={true} onClose={() => {}} title="X" footer={<button>Save</button>}>
        body
      </DetailDrawer>,
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('no renderiza footer si no se pasa', () => {
    render(
      <DetailDrawer open={true} onClose={() => {}} title="X">
        body
      </DetailDrawer>,
    );
    const footers = document.querySelectorAll('footer');
    expect(footers.length).toBe(0);
  });

  it('Esc cierra el drawer', () => {
    const onClose = vi.fn();
    render(
      <DetailDrawer open={true} onClose={onClose} title="X">
        body
      </DetailDrawer>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  // ─── REGRESIÓN-GUARD: open=false NO debe renderizar NADA ──────────────
  // Bug histórico: drawer/aside quedaba visible en pantalla cuando
  // open=false porque translate-x-full no se aplicaba consistentemente.
  // El fix: `if (!open) return null` al inicio del componente.

  // Nota: DetailDrawer renderea en un portal a document.body (para evadir
  // bugs de position:fixed dentro de parents con transform). Por eso los
  // queries van contra `document.body`, no contra `container`.

  it('REGRESIÓN: con open=false NO renderiza ningún elemento de drawer', () => {
    render(
      <DetailDrawer open={false} onClose={() => {}} title="X" footer={<button>Save</button>}>
        body content que no se debe ver
      </DetailDrawer>,
    );
    expect(document.body.querySelector('aside')).toBeNull();
    expect(document.body.querySelector('footer')).toBeNull();
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body).not.toHaveTextContent('body content');
    expect(document.body).not.toHaveTextContent('Save');
  });

  it('REGRESIÓN: re-abrir muestra de nuevo, re-cerrar oculta', () => {
    const { rerender } = render(
      <DetailDrawer open={true} onClose={() => {}} title="abierto">
        contenido
      </DetailDrawer>,
    );
    expect(document.body.querySelector('aside')).not.toBeNull();
    expect(document.body).toHaveTextContent('contenido');
    rerender(
      <DetailDrawer open={false} onClose={() => {}} title="abierto">
        contenido
      </DetailDrawer>,
    );
    expect(document.body.querySelector('aside')).toBeNull();
    expect(document.body).not.toHaveTextContent('contenido');
    rerender(
      <DetailDrawer open={true} onClose={() => {}} title="abierto">
        contenido
      </DetailDrawer>,
    );
    expect(document.body.querySelector('aside')).not.toBeNull();
    expect(document.body).toHaveTextContent('contenido');
  });

  it('REGRESIÓN: footer del drawer es visible cuando open=true', () => {
    // Bug histórico: el footer con Cancelar/Guardar no se veía en desktop
    // por bug de flex layout. CSS Grid fix garantiza visibilidad.
    render(
      <DetailDrawer
        open={true}
        onClose={() => {}}
        title="Edit"
        footer={
          <>
            <button>Cancelar</button>
            <button>Guardar cambios</button>
          </>
        }
      >
        body
      </DetailDrawer>,
    );
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument();
  });

  it('REGRESIÓN: footer está pinned al bottom del aside (position:absolute)', () => {
    render(
      <DetailDrawer open={true} onClose={() => {}} title="X" footer={<span>F</span>}>
        body
      </DetailDrawer>,
    );
    const footerEl = document.body.querySelector('footer');
    expect(footerEl).not.toBeNull();
    expect(footerEl.style.position).toBe('absolute');
    expect(footerEl.style.bottom).toBe('0px');
  });

  it('REGRESIÓN: body del drawer está absolute con bottom=FOOTER (con footer) o 0 (sin footer)', () => {
    const { rerender } = render(
      <DetailDrawer open={true} onClose={() => {}} title="X" footer={<span>F</span>}>
        body
      </DetailDrawer>,
    );
    const bodyDiv = document.body.querySelector('aside > div');
    expect(bodyDiv).not.toBeNull();
    expect(bodyDiv.style.position).toBe('absolute');
    expect(bodyDiv.style.bottom).toBe('64px'); // FOOTER_HEIGHT
    expect(bodyDiv.style.overflowY).toBe('auto');

    rerender(
      <DetailDrawer open={true} onClose={() => {}} title="X">
        body sin footer
      </DetailDrawer>,
    );
    const bodyDivNoFooter = document.body.querySelector('aside > div');
    expect(bodyDivNoFooter.style.bottom).toBe('0px'); // sin footer
  });

  it('REGRESIÓN: DetailDrawer renderea en portal a document.body', () => {
    // El portal asegura que el position:fixed del aside funciona
    // correctamente sin importar si algún parent tiene transform.
    const { container } = render(
      <DetailDrawer open={true} onClose={() => {}} title="X">
        body
      </DetailDrawer>,
    );
    // El container donde React montó NO contiene el aside (está en body)
    expect(container.querySelector('aside')).toBeNull();
    // Pero document.body sí
    expect(document.body.querySelector('aside')).not.toBeNull();
  });
});

// ─── MobileSheet REGRESIÓN-GUARD ────────────────────────────────────────

describe('MobileSheet REGRESIÓN-GUARD', () => {
  it('open=false NO renderiza el sheet', async () => {
    const { MobileSheet } = await import('../components/ui');
    render(
      <MobileSheet open={false} onClose={() => {}} title="X">
        no se debe ver
      </MobileSheet>,
    );
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body).not.toHaveTextContent('no se debe ver');
  });

  it('open=true renderiza el sheet + onEdit icon button cuando se provee', async () => {
    const { MobileSheet } = await import('../components/ui');
    const onEdit = vi.fn();
    render(
      <MobileSheet open={true} onClose={() => {}} title="X" onEdit={onEdit}>
        contenido
      </MobileSheet>,
    );
    expect(screen.getByText('contenido')).toBeInTheDocument();
    const editBtn = screen.getByRole('button', { name: 'Editar' });
    editBtn.click();
    expect(onEdit).toHaveBeenCalled();
  });
});
