/**
 * @file Tests del import de laminado en la Calculadora: subir un `.gcode.3mf`
 * precarga peso/tiempo/cambios de color y, si el archivo trae varias placas,
 * muestra el selector para elegir cuál cotizar.
 *
 * También cubre la regresión de React error #31: un 422 de Pydantic llega con
 * `detail` como array de objetos y no debe renderizarse crudo.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockParseSlice = vi.fn();
const mockCalculate = vi.fn();

vi.mock('../services/api', () => ({
  getInventoryFilaments: () => Promise.resolve({
    data: [
      { id: 7, name: 'PETG Blanco', filament_type: 'PETG', filament_color_hex: '#FFFFFF', quantity: 1000, price_per_kg: 25 },
      { id: 9, name: 'PLA Rojo', filament_type: 'PLA', filament_color_hex: '#F72323', quantity: 800, price_per_kg: 20 },
    ],
  }),
  getInventoryItems: () => Promise.resolve({ data: [] }),
  getPrinters: () => Promise.resolve({ data: [{ id: 1, name: 'P1S', power_consumption_watts: 350 }] }),
  getSettings: () => Promise.resolve({ data: { default_margin_percent: 35 } }),
  getElectricityTariffs: () => Promise.resolve({ data: [] }),
  calculateQuote: (...a) => mockCalculate(...a),
  createQuote: vi.fn(),
  parseSliceFile: (...a) => mockParseSlice(...a),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('./cost/CostNavTabs', () => ({ default: () => null }));

import CalculatorPage from '../pages/CalculatorPage';

const PLATES = [
  {
    plate_number: 1,
    print_time_seconds: 7200,
    print_time_hours: 2,
    filament_weight_g: 151.66,
    filament_type: 'PETG',
    color_changes: 0,
    filaments: [{ filament_type: 'PETG', colour_hex: '#FFFFFF', weight_g: 151.66, length_m: 49.26 }],
    objects: ['ModeloA'],
  },
  {
    plate_number: 2,
    print_time_seconds: 5400,
    print_time_hours: 1.5,
    filament_weight_g: 80.6,
    filament_type: 'PLA',
    color_changes: 3,
    filaments: [
      { filament_type: 'PLA', colour_hex: '#F72323', weight_g: 50.6, length_m: 16.4 },
      { filament_type: 'PETG', colour_hex: '#FFFFFF', weight_g: 30, length_m: 9.7 },
    ],
    objects: ['PartC'],
  },
];

function dropFile(name = 'modelo.gcode.3mf') {
  const zone = screen.getByText(/Suelta tu \.gcode\.3mf aquí/i).closest('div');
  const file = new File(['x'], name, { type: 'application/octet-stream' });
  fireEvent.drop(zone, { dataTransfer: { files: [file] } });
  return file;
}

/**
 * Lee el valor del Stepper cuyo label contiene `label`.
 * Ojo: el Stepper pinta '' cuando el valor es 0 (UX de tipeo).
 */
function stepperValue(label) {
  const field = screen.getByText(label).closest('div').parentElement;
  return field.querySelector('input').value;
}

beforeEach(() => {
  mockParseSlice.mockReset();
  mockCalculate.mockReset();
});

describe('CalculatorPage — import de laminado', () => {
  it('precarga peso, tiempo y filamento desde la única placa', async () => {
    mockParseSlice.mockResolvedValue({ data: { filename: 'pieza.gcode.3mf', plates: [PLATES[0]] } });
    render(<CalculatorPage embedded />);
    await screen.findByText(/Importar laminado/i);

    dropFile('pieza.gcode.3mf');

    await waitFor(() => expect(mockParseSlice).toHaveBeenCalledTimes(1));
    await screen.findByText('pieza.gcode.3mf');
    await waitFor(() => expect(stepperValue('Gramos consumidos')).toBe('152'));
    expect(stepperValue('Horas')).toBe('2');
    expect(stepperValue('Minutos')).toBe(''); // Stepper muestra '' para 0
    // Una sola placa → sin selector
    expect(screen.queryByText(/placas en el archivo/i)).toBeNull();
  });

  it('con varias placas muestra el selector y carga la placa elegida', async () => {
    mockParseSlice.mockResolvedValue({ data: { filename: 'multi.gcode.3mf', plates: PLATES } });
    render(<CalculatorPage embedded />);
    await screen.findByText(/Importar laminado/i);

    dropFile('multi.gcode.3mf');

    await screen.findByText(/2 placas en el archivo/i);
    expect(screen.getByText('Placa 1')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Placa 2'));

    // Placa 2: 1h30m, principal PLA 50.6g, extra PETG 30g, 3 cambios de color
    await waitFor(() => expect(stepperValue('Gramos consumidos')).toBe('51'));
    expect(stepperValue('Horas')).toBe('1');
    expect(stepperValue('Minutos')).toBe('30');
    expect(stepperValue('Cambios de color')).toBe('3');
  });

  it('un 422 de Pydantic se muestra como texto, no como objeto (React #31)', async () => {
    mockParseSlice.mockRejectedValue({
      response: {
        status: 422,
        data: {
          detail: [
            { type: 'greater_than', loc: ['body', 'margin_percent'], msg: 'Input should be less than 100', input: 150, ctx: {} },
          ],
        },
      },
    });
    const toast = (await import('react-hot-toast')).default;
    render(<CalculatorPage embedded />);
    await screen.findByText(/Importar laminado/i);

    dropFile();

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    const arg = toast.error.mock.calls.at(-1)[0];
    expect(typeof arg).toBe('string');
    expect(arg).toContain('margin_percent');
  });
});
