/**
 * @file Tipos de mantenimiento para impresoras BambuLab P2S Combo.
 *
 * Cada tipo tiene:
 * - Intervalo recomendado en horas (null = sin intervalo fijo o basado en condición)
 * - Descripción breve de qué implica el mantenimiento
 * - URL al wiki oficial de BambuLab P2S (null = sin página específica)
 * - Lista de consumibles sugeridos (se pre-llenan al crear un registro)
 *
 * @module config/maintenance
 */

/**
 * @typedef {Object} SuggestedItem
 * @property {string} name     - Nombre del consumible
 * @property {number} quantity - Cantidad sugerida (editable por el usuario)
 */

/**
 * @typedef {Object} MaintenanceType
 * @property {string}         value           - Clave interna (snake_case)
 * @property {string}         label           - Etiqueta en español para la UI
 * @property {number|null}    interval_hours  - Intervalo recomendado en horas
 * @property {string}         description     - Qué implica este mantenimiento
 * @property {string|null}    wiki_url        - URL al wiki oficial de BambuLab
 * @property {SuggestedItem[]} suggested_items - Consumibles sugeridos al registrar
 */

/** @type {MaintenanceType[]} */
export const MAINTENANCE_TYPES = [
  // ── Sistema de movimiento ─────────────────────────────────────────────────
  {
    value: 'lubricacion_xy',
    label: 'Lubricación ejes XY',
    interval_hours: 300,
    description: 'Limpiar con IPA y lubricar los ejes lineales X e Y con aceite de máquina. Mover el cabezal manualmente 3–5 veces a lo largo de cada eje para distribuir uniformemente el lubricante.',
    wiki_url: 'https://wiki.bambulab.com/en/p2s/maintenance/lubricate-x-y-z-axis',
    suggested_items: [
      { name: 'Aceite lubricante (Super Lube 52004)', quantity: 1 },
      { name: 'Paño sin pelusa', quantity: 2 },
    ],
  },
  {
    value: 'lubricacion_z',
    label: 'Lubricación eje Z',
    interval_hours: 900,
    description: 'Limpiar el husillo del eje Z con IPA y paño sin pelusa, luego aplicar grasa de husillo. Los linear rods del Z llevan aceite (distinto a los lead screws). Mover la cama arriba/abajo varias veces para distribuir.',
    wiki_url: 'https://wiki.bambulab.com/en/p2s/maintenance/lubricate-x-y-z-axis',
    suggested_items: [
      { name: 'Grasa para husillo (Super Lube PTFE Grease)', quantity: 1 },
      { name: 'Aceite lubricante (Super Lube 52004)', quantity: 1 },
      { name: 'Paño sin pelusa', quantity: 1 },
    ],
  },
  {
    value: 'lubricacion_poleas',
    label: 'Lubricación poleas tensoras',
    interval_hours: 900,
    description: 'Aplicar 1–2 gotas de aceite en los puntos de contacto eje-rodamiento de las poleas tensoras XY. Rotar manualmente para verificar operación sin ruido. Si hay ruido o resistencia, hacer antes del intervalo.',
    wiki_url: 'https://wiki.bambulab.com/en/p2s/maintenance/idler-pulley-lubrication',
    suggested_items: [
      { name: 'Aceite lubricante (Super Lube 52004)', quantity: 1 },
    ],
  },
  {
    value: 'revision_correas',
    label: 'Revisión de correas',
    interval_hours: 600,
    description: 'Verificar y re-tensionar correas XY y correa Z. La impresora detecta la tensión via vibration compensation — si falla calibración o imprime elipses, tensionar. Para la Z: inclinar impresora, aflojar tornillo H2.0, jalar 3–5 veces. Recalibrar tras cualquier ajuste.',
    wiki_url: 'https://wiki.bambulab.com/en/p2s/maintenance/replace-z-belt',
    suggested_items: [],
  },
  // ── Toolhead ─────────────────────────────────────────────────────────────
  {
    value: 'limpieza_extrusor',
    label: 'Limpieza de extrusor',
    interval_hours: 300,
    description: 'Soplar con aire comprimido el engranaje del extrusor DynaSense para eliminar polvo y residuos de filamento. Inspeccionar el sensor de filamento y limpiar el área de contacto. Lubricar engranajes con grasa si se desmonta.',
    wiki_url: 'https://wiki.bambulab.com/en/p2s/maintenance/extruder-cleaning-guide',
    suggested_items: [],
  },
  {
    value: 'limpieza_cabezal',
    label: 'Limpieza del cabezal',
    interval_hours: 500,
    description: 'Limpiar la punta de la boquilla mientras está caliente. Inspeccionar la calceta de silicona y el silicone wiping pad. Soplar con aire comprimido las toberas de enfriamiento. Revisar part cooling fan y hotend fan por acumulación de debris.',
    wiki_url: 'https://wiki.bambulab.com/en/p2s/maintenance/replace-hotend-and-silicone-sock',
    suggested_items: [
      { name: 'Paño de microfibra', quantity: 1 },
    ],
  },
  {
    value: 'calceta_silicona',
    label: 'Reemplazo calceta de silicona',
    interval_hours: null,
    description: 'Reemplazar la calceta (silicone sock) si no se asegura correctamente, tiene residuo pegado o hay inestabilidad de temperatura. La cámara de la P2S detecta la ausencia del sock. Compatible con hotend quick-swap de la P2S.',
    wiki_url: 'https://wiki.bambulab.com/en/p2s/maintenance/replace-hotend-and-silicone-sock',
    suggested_items: [
      { name: 'Calceta de silicona P2S', quantity: 1 },
    ],
  },
  {
    value: 'almohadilla_silicona',
    label: 'Reemplazo almohadilla limpiadora',
    interval_hours: null,
    description: 'Inspeccionar y reemplazar el silicone wiping pad (nozzle wiper). Si está dañado, el nozzle no se limpia correctamente antes de la primera capa y afecta la adhesión. La P2S tiene detección automática del pad. Disponible en tienda oficial.',
    wiki_url: 'https://wiki.bambulab.com/en/p2s/maintenance/period-maintenance',
    suggested_items: [
      { name: 'Almohadilla limpiadora de silicona (nozzle wiper)', quantity: 1 },
    ],
  },
  {
    value: 'tubo_ptfe_hotend',
    label: 'Reemplazo tubo PTFE hotend',
    interval_hours: null,
    description: 'Inspeccionar y reemplazar el tubo PTFE interno del hotend. Se degrada con filamentos abrasivos o temperaturas sostenidas >250°C. Inspeccionar si hay jams frecuentes sin causa clara o under-extrusion persistente.',
    wiki_url: 'https://wiki.bambulab.com/en/p2s/maintenance',
    suggested_items: [
      { name: 'Tubo PTFE hotend P2S', quantity: 1 },
    ],
  },
  {
    value: 'inspeccion_cuchilla',
    label: 'Inspección / reemplazo cuchilla',
    interval_hours: null,
    description: 'Inspeccionar la cuchilla del cortador de filamento (cada 8–12 rollos PLA/PETG, 4–10 rollos con abrasivos CF/GF). Verificar que el resorte de retorno funciona y la palanca no está atascada. Reemplazar si el corte es irregular o el filamento se atasca en el AMS.',
    wiki_url: 'https://wiki.bambulab.com/en/p2s/maintenance/period-maintenance',
    suggested_items: [
      { name: 'Cuchilla de corte P2S', quantity: 1 },
    ],
  },
  {
    value: 'sustitucion_nozzle',
    label: 'Sustitución de nozzle',
    interval_hours: null,
    description: 'Reemplazar el hotend completo cuando haya desgaste visible, impresión irregular o atascos frecuentes. La P2S usa sistema quick-swap con clip — sin herramientas, sin cables. Compatible con nozzles del H2D (NO del A1). Actualizar diámetro en pantalla tras el cambio.',
    wiki_url: 'https://wiki.bambulab.com/en/p2s/maintenance/replace-hotend-and-silicone-sock',
    suggested_items: [
      { name: 'Hotend completo P2S (quick-swap)', quantity: 1 },
    ],
  },
  // ── Cámara, filtros y superficie ─────────────────────────────────────────
  {
    value: 'limpieza_camara',
    label: 'Limpieza de cámara',
    interval_hours: null,
    description: 'Limpiar suavemente el lente de la cámara 1080p con paño de microfibra y alcohol isopropílico o etanol 75%. Con ABS el hollín se acumula más rápido. La cámara detecta spaghetti, objetos extraños y clumps en el nozzle.',
    wiki_url: 'https://wiki.bambulab.com/en/p2s/maintenance/period-maintenance',
    suggested_items: [
      { name: 'Paño de microfibra', quantity: 1 },
      { name: 'IPA / Etanol 75%', quantity: 1 },
    ],
  },
  {
    value: 'filtro_carbon',
    label: 'Limpieza / reemplazo filtro de carbón',
    interval_hours: null,
    description: 'Abrir tapa via clip lateral, extraer el filtro por las asas. Si hay suciedad severa, lavar con agua y cepillo. Secar COMPLETAMENTE antes de reinstalar — la humedad daña la electrónica cercana. Con uso intensivo reemplazar cada 1–2 meses.',
    wiki_url: 'https://wiki.bambulab.com/en/p2s/maintenance/period-maintenance',
    suggested_items: [
      { name: 'Filtro de carbón activado P2S', quantity: 1 },
    ],
  },
  {
    value: 'reemplazo_placa',
    label: 'Reemplazo de placa de impresión',
    interval_hours: null,
    description: 'Reemplazar la placa de impresión (build plate) cuando haya desgaste severo de la superficie PEI, pérdida de adherencia o daño físico. Las placas antiguas del P1S son dimensionalmente compatibles pero sin reconocimiento QR — seleccionar "Ignore" en la pantalla si es necesario.',
    wiki_url: 'https://wiki.bambulab.com/en/p2s/maintenance/period-maintenance',
    suggested_items: [
      { name: 'Placa de impresión P2S (build plate)', quantity: 1 },
    ],
  },
  // ── AMS 2 Pro ────────────────────────────────────────────────────────────
  {
    value: 'limpieza_ams',
    label: 'Limpieza del AMS',
    interval_hours: 500,
    description: 'Limpiar el hub interno, las feeder units y los funnels cerámicos del AMS 2 Pro. Soplar con aire comprimido. Verificar PTFE couplers (conectores neumáticos) por holgura o grietas en cada cambio de rollo. Limpiar si hay resistencia en loading/unloading.',
    wiki_url: 'https://wiki.bambulab.com/en/ams-2-pro/maintenance/basic-maintenance',
    suggested_items: [],
  },
  {
    value: 'tubos_ptfe_ams',
    label: 'Reemplazo tubos PTFE AMS',
    interval_hours: null,
    description: 'Inspeccionar y reemplazar los tubos PTFE internos del AMS 2 Pro y los que van del AMS a la impresora. Verificar que estén cortados limpiamente, sin dobleces bruscos y completamente insertados en los couplers. Con filamentos abrasivos, intervalo más corto.',
    wiki_url: 'https://wiki.bambulab.com/en/ams-2-pro/maintenance/basic-maintenance',
    suggested_items: [
      { name: 'Tubos PTFE AMS (internos)', quantity: 4 },
      { name: 'Tubos PTFE AMS → impresora', quantity: 1 },
    ],
  },
  {
    value: 'desecante_ams',
    label: 'Recarga de desecante AMS',
    interval_hours: null,
    description: 'Reemplazar o recargar las bolsas de desecante del AMS 2 Pro cuando el indicador de color muestre saturación (cada 4–6 semanas de uso continuo). El AMS 2 Pro tiene sistema de secado activo pero igual requiere desecante para proteger el filamento almacenado.',
    wiki_url: 'https://wiki.bambulab.com/en/ams-2-pro/maintenance/basic-maintenance',
    suggested_items: [
      { name: 'Bolsa de desecante (desiccant pack)', quantity: 2 },
    ],
  },
  // ── General ───────────────────────────────────────────────────────────────
  {
    value: 'limpieza_general',
    label: 'Limpieza general',
    interval_hours: 300,
    description: 'Limpiar el interior de la cámara, la placa de impresión PEI (agua tibia con jabón — nunca alcohol en la PEI, daña el recubrimiento), los sensores ópticos de filamento y el exterior de la impresora. Limpiar lente de cámara con microfibra.',
    wiki_url: 'https://wiki.bambulab.com/en/p2s/maintenance/period-maintenance',
    suggested_items: [
      { name: 'Paño de microfibra', quantity: 2 },
    ],
  },
  {
    value: 'calibracion_completa',
    label: 'Calibración completa',
    interval_hours: null,
    description: 'Ejecutar Full Calibration desde la pantalla táctil o Bambu Studio: cancelación de ruido de motor (Motor Noise Cancellation), compensación de vibración (Vibration Compensation) y nivelación automática de cama (Auto Bed Leveling). Obligatorio tras mantener ejes o ajustar correas.',
    wiki_url: 'https://wiki.bambulab.com/en/p2s/maintenance/period-maintenance',
    suggested_items: [],
  },
  {
    value: 'otro',
    label: 'Otro',
    interval_hours: null,
    description: 'Mantenimiento personalizado no incluido en las categorías anteriores.',
    wiki_url: 'https://wiki.bambulab.com/en/p2s/maintenance',
    suggested_items: [],
  },
];

/**
 * Devuelve el objeto MaintenanceType por su value, o undefined si no existe.
 * @param {string} value
 * @returns {MaintenanceType|undefined}
 */
export const getMaintenanceType = (value) =>
  MAINTENANCE_TYPES.find((t) => t.value === value);
