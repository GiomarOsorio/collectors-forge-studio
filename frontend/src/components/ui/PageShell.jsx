/**
 * @file PageShell primitive (Claude Design v2 port).
 *
 * Envuelve la app screen y expone `--page-accent` como CSS var para que
 * los descendientes (KPITile, DropZone, EmptyState, etc.) coloreen por
 * accent sin pasar prop drilling.
 *
 * Wrapper neutral: no incluye el sidebar global (lo provee AppLayout).
 * Sólo crea el contexto de accent + el contenedor `<main>`.
 *
 * @module components/ui/PageShell
 */

/**
 * @param {Object} props
 * @param {string} [props.appAccent='var(--color-app-inventory)'] - Color hex o CSS var
 * @param {React.ReactNode} props.children
 */
export default function PageShell({ appAccent = 'var(--color-app-inventory)', children }) {
  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ ['--page-accent']: appAccent }}
    >
      {children}
    </div>
  );
}
