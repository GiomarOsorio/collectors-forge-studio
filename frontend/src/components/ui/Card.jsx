/**
 * @file Card primitive (estilo Claude Design).
 *
 * `interactive` agrega cursor pointer + hover-border-bright.
 * Acepta `as` para renderizar `button` (clicable) o `div`.
 *
 * @module components/ui/Card
 */

import { forwardRef } from 'react';

const Card = forwardRef(function Card(
  { as: Tag = 'div', interactive = false, className = '', children, ...rest },
  ref,
) {
  const cls = [
    'card',
    interactive && 'card-interactive',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <Tag ref={ref} className={cls} {...rest}>
      {children}
    </Tag>
  );
});

export default Card;
