/**
 * @file Re-export central del sistema de primitives Claude Design.
 *
 * Importar desde `components/ui` en lugar de cada archivo:
 *
 *   import { Button, Card, KPITile, StatusPill, PageShell } from '../components/ui';
 *
 * @module components/ui
 */

// v1 primitives (port inicial Claude Design)
export { default as Button } from './Button';
export { default as Card } from './Card';
export { default as Chip } from './Chip';
export { default as Collapsible } from './Collapsible';
export { default as ContextMenu } from './ContextMenu';
export { default as DetailDrawer } from './DetailDrawer';
export { default as Input } from './Input';
export { default as KPI } from './KPI';
export { default as MobileSheet } from './MobileSheet';
export { default as Sparkline } from './Sparkline';
export { default as Swatch } from './Swatch';

// v2 primitives unificados (Claude Design components.jsx)
export { default as DropZone } from './DropZone';
export { default as EmptyState } from './EmptyState';
export { default as KPITile } from './KPITile';
export { default as PageHeader } from './PageHeader';
export { default as PageShell } from './PageShell';
export { default as ProgressBar } from './ProgressBar';
export { default as SearchField } from './SearchField';
export { default as StatusPill, STATUS_PRESETS } from './StatusPill';
export { default as ToolbarRow } from './ToolbarRow';
