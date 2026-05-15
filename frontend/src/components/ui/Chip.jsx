/**
 * @file Chip primitive para filtros (estilo Claude Design).
 *
 * Pildora redondeada con estado activo opcional. Click toggles externamente.
 *
 * @module components/ui/Chip
 */

/**
 * @param {Object} props
 * @param {boolean} [props.active]
 * @param {React.ComponentType} [props.icon]
 * @param {number} [props.iconSize=12]
 * @param {React.ReactNode} props.children
 */
export default function Chip({ active = false, icon: Icon, iconSize = 12, className = '', children, ...rest }) {
  const cls = ['chip', active && 'chip-active', className].filter(Boolean).join(' ');
  return (
    <button type="button" className={cls} {...rest}>
      {Icon && <Icon size={iconSize} />}
      {children}
    </button>
  );
}
