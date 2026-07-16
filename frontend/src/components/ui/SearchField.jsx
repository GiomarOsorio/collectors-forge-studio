/**
 * @file SearchField primitive (Claude Design v2 port).
 *
 * Input de búsqueda compacto con ícono `Search` integrado. Reemplaza al
 * pattern actual de `<input className="input" />` con icon manual.
 *
 * @module components/ui/SearchField
 */

import { Search } from 'lucide-react';

/**
 * @param {Object} props
 * @param {string} props.value
 * @param {(value: string) => void} props.onChange
 * @param {string} [props.placeholder='Buscar…']
 * @param {string|number} [props.width=260]
 * @param {string} [props.className]
 */
export default function SearchField({ value, onChange, placeholder = 'Buscar…', width = 260, className = '' }) {
  return (
    <div
      className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-[var(--color-surf-card)] border border-[var(--color-border-strong)] ${className}`}
      style={{ width, maxWidth: '100%' }}
    >
      <Search size={13} className="text-gunmetal shrink-0" />
      <input
        value={value || ''}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-w-0 bg-transparent border-0 outline-0 text-tech-white text-[12.5px] placeholder:text-gunmetal-dim"
      />
    </div>
  );
}
