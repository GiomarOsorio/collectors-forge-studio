/**
 * @file Tipos de mantenimiento para impresoras BambuLab P2S Combo.
 *
 * Cada tipo tiene:
 * - Intervalo recomendado en horas (null = sin intervalo fijo)
 * - Descripción breve de qué implica el mantenimiento
 * - URL al wiki oficial de BambuLab P2S (null = sin página específica)
 *
 * @module config/maintenance
 */

/**
 * @typedef {Object} MaintenanceType
 * @property {string}      value          - Clave interna (snake_case)
 * @property {string}      label          - Etiqueta en español para la UI
 * @property {number|null} interval_hours - Intervalo recomendado en horas
 * @property {string}      description    - Qué implica este mantenimiento
 * @property {string|null} wiki_url       - URL al wiki oficial de BambuLab
 */

/** @type {MaintenanceType[]} */
export const MAINTENANCE_TYPES = [
  {
    value: 'lubricacion_xy',
    label: 'Lubricación ejes XY',
    interval_hours: 300,
    description: 'Limpiar y lubricar los ejes lineales X e Y con aceite de máquina. Mover el cabezal manualmente 3–5 veces a lo largo de cada eje para distribuir uniformemente el lubricante.',
    wiki_url: 'https://wiki.bambulab.com/en/p2s/maintenance/lubricate-x-y-z-axis',
  },
  {
    value: 'lubricacion_z',
    label: 'Lubricación eje Z',
    interval_hours: 900,
    description: 'Limpiar el husillo del eje Z con un paño sin pelusa y aplicar grasa de husillo. El eje Z requiere grasa (no aceite) por su mayor carga y baja velocidad.',
    wiki_url: 'https://wiki.bambulab.com/en/p2s/maintenance/lubricate-x-y-z-axis',
  },
  {
    value: 'lubricacion_poleas',
    label: 'Lubricación poleas tensoras',
    interval_hours: 900,
    description: 'Aplicar grasa en las poleas tensoras (idler pulleys) de los ejes XY. Inspeccionar visualmente si hay desgaste o ruido anormal al rotar.',
    wiki_url: 'https://wiki.bambulab.com/en/p2s/maintenance/idler-pulley-lubrication',
  },
  {
    value: 'limpieza_extrusor',
    label: 'Limpieza de extrusor',
    interval_hours: 300,
    description: 'Soplar con aire comprimido el engranaje amarillo del extrusor para eliminar polvo y residuos de filamento. Inspeccionar el sensor de filamento y limpiar el área de contacto.',
    wiki_url: 'https://wiki.bambulab.com/en/p2s/maintenance/extruder-cleaning-guide',
  },
  {
    value: 'limpieza_cabezal',
    label: 'Limpieza del cabezal',
    interval_hours: 500,
    description: 'Limpiar la punta de la boquilla y la calceta de silicona con un paño mientras está caliente. Retirar residuos carbonizados. Inspeccionar el calcetín y reemplazarlo si está deteriorado.',
    wiki_url: 'https://wiki.bambulab.com/en/p2s/maintenance/replace-hotend-and-silicone-sock',
  },
  {
    value: 'limpieza_ams',
    label: 'Limpieza del AMS',
    interval_hours: 500,
    description: 'Limpiar el hub de filamentos del AMS 2 Pro, inspeccionar los tubos PTFE por desgaste, limpiar los funnels cerámicos y verificar los imanes de los 4 slots. Soplar con aire comprimido.',
    wiki_url: 'https://wiki.bambulab.com/en/ams-2-pro/maintenance/basic-maintenance',
  },
  {
    value: 'inspeccion_cuchilla',
    label: 'Inspección cuchilla de corte',
    interval_hours: null,
    description: 'Inspeccionar la cuchilla del cortador de filamento. Verificar que el resorte de retorno funciona correctamente y que la palanca no está atascada. Reemplazar si el corte es irregular.',
    wiki_url: 'https://wiki.bambulab.com/en/p2s/maintenance/period-maintenance',
  },
  {
    value: 'sustitucion_nozzle',
    label: 'Sustitución de nozzle',
    interval_hours: 500,
    description: 'Reemplazar la boquilla cuando haya desgaste visible, impresión irregular o atascos frecuentes. El hotend de la P2S es de herramienta libre — se extrae el conjunto completo. Usar guantes de protección térmica.',
    wiki_url: 'https://wiki.bambulab.com/en/p2s/maintenance/replace-hotend-and-silicone-sock',
  },
  {
    value: 'calibracion_completa',
    label: 'Calibración completa',
    interval_hours: null,
    description: 'Ejecutar calibración completa desde la pantalla táctil o Bambu Studio: cancelación de ruido de motor, compensación de vibración (resonance compensation) y nivelación automática de cama.',
    wiki_url: 'https://wiki.bambulab.com/en/p2s/maintenance/period-maintenance',
  },
  {
    value: 'limpieza_general',
    label: 'Limpieza general',
    interval_hours: 300,
    description: 'Limpiar el interior de la cámara, la placa de impresión (isopropanol 95%), los sensores ópticos de filamento, las toberas de enfriamiento del cabezal y el exterior de la impresora.',
    wiki_url: 'https://wiki.bambulab.com/en/p2s/maintenance/period-maintenance',
  },
  {
    value: 'revision_correas',
    label: 'Revisión de correas',
    interval_hours: 600,
    description: 'Inspeccionar el tensado de las correas XY y el cinturón Z. Una correa floja produce artefactos en la impresión (ringing). Limpiar con paño seco si hay suciedad. Reemplazar si hay grietas.',
    wiki_url: 'https://wiki.bambulab.com/en/p2s/maintenance/replace-z-belt',
  },
  {
    value: 'otro',
    label: 'Otro',
    interval_hours: null,
    description: 'Mantenimiento personalizado no incluido en las categorías anteriores.',
    wiki_url: 'https://wiki.bambulab.com/en/p2s/maintenance',
  },
];

/**
 * Devuelve el objeto MaintenanceType por su value, o undefined si no existe.
 * @param {string} value
 * @returns {MaintenanceType|undefined}
 */
export const getMaintenanceType = (value) =>
  MAINTENANCE_TYPES.find((t) => t.value === value);
