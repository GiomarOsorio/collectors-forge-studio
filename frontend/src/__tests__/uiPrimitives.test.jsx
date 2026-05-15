/**
 * @file Tests de los primitives de `components/ui/` (Claude Design port).
 *
 * Cubre comportamiento clave (render, variants, click handlers, accesibilidad)
 * de Button, Card, Chip, Input, Sparkline, Swatch. Los componentes con efectos
 * (DetailDrawer, MobileSheet, KPI) tienen tests separados.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Plus, Search } from 'lucide-react';

import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Chip from '../components/ui/Chip';
import Input from '../components/ui/Input';
import Sparkline from '../components/ui/Sparkline';
import Swatch from '../components/ui/Swatch';

// ─── Button ─────────────────────────────────────────────────────────────────

describe('Button primitive', () => {
  it('renderiza children y aplica clase base .btn', () => {
    render(<Button>Aceptar</Button>);
    const btn = screen.getByRole('button', { name: 'Aceptar' });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveClass('btn');
  });

  it('variant primary añade .btn-primary', () => {
    render(<Button variant="primary">OK</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-primary');
  });

  it('variant ghost añade .btn-ghost', () => {
    render(<Button variant="ghost">X</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-ghost');
  });

  it('size sm añade .btn-sm', () => {
    render(<Button size="sm">Sm</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-sm');
  });

  it('iconOnly añade .btn-icon (square padding)', () => {
    render(<Button iconOnly icon={Plus} aria-label="agregar" />);
    expect(screen.getByLabelText('agregar')).toHaveClass('btn-icon');
  });

  it('renderiza el ícono cuando se pasa prop icon', () => {
    const { container } = render(<Button icon={Plus}>Agregar</Button>);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('dispara onClick', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('propaga prop disabled', () => {
    render(<Button disabled>X</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('type=button por default (no submit accidental dentro de form)', () => {
    render(<Button>X</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });
});

// ─── Card ───────────────────────────────────────────────────────────────────

describe('Card primitive', () => {
  it('renderiza children con clase .card', () => {
    const { container } = render(<Card>Hola</Card>);
    expect(container.firstChild).toHaveClass('card');
    expect(container.firstChild).toHaveTextContent('Hola');
  });

  it('interactive añade .card-interactive', () => {
    const { container } = render(<Card interactive>X</Card>);
    expect(container.firstChild).toHaveClass('card-interactive');
  });

  it('as=button renderiza un <button>', () => {
    render(<Card as="button">Click</Card>);
    expect(screen.getByRole('button', { name: 'Click' })).toBeInTheDocument();
  });

  it('default es <div>', () => {
    const { container } = render(<Card>X</Card>);
    expect(container.firstChild.tagName).toBe('DIV');
  });

  it('propaga className extra', () => {
    const { container } = render(<Card className="p-8">X</Card>);
    expect(container.firstChild).toHaveClass('p-8', 'card');
  });
});

// ─── Chip ───────────────────────────────────────────────────────────────────

describe('Chip primitive', () => {
  it('renderiza con clase .chip', () => {
    render(<Chip>PLA</Chip>);
    expect(screen.getByRole('button', { name: 'PLA' })).toHaveClass('chip');
  });

  it('active añade .chip-active', () => {
    render(<Chip active>PLA</Chip>);
    expect(screen.getByRole('button')).toHaveClass('chip-active');
  });

  it('dispara onClick', () => {
    const onClick = vi.fn();
    render(<Chip onClick={onClick}>X</Chip>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });

  it('renderiza ícono opcional', () => {
    const { container } = render(<Chip icon={Search}>buscar</Chip>);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});

// ─── Input ──────────────────────────────────────────────────────────────────

describe('Input primitive', () => {
  it('renderiza input con clase .input', () => {
    render(<Input placeholder="nombre" />);
    expect(screen.getByPlaceholderText('nombre')).toHaveClass('input');
  });

  it('asocia label vía htmlFor=id', () => {
    render(<Input label="Email" id="email-input" />);
    const input = screen.getByLabelText('Email');
    expect(input.id).toBe('email-input');
  });

  it('genera id automático cuando no se pasa', () => {
    render(<Input label="Nombre" />);
    const label = screen.getByText('Nombre');
    expect(label.getAttribute('for')).toBeTruthy();
  });

  it('muestra hint', () => {
    render(<Input hint="Sin espacios" />);
    expect(screen.getByText('Sin espacios')).toBeInTheDocument();
  });

  it('error reemplaza hint y aplica borde rosa', () => {
    render(<Input hint="Sin espacios" error="Inválido" />);
    expect(screen.getByText('Inválido')).toBeInTheDocument();
    expect(screen.queryByText('Sin espacios')).toBeNull();
    expect(screen.getByRole('textbox')).toHaveClass('border-rose-500/60');
  });

  it('iconLeft añade padding y renderiza el ícono', () => {
    const { container } = render(<Input iconLeft={Search} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveClass('pl-8');
  });
});

// ─── Sparkline ──────────────────────────────────────────────────────────────

describe('Sparkline primitive', () => {
  it('renderiza SVG vacío para data < 2 puntos', () => {
    const { container } = render(<Sparkline data={[5]} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(container.querySelector('polyline')).toBeNull();
  });

  it('renderiza polyline para data válida', () => {
    const { container } = render(<Sparkline data={[1, 5, 3, 8, 2]} />);
    expect(container.querySelector('polyline')).toBeInTheDocument();
    expect(container.querySelector('polygon')).toBeInTheDocument(); // área
    expect(container.querySelector('circle')).toBeInTheDocument(); // punto final
  });

  it('usa color custom', () => {
    const { container } = render(<Sparkline data={[1, 2, 3]} color="#FF0000" />);
    const polyline = container.querySelector('polyline');
    expect(polyline).toHaveAttribute('stroke', '#FF0000');
  });

  it('respeta width y height props', () => {
    const { container } = render(<Sparkline data={[1, 2, 3]} width={200} height={50} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '200');
    expect(svg).toHaveAttribute('height', '50');
  });
});

// ─── Swatch ─────────────────────────────────────────────────────────────────

describe('Swatch primitive', () => {
  it('renderiza con color válido (gradient con el color)', () => {
    const { container } = render(<Swatch color="#1D4ED8" />);
    const swatch = container.firstChild;
    // jsdom normaliza hex a rgb — chequear el valor rgb equivalente
    expect(swatch.style.background).toContain('rgb(29, 78, 216)');
    expect(swatch.style.background).toContain('radial-gradient');
  });

  it('usa color fallback gris si color es null', () => {
    const { container } = render(<Swatch color={null} />);
    const swatch = container.firstChild;
    expect(swatch.style.background).toBeTruthy();
  });

  it('aplica size en width/height', () => {
    const { container } = render(<Swatch color="#000000" size={60} />);
    const swatch = container.firstChild;
    expect(swatch.style.width).toBe('60px');
    expect(swatch.style.height).toBe('60px');
  });

  it('nivel critical añade clase pulse-soft al ring', () => {
    const { container } = render(<Swatch color="#FF0000" level="critical" />);
    expect(container.querySelector('.pulse-soft')).toBeInTheDocument();
  });

  it('nivel low añade ring sin pulse', () => {
    const { container } = render(<Swatch color="#FF0000" level="low" />);
    expect(container.querySelector('.pulse-soft')).toBeNull();
    // El ring tiene estilo con border ámbar
    const rings = container.querySelectorAll('div');
    const hasRing = Array.from(rings).some((d) =>
      d.style.border?.includes('rgba') || d.style.border?.includes('#FBBF24'),
    );
    expect(hasRing).toBe(true);
  });

  it('nivel ok no muestra ring de alerta', () => {
    const { container } = render(<Swatch color="#1D4ED8" level="ok" />);
    expect(container.querySelector('.pulse-soft')).toBeNull();
  });
});
