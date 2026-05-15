/**
 * @file Botón primitive del sistema Claude Design.
 *
 * Wrap fino de `.btn` + variantes. Permite ícono Lucide a izquierda y
 * texto adentro. Para usar sólo ícono, pasar `iconOnly`.
 *
 * @module components/ui/Button
 */

import { forwardRef } from 'react';

/**
 * @typedef {Object} ButtonProps
 * @property {('default'|'primary'|'ghost')} [variant='default']
 * @property {('md'|'sm')} [size='md']
 * @property {boolean} [iconOnly] - Para botones solo-ícono (padding cuadrado)
 * @property {React.ComponentType} [icon] - Ícono lucide a izquierda del texto
 * @property {number} [iconSize=14]
 * @property {React.ReactNode} [children]
 */

const Button = forwardRef(function Button(
  { variant = 'default', size = 'md', iconOnly = false, icon: Icon, iconSize = 14, className = '', children, ...rest },
  ref,
) {
  const cls = [
    'btn',
    variant === 'primary' && 'btn-primary',
    variant === 'ghost' && 'btn-ghost',
    size === 'sm' && 'btn-sm',
    iconOnly && 'btn-icon',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button ref={ref} type="button" className={cls} {...rest}>
      {Icon && <Icon size={iconSize} />}
      {children}
    </button>
  );
});

export default Button;
