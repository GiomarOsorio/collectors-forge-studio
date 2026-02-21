/**
 * @file Diálogo de confirmación reutilizable para acciones destructivas.
 *
 * Provee ConfirmProvider (contexto) y useConfirm (hook) para reemplazar
 * los confirm() nativos del navegador con un modal integrado al diseño.
 *
 * Uso:
 *   const confirm = useConfirm();
 *   if (!await confirm('¿Eliminar este ítem?')) return;
 *
 * @module components/ConfirmDialog
 */

import { createContext, useContext, useState } from 'react';

const ConfirmContext = createContext(null);

/**
 * Proveedor del diálogo de confirmación.
 * Debe envolver todos los componentes que usen useConfirm().
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children
 */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState({
    open: false,
    message: '',
    confirmText: 'Confirmar',
    resolve: null,
  });

  /**
   * Muestra el diálogo y retorna una promesa que resuelve a true/false.
   *
   * @param {string} message     - Mensaje a mostrar al usuario.
   * @param {string} confirmText - Texto del botón de confirmación (defecto: 'Confirmar').
   * @returns {Promise<boolean>}
   */
  const confirm = (message, confirmText = 'Confirmar') =>
    new Promise((resolve) => {
      setState({ open: true, message, confirmText, resolve });
    });

  const handleYes = () => {
    state.resolve(true);
    setState({ open: false, message: '', confirmText: 'Confirmar', resolve: null });
  };

  const handleNo = () => {
    state.resolve(false);
    setState({ open: false, message: '', confirmText: 'Confirmar', resolve: null });
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state.open && (
        <div className="tf-modal-overlay" style={{ zIndex: 9999 }}>
          <div className="tf-modal max-w-sm">
            <p className="text-tech-white text-sm mb-6">{state.message}</p>
            <div className="flex justify-end gap-3">
              <button onClick={handleNo} className="tf-btn-ghost">
                Cancelar
              </button>
              <button onClick={handleYes} className="tf-btn-danger">
                {state.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

/**
 * Hook para acceder a la función confirm() del ConfirmProvider.
 * Debe usarse dentro de un árbol envuelto por ConfirmProvider.
 *
 * @returns {(message: string, confirmText?: string) => Promise<boolean>}
 */
export const useConfirm = () => useContext(ConfirmContext);
