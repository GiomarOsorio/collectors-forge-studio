/**
 * @file Contexto de estado sucio (datos no guardados) para Collector's Forge Studio.
 *
 * Permite a cualquier formulario registrarse como "sucio" (con datos sin guardar).
 * Otros componentes (como el AppSwitcher) consultan este estado antes de navegar
 * entre aplicaciones y muestran una advertencia si hay datos pendientes.
 *
 * Uso:
 *   - setDirty('key')   → el formulario tiene datos sin guardar
 *   - clearDirty('key') → el formulario fue guardado o cancelado
 *   - isDirty           → true si algún formulario tiene datos sin guardar
 *
 * @module context/DirtyStateContext
 */

import { createContext, useContext, useState, useCallback } from 'react';

/** @type {React.Context} */
const DirtyStateContext = createContext(null);

/**
 * Proveedor del contexto de estado sucio.
 * Mantiene un Set de claves de formularios con datos no guardados.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @returns {JSX.Element}
 */
export function DirtyStateProvider({ children }) {
  /** @type {[Set<string>, Function]} Conjunto de claves de formularios sucios */
  const [dirtyKeys, setDirtyKeys] = useState(new Set());

  /** Marca un formulario como sucio (datos sin guardar). */
  const setDirty = useCallback((key) => {
    setDirtyKeys((prev) => new Set([...prev, key]));
  }, []);

  /** Marca un formulario como limpio (guardado o cancelado). */
  const clearDirty = useCallback((key) => {
    setDirtyKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  /** Limpia todos los formularios sucios (ej: al cambiar de app). */
  const clearAllDirty = useCallback(() => {
    setDirtyKeys(new Set());
  }, []);

  /** true si hay al menos un formulario con datos sin guardar. */
  const isDirty = dirtyKeys.size > 0;

  return (
    <DirtyStateContext.Provider value={{ isDirty, setDirty, clearDirty, clearAllDirty }}>
      {children}
    </DirtyStateContext.Provider>
  );
}

/**
 * Hook para acceder al contexto de estado sucio.
 * @returns {{ isDirty: boolean, setDirty: Function, clearDirty: Function, clearAllDirty: Function }}
 */
export const useDirtyState = () => useContext(DirtyStateContext);
