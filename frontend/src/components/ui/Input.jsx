/**
 * @file Input primitive con label/hint opcional (estilo Claude Design).
 *
 * @module components/ui/Input
 */

import { forwardRef, useId } from 'react';

/**
 * @typedef {Object} InputProps
 * @property {string} [label]
 * @property {string} [hint]
 * @property {string} [error]
 * @property {React.ComponentType} [iconLeft]
 */

const Input = forwardRef(function Input(
  { label, hint, error, iconLeft: IconLeft, className = '', id: idProp, ...rest },
  ref,
) {
  const autoId = useId();
  const id = idProp || autoId;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-xs text-steel font-medium">
          {label}
        </label>
      )}
      <div className="relative">
        {IconLeft && (
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gunmetal-dim pointer-events-none">
            <IconLeft size={14} />
          </span>
        )}
        <input
          ref={ref}
          id={id}
          className={[
            'input',
            IconLeft && 'pl-8',
            error && 'border-rose-500/60 focus:border-rose-500',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...rest}
        />
      </div>
      {error ? (
        <p className="text-xs text-rose-400">{error}</p>
      ) : hint ? (
        <p className="text-xs text-gunmetal">{hint}</p>
      ) : null}
    </div>
  );
});

export default Input;
