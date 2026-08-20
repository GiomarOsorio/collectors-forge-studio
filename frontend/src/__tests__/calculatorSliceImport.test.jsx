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
      { id: 11, name: 'PETG Gris', filament_type: 'PETG', filament_color_hex: '#808080', quantity: 900, price_per_kg: 25 },
      { id: 12, name: 'PETG Negro', filament_type: 'PETG', filament_color_hex: '#000000', quantity: 900, price_per_kg: 25 },
      { id: 13, name: 'PETG Rojo', filament_type: 'PETG', filament_color_hex: '#FF0000', quantity: 500, price_per_kg: 25 },
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
  it('carga los 4 filamentos de una placa AMS aunque compartan tipo', async () => {
    // Caso real ryuk_Colored: 4 PETG de colores distintos. El match por tipo
    // devolvía siempre el mismo spool y se perdían 2 filas.
    const plate = {
      plate_number: 1,
      print_time_seconds: 157861,
      print_time_hours: 43.8503,
      filament_weight_g: 649.49,
      filament_type: 'PETG',
      color_changes: 1051,
      filaments: [
        { filament_type: 'PETG', colour_hex: '#808080', weight_g: 357.45, length_m: 118.89 },
        { filament_type: 'PETG', colour_hex: '#000000', weight_g: 240.4, length_m: 79.96 },
        { filament_type: 'PETG', colour_hex: '#FF0000', weight_g: 32.38, length_m: 10.77 },
        { filament_type: 'PETG', colour_hex: '#FF6600', weight_g: 19.26, length_m: 6.31 },
      ],
      objects: ['ryuk.stl'],
    };
    mockParseSlice.mockResolvedValue({ data: { filename: 'ryuk.gcode.3mf', plates: [plate] } });
    render(<CalculatorPage embedded />);
    await screen.findByText(/Importar laminado/i);

    dropFile('ryuk.gcode.3mf');

    // Principal = el de mayor gramaje (gris 357.45 → 358, ceil)
    await waitFor(() => expect(stepperValue('Gramos consumidos')).toBe('358'));
    // 3 filas adicionales, una por cada filamento restante
    const filas = screen.getAllByLabelText('Quitar filamento');
    expect(filas).toHaveLength(3);
    // El naranja #FF6600 no está en inventario: fila presente igual, 19.26 → 20
    const gramos = screen
      .getAllByRole('spinbutton')
      .map((i) => i.value);
    expect(gramos).toContain('241');  // negro 240.4 → ceil
    expect(gramos).toContain('33');   // rojo 32.38 → ceil
    expect(gramos).toContain('20');   // naranja 19.26 → ceil
  });

  it('no topa los cambios de color (placa AMS con 1051)', async () => {
    const plate = {
      plate_number: 1,
      print_time_seconds: 157861,
      print_time_hours: 43.8503,
      filament_weight_g: 649.49,
      filament_type: 'PETG',
      color_changes: 1051,
      filaments: [{ filament_type: 'PETG', colour_hex: '#808080', weight_g: 649.49, length_m: 200 }],
      objects: ['ryuk.stl'],
    };
    mockParseSlice.mockResolvedValue({ data: { filename: 'ryuk.gcode.3mf', plates: [plate] } });
    render(<CalculatorPage embedded />);
    await screen.findByText(/Importar laminado/i);

    dropFile('ryuk.gcode.3mf');

    await waitFor(() => expect(stepperValue('Cambios de color')).toBe('1051'));
  });
});
