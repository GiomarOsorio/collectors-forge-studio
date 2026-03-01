/**
 * @file Componente de estado vacío reutilizable.
 *
 * Se muestra cuando una lista o tabla no tiene datos.
 * Incluye ícono, título, descripción y un CTA opcional.
 *
 * @module components/EmptyState
 */

/**
 * Estado vacío genérico.
 *
 * @param {Object} props
 * @param {React.ComponentType} props.icon - Ícono de Lucide a mostrar
 * @param {string} props.title - Título principal
 * @param {string} [props.description] - Texto descriptivo secundario
 * @param {string} [props.actionLabel] - Texto del botón de acción
 * @param {Function} [props.onAction] - Callback del botón de acción
 * @param {'default'|'sm'} [props.size] - Tamaño del componente
 * @returns {JSX.Element}
 */
export default function EmptyState({ icon: Icon, title, description, actionLabel, onAction, size = 'default' }) {
  const isSmall = size === 'sm';

  return (
    <div className={`flex flex-col items-center justify-center text-center ${isSmall ? 'py-10 px-4' : 'py-16 px-6'}`}>
      {Icon && (
        <div className={`${isSmall ? 'mb-3' : 'mb-4'} p-4 rounded-2xl bg-[#1e2125]`}>
          <Icon
            size={isSmall ? 24 : 32}
            className="text-gunmetal"
            strokeWidth={1.5}
          />
        </div>
      )}
      <p className={`font-semibold text-steel ${isSmall ? 'text-sm' : 'text-base'}`}>{title}</p>
      {description && (
        <p className={`text-gunmetal mt-1 max-w-sm ${isSmall ? 'text-xs' : 'text-sm'}`}>{description}</p>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-4 tf-btn-primary"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
