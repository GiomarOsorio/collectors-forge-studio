/**
 * @file Presets rápidos para crear recordatorios de mantenimiento (issue #138).
 *
 * Sugerencias basadas en la BambuLab P2S del estudio — solo rellenan el
 * formulario de alta, son editables antes de guardar.
 *
 * @module pages/maintenance/presets
 */

/**
 * @typedef {Object} SchedulePreset
 * @property {string}                     task_name
 * @property {'print_hours'|'days'}        interval_type
 * @property {number}                      interval_value
 */

/** @type {SchedulePreset[]} */
export const SCHEDULE_PRESETS = [
  { task_name: 'Lubricar ejes X/Y', interval_type: 'print_hours', interval_value: 300 },
  { task_name: 'Lubricar husillos Z', interval_type: 'print_hours', interval_value: 600 },
  { task_name: 'Limpiar hotend / boquilla', interval_type: 'print_hours', interval_value: 250 },
  { task_name: 'Cambiar boquilla', interval_type: 'print_hours', interval_value: 1000 },
  { task_name: 'Tensar correas', interval_type: 'print_hours', interval_value: 500 },
  { task_name: 'Limpiar placa de impresión', interval_type: 'days', interval_value: 15 },
  { task_name: 'Grasa de rieles', interval_type: 'days', interval_value: 90 },
];
