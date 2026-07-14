/**
 * @file Cuerpo del modal "Imprimir etiquetas" de bobinas (issue #135).
 *
 * Plain `<div>` (no `<form>` propio) — el padre (`InventorySpoolsPage`)
 * envuelve esto en su propio `<form>` único por punto de uso (mobile/
 * desktop), mismo patrón ya establecido para `BulkCreateBody`/
 * `EditSpoolBody` tras el bug de formularios anidados de #134.
 *
 * @module pages/inventory/components/LabelPrintModal
 */

const TEMPLATES = [
  { value: 'ams_holder_74x33', label: 'Holder AMS 74×33mm', hint: 'Modelo MakerWorld 752566 — ventana chica', w: 74, h: 33 },
  { value: 'ams_holder_75x55', label: 'Holder AMS 75×55mm', hint: 'Modelo MakerWorld 752566 — inserto cartulina', w: 75, h: 55 },
  { value: 'box_40x30', label: 'Caja/bolsa 40×30mm', hint: 'Rollo DK/Brother', w: 40, h: 30 },
  { value: 'box_62x29', label: 'Caja/bolsa 62×29mm', hint: 'Brother PT/QL, Dymo', w: 62, h: 29 },
  { value: 'avery_5160', label: 'Avery 5160 (US Letter)', hint: '30 por hoja, 25.4×66.7mm', w: 66.7, h: 25.4, sheet: true },
  { value: 'avery_l7160', label: 'Avery L7160 (A4)', hint: '21 por hoja, 63.5×38.1mm', w: 63.5, h: 38.1, sheet: true },
];

/** Preview proporcional del layout (swatch + texto + QR), sin renderizar PDF. */
function TemplatePreview({ tpl, monochrome }) {
  const scale = 2.6;
  return (
    <div
      className="border border-[var(--color-border-strong)] rounded bg-white flex items-stretch overflow-hidden shrink-0"
      style={{ width: tpl.w * scale, height: tpl.h * scale }}
    >
      {!monochrome && (
        <div className="w-1/5 bg-gradient-to-b from-amber-400 to-rose-400 shrink-0" />
      )}
      <div className="flex-1 flex flex-col justify-between px-1 py-0.5 min-w-0">
        <div className="h-1 w-3/4 bg-gray-800 rounded-sm" />
        <div className="h-2 w-1/2 bg-gray-900 rounded-sm font-bold" />
      </div>
      <div className="w-1/4 flex items-center justify-center shrink-0">
        <div className="bg-gray-900" style={{ width: '70%', aspectRatio: '1' }} />
      </div>
    </div>
  );
}

/**
 * @param {Object} props
 * @param {{template: string, monochrome: boolean}} props.form
 * @param {(updater: Function) => void} props.setForm
 * @param {number} props.count - Cantidad de bobinas seleccionadas
 */
export default function LabelPrintModal({ form, setForm, count }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-gunmetal">
        {count} bobina{count === 1 ? '' : 's'} seleccionada{count === 1 ? '' : 's'}. El PDF se abre en una pestaña nueva.
      </p>

      <div className="flex flex-col gap-2">
        {TEMPLATES.map((tpl) => (
          <label
            key={tpl.value}
            className={`flex items-center gap-3 px-3 py-2 rounded-md border cursor-pointer ${
              form.template === tpl.value
                ? 'border-amber-500/50 bg-amber-500/10'
                : 'border-[var(--color-border-strong)] bg-[var(--color-surf-card)]'
            }`}
          >
            <input
              type="radio"
              name="label-template"
              value={tpl.value}
              checked={form.template === tpl.value}
              onChange={() => setForm((f) => ({ ...f, template: tpl.value }))}
              className="shrink-0"
            />
            <TemplatePreview tpl={tpl} monochrome={form.monochrome} />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-tech-white truncate">{tpl.label}</p>
              <p className="text-[11px] text-gunmetal truncate">{tpl.hint}</p>
            </div>
          </label>
        ))}
      </div>

      <label className="flex items-center gap-2 text-sm text-tech-white">
        <input
          type="checkbox"
          checked={form.monochrome}
          onChange={(e) => setForm((f) => ({ ...f, monochrome: e.target.checked }))}
        />
        Monocromo (impresora térmica B/N — sin swatch de color)
      </label>
    </div>
  );
}
