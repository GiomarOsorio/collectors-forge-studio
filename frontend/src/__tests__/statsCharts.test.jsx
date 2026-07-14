/**
 * @file Tests de `BarChart`/`LineChart` (issue #132) — SVG propio, sin
 * librerías. Render con series dummy + empty state.
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import BarChart from '../components/ui/BarChart';
import LineChart from '../components/ui/LineChart';

describe('BarChart', () => {
  it('muestra empty state sin datos', () => {
    render(<BarChart data={[]} />);
    expect(screen.getByText(/Sin datos en el rango seleccionado/)).toBeInTheDocument();
  });

  it('renderiza una barra por entrada con su label y valor formateado', () => {
    render(<BarChart data={[{ label: 'PLA', value: 250 }, { label: 'PETG', value: 100 }]} formatValue={(v) => `${v}g`} />);
    expect(screen.getByText('PLA')).toBeInTheDocument();
    expect(screen.getByText('PETG')).toBeInTheDocument();
    expect(screen.getByText('250g')).toBeInTheDocument();
    expect(screen.getByText('100g')).toBeInTheDocument();
  });
});

describe('LineChart', () => {
  it('muestra empty state sin datos', () => {
    render(<LineChart data={[]} />);
    expect(screen.getByText(/Sin datos en el rango seleccionado/)).toBeInTheDocument();
  });

  it('renderiza un svg con un punto por entrada de la serie', () => {
    const { container } = render(
      <LineChart data={[{ label: '2026-01-01', value: 1 }, { label: '2026-01-02', value: 3 }]} />,
    );
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(container.querySelectorAll('circle')).toHaveLength(2);
  });

  it('renderiza correctamente con un solo punto (sin dividir por cero)', () => {
    const { container } = render(<LineChart data={[{ label: '2026-01-01', value: 5 }]} />);
    expect(container.querySelectorAll('circle')).toHaveLength(1);
  });
});
