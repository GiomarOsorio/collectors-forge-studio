/**
 * @file Tipos de mantenimiento para impresoras BambuLab P2S Combo.
 *
 * Cada tipo tiene un intervalo recomendado en horas (null = sin intervalo fijo).
 * Basado en la wiki oficial de BambuLab para la P2S / P1S.
 *
 * @module config/maintenance
 */

/**
 * @typedef {Object} MaintenanceType
 * @property {string}      value          - Clave interna (snake_case)
 * @property {string}      label          - Etiqueta en español para la UI
 * @property {number|null} interval_hours - Intervalo recomendado en horas (null = sin límite)
 */

/** @type {MaintenanceType[]} */
export const MAINTENANCE_TYPES = [
  { value: 'lubricacion_xy',       label: 'Lubricación ejes XY',         interval_hours: 300  },
  { value: 'lubricacion_z',        label: 'Lubricación eje Z',            interval_hours: 900  },
  { value: 'lubricacion_poleas',   label: 'Lubricación poleas tensoras',  interval_hours: 900  },
  { value: 'limpieza_extrusor',    label: 'Limpieza de extrusor',         interval_hours: 300  },
  { value: 'limpieza_cabezal',     label: 'Limpieza del cabezal',         interval_hours: 500  },
  { value: 'limpieza_ams',         label: 'Limpieza del AMS',             interval_hours: 500  },
  { value: 'inspeccion_cuchilla',  label: 'Inspección cuchilla de corte', interval_hours: null },
  { value: 'sustitucion_nozzle',   label: 'Sustitución de nozzle',        interval_hours: 500  },
  { value: 'calibracion_completa', label: 'Calibración completa',         interval_hours: null },
  { value: 'limpieza_general',     label: 'Limpieza general',             interval_hours: 300  },
  { value: 'revision_correas',     label: 'Revisión de correas',          interval_hours: 600  },
  { value: 'otro',                 label: 'Otro',                         interval_hours: null },
];

/**
 * Devuelve el objeto MaintenanceType por su value, o undefined si no existe.
 * @param {string} value
 * @returns {MaintenanceType|undefined}
 */
export const getMaintenanceType = (value) =>
  MAINTENANCE_TYPES.find((t) => t.value === value);
