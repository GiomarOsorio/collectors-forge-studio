/**
 * @file DropZone primitive (Claude Design v2 port).
 *
 * Área de drag-drop para upload de archivos. Cambia el border al hover
 * y al drag-over. Usada en Vault (.stl/.3mf).
 *
 * Por ahora el componente sólo gestiona el visual + click. El handler
 * de archivos lo provee el caller mediante `onFiles`.
 *
 * @module components/ui/DropZone
 */

import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';

/**
 * @param {Object} props
 * @param {string}   [props.accept='.3mf,.gcode']  - Atributo accept del input file
 * @param {string}   [props.hint='Suelta tu archivo aquí']
 * @param {React.ComponentType} [props.icon] - Ícono lucide (default Upload)
 * @param {string}   [props.accent='var(--page-accent)']
 * @param {string}   [props.cta='Examinar archivos']
 * @param {string}   [props.meta] - Texto bajo el hint (default deriva del accept)
 * @param {(files: FileList) => void} [props.onFiles] - Callback con archivos drop/select
 */
export default function DropZone({
  accept = '.3mf,.gcode',
  hint = 'Suelta tu archivo aquí',
  icon: Icon = Upload,
  accent = 'var(--page-accent)',
  cta = 'Examinar archivos',
  meta,
  onFiles,
}) {
  const [hover, setHover] = useState(false);
  const inputRef = useRef(null);

  const handleFiles = (files) => {
    if (files?.length && onFiles) onFiles(files);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setHover(true);
      }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHover(false);
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      className="p-9 rounded-2xl text-center transition-all cursor-pointer"
      style={{
        border: `1.5px dashed ${hover ? accent : 'var(--color-border-strong)'}`,
        background: hover
          ? `color-mix(in oklab, ${accent} 6%, var(--color-surf-card))`
          : 'var(--color-surf-card)',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div
        className="w-13 h-13 mx-auto mb-3 rounded-2xl flex items-center justify-center"
        style={{
          width: 52,
          height: 52,
          background: `color-mix(in oklab, ${accent} 14%, transparent)`,
          border: `1px solid color-mix(in oklab, ${accent} 32%, transparent)`,
          color: accent,
        }}
      >
        <Icon size={22} />
      </div>
      <p className="text-[15px] font-semibold text-tech-white leading-tight mb-1">{hint}</p>
      <p className="mono text-[11px] text-gunmetal mb-3.5 tracking-wide">
        {meta || `o pulsa para seleccionar · ${accept}`}
      </p>
      <button
        type="button"
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-semibold text-[12.5px]"
        style={{ background: accent, color: '#0A1014' }}
        onClick={(e) => {
          e.stopPropagation();
          inputRef.current?.click();
        }}
      >
        <Upload size={12} /> {cta}
      </button>
    </div>
  );
}
