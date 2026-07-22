/**
 * @file Página Settings — port 1:1 del mockup settings.html (tabbed).
 *
 * 8 tabs (híbrido: los 3 del mockup + las 5 áreas V1 preservadas):
 *   Cuenta · Idioma · Apariencia · Empresa · Usuarios · Notificaciones ·
 *   Sistema · Integraciones.
 * Estilo mk- (styles/mockup-system.css + SettingsPage.css). Wiring V1 intacto:
 *   updateMe, getUsers/updateUser, canales CRUD + templates, systemInfo/logs/
 *   backup, Bambu Cloud login, i18n, tema. Restore/backup programado siguen
 *   siendo por CLI (backend no expone endpoint) → no se dibujan como fake.
 *
 * @module pages/settings/SettingsPage
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  AlertTriangle, Bell, Building2, CheckCircle2, Cpu, Download, Eye, EyeOff,
  Globe, Link2, Loader2, Mail, MessageSquare, Palette, Pencil, Plus,
  RefreshCw, Save, Send, Shield, Trash2, User as UserIcon, Users, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Button, DetailDrawer, EmptyState, MobileSheet } from '../../components/ui';
import MobileAppHeader from '../../components/MobileAppHeader';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { SUPPORTED_LANGS, setLanguage } from '../../i18n';
import {
  createNotificationChannel, deleteNotificationChannel, downloadSystemBackup,
  getMakerworldAuthStatus, getNotificationChannels, getNotificationTemplate,
  getSystemInfo, getSystemLogs, getUsers, loginMakerworld,
  logoutMakerworld, previewNotificationTemplate, testNotificationChannel,
  updateMe, updateNotificationChannel, updateNotificationTemplate, updateUser,
  verifyMakerworld,
} from '../../services/api';
import { apiErrorMsg } from '../../utils/apiError';
import './SettingsPage.css';

const ACCENT = '#2DD4BF'; // settings = teal

// ─── Constantes de notificaciones ───────────────────────────────────────────
const NOTIFICATION_EVENTS = [
  'queue.item_done', 'queue.item_cancelled', 'inventory.low_stock',
  'inventory.spool_low', 'maintenance.due', 'purchase_order.status_changed',
  'client_quote.created',
];
const TEMPLATE_VARS = {
  'queue.item_done': ['piece_name', 'printer', 'quantity', 'grams', 'hours', 'user'],
  'queue.item_cancelled': ['piece_name', 'printer', 'failure_reason'],
  'inventory.low_stock': ['item_name', 'quantity', 'min_quantity', 'unit'],
  'inventory.spool_low': ['spool_code', 'remaining_g'],
  'maintenance.due': ['printer', 'task_name', 'progress_pct'],
  'purchase_order.status_changed': ['po_code', 'status', 'supplier'],
  'client_quote.created': ['quote_code', 'client_name', 'total'],
};
const CHANNEL_TYPES = [
  { value: 'ntfy', icon: Bell, emoji: '📡', pill: 'mk-pill-neutral' },
  { value: 'telegram', icon: Send, emoji: '✈️', pill: 'mk-pill-teal' },
  { value: 'discord', icon: MessageSquare, emoji: '🎮', pill: 'mk-pill-violet' },
  { value: 'email', icon: Mail, emoji: '✉️', pill: 'mk-pill-amber' },
  { value: 'webhook', icon: Link2, emoji: '🪝', pill: 'mk-pill-rose' },
];
const CHANNEL_META = CHANNEL_TYPES.reduce((a, c) => { a[c.value] = c; return a; }, {});
const LOG_LEVELS = ['', 'DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'];

function roleBadge(role) {
  if (role === 'admin') return { label: 'Admin', pill: 'mk-pill-violet' };
  if (role === 'operator') return { label: 'Operador', pill: 'mk-pill-teal' };
  if (role === 'viewer') return { label: 'Visualizador', pill: 'mk-pill-neutral' };
  return { label: role || '—', pill: 'mk-pill-neutral' };
}

function fmtBytes(n) {
  if (!n) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = n; let i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i += 1; }
  return `${v.toFixed(1)} ${u[i]}`;
}
function fmtUptime(s) {
  const d = Math.floor(s / 86400); const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function emptyConfigFor(type) {
  if (type === 'telegram') return { bot_token: '', chat_id: '' };
  if (type === 'discord') return { webhook_url: '' };
  if (type === 'ntfy') return { server: 'https://ntfy.sh', topic: '' };
  if (type === 'email') return { recipients: [] };
  if (type === 'webhook') return { url: '', secret: '' };
  return {};
}

// ─── Switch (mk-) ────────────────────────────────────────────────────────────
function MkSwitch({ checked, onChange, disabled }) {
  return (
    <label className="mk-switch-wrap">
      <span className="mk-switch">
        <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange?.(e.target.checked)} />
        <span className="track" />
      </span>
    </label>
  );
}

// ─── Config fields por tipo de canal (drawer form) ──────────────────────────
function ConfigFields({ type, config, setConfig }) {
  const set = (k, v) => setConfig((p) => ({ ...p, [k]: v }));
  if (type === 'telegram') return (
    <>
      <input className="mk-f-input" placeholder="Bot token" value={config.bot_token || ''} onChange={(e) => set('bot_token', e.target.value)} />
      <input className="mk-f-input" placeholder="Chat ID" value={config.chat_id || ''} onChange={(e) => set('chat_id', e.target.value)} />
    </>
  );
  if (type === 'discord') return (
    <input className="mk-f-input" placeholder="Webhook URL de Discord" value={config.webhook_url || ''} onChange={(e) => set('webhook_url', e.target.value)} />
  );
  if (type === 'ntfy') return (
    <>
      <input className="mk-f-input" placeholder="Servidor (ej. https://ntfy.sh)" value={config.server || ''} onChange={(e) => set('server', e.target.value)} />
      <input className="mk-f-input" placeholder="Topic" value={config.topic || ''} onChange={(e) => set('topic', e.target.value)} />
      <input className="mk-f-input" placeholder="Token (opcional)" value={config.token || ''} onChange={(e) => set('token', e.target.value)} />
    </>
  );
  if (type === 'email') return (
    <input className="mk-f-input" placeholder="Destinatarios separados por coma" value={(config.recipients || []).join(', ')}
      onChange={(e) => set('recipients', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />
  );
  if (type === 'webhook') return (
    <>
      <input className="mk-f-input" placeholder="URL" value={config.url || ''} onChange={(e) => set('url', e.target.value)} />
      <input className="mk-f-input" placeholder="Secret HMAC (opcional)" value={config.secret || ''} onChange={(e) => set('secret', e.target.value)} />
    </>
  );
  return null;
}

// ─── Channel form (drawer nuevo/editar) ─────────────────────────────────────
function ChannelForm({ initial, onSaved }) {
  const isEdit = !!initial?.id;
  const [type, setType] = useState(initial?.type || 'ntfy');
  const [name, setName] = useState(initial?.name || '');
  const [config, setConfig] = useState(initial?.config || emptyConfigFor('ntfy'));
  const [events, setEvents] = useState(initial?.events || []);
  const [deferToDigest, setDeferToDigest] = useState(initial?.defer_to_digest || false);
  const [saving, setSaving] = useState(false);

  const toggleEvent = (ev) => setEvents((p) => (p.includes(ev) ? p.filter((e) => e !== ev) : [...p, ev]));

  const submit = async (e) => {
    e?.preventDefault?.();
    setSaving(true);
    try {
      const payload = { type, name, config, events, defer_to_digest: deferToDigest };
      if (isEdit) await updateNotificationChannel(initial.id, payload);
      else await createNotificationChannel(payload);
      toast.success(isEdit ? 'Canal actualizado' : 'Canal creado');
      onSaved();
    } catch (err) {
      toast.error(apiErrorMsg(err, 'No se pudo guardar el canal'));
    } finally { setSaving(false); }
  };

  return (
    <form id="channel-form" onSubmit={submit} className="flex flex-col gap-3">
      {!isEdit && (
        <div>
          <span className="mk-f-section-title">Tipo</span>
          <div className="flex flex-wrap gap-1.5">
            {CHANNEL_TYPES.map(({ value, icon: Icon }) => (
              <button key={value} type="button"
                onClick={() => { setType(value); setConfig(emptyConfigFor(value)); }}
                className={`flex items-center gap-1.5 px-2.5 rounded-md border text-xs capitalize min-h-[40px] ${
                  type === value ? 'border-teal-500 text-teal-300 bg-teal-500/10' : 'border-[var(--cfs-border-strong)] text-gunmetal'
                }`}>
                <Icon size={13} /> {value}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="mk-f-row">
        <label className="mk-f-label">Nombre del canal <span className="mk-f-req">*</span></label>
        <input className="mk-f-input" placeholder="Ej. Bot taller" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="flex flex-col gap-2"><ConfigFields type={type} config={config} setConfig={setConfig} /></div>
      <div>
        <span className="mk-f-section-title">Eventos suscritos</span>
        <div className="mk-event-list">
          {NOTIFICATION_EVENTS.map((ev) => (
            <label key={ev} className="mk-event-item">
              <input type="checkbox" checked={events.includes(ev)} onChange={() => toggleEvent(ev)} />
              <span className="ev-name mono">{ev}</span>
            </label>
          ))}
        </div>
      </div>
      <label className="mk-event-item">
        <input type="checkbox" checked={deferToDigest} onChange={(e) => setDeferToDigest(e.target.checked)} />
        <span className="ev-name">Diferir a resumen diario en horario silencioso</span>
      </label>
      <button type="submit" form="channel-form" className="mk-btn mk-btn-primary mk-btn-block" disabled={saving || !name}>
        {saving ? <Loader2 size={14} className="animate-spin" /> : 'Guardar canal'}
      </button>
    </form>
  );
}

function ChannelFormDrawer({ open, initial, onClose, onSaved, isMobile }) {
  const title = initial?.id ? 'Editar canal' : 'Nuevo canal';
  if (isMobile) {
    return (
      <MobileSheet open={open} onClose={onClose} title={title} height="full">
        <div className="px-5 pt-4 pb-6">{open && <ChannelForm initial={initial} onSaved={onSaved} />}</div>
      </MobileSheet>
    );
  }
  return (
    <DetailDrawer open={open} onClose={onClose} eyebrow="SETTINGS · CANAL" title={title} width={520}>
      {open && <ChannelForm initial={initial} onSaved={onSaved} />}
    </DetailDrawer>
  );
}

// ─── Templates (editor Liquid + preview) ────────────────────────────────────
function TemplatesSection() {
  const [event, setEvent] = useState(NOTIFICATION_EVENTS[0]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);
  const ref = useRef(null);

  const insertVar = (name) => {
    const token = `{{ ${name} }}`;
    const el = ref.current;
    const start = el?.selectionStart ?? body.length;
    const end = el?.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + token + body.slice(end));
    requestAnimationFrame(() => { if (el) { el.focus(); const p = start + token.length; el.setSelectionRange(p, p); } });
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setPreview(null);
    getNotificationTemplate(event)
      .then((res) => { if (!cancelled) setBody(res.data.body); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [event]);

  const runPreview = async () => {
    try { setPreview((await previewNotificationTemplate(event, body)).data); }
    catch (err) { toast.error(apiErrorMsg(err, 'No se pudo generar el preview')); }
  };
  const save = async () => {
    setSaving(true);
    try { await updateNotificationTemplate(event, body); toast.success('Template guardado'); }
    catch (err) { toast.error(apiErrorMsg(err, 'Template inválido')); }
    finally { setSaving(false); }
  };

  return (
    <div className="mk-card mk-card-pad">
      <div className="mk-card-title-row"><span>✏️</span><h3>Editor de templates</h3></div>
      <p className="mk-card-sub">Personaliza el mensaje por evento (sintaxis Liquid). Los chips insertan variables.</p>
      <div className="mk-f-row">
        <label className="mk-f-label">Evento</label>
        <select className="mk-f-select" value={event} onChange={(e) => setEvent(e.target.value)}>
          {NOTIFICATION_EVENTS.map((ev) => <option key={ev} value={ev}>{ev}</option>)}
        </select>
      </div>
      <div className="mk-tpl-chips">
        {(TEMPLATE_VARS[event] || []).map((v) => (
          <button key={v} type="button" className="mk-tpl-chip" disabled={loading} onClick={() => insertVar(v)} title={`Insertar {{ ${v} }}`}>
            {`{{ ${v} }}`}
          </button>
        ))}
      </div>
      <textarea ref={ref} className="mk-f-textarea mono" style={{ minHeight: 120 }} value={loading ? 'Cargando…' : body} disabled={loading} onChange={(e) => setBody(e.target.value)} />
      <div className="flex gap-2 mt-2">
        <button type="button" className="mk-btn mk-btn-secondary mk-btn-sm" onClick={runPreview} disabled={loading}>Vista previa</button>
        <button type="button" className="mk-btn mk-btn-primary mk-btn-sm" onClick={save} disabled={loading || saving}>
          {saving ? <Loader2 size={13} className="animate-spin" /> : 'Guardar template'}
        </button>
      </div>
      {preview && (preview.ok
        ? <div className="mk-tpl-preview-box mt-2">{preview.rendered}</div>
        : <p className="text-xs text-red-400 mt-2">{preview.error}</p>)}
    </div>
  );
}

// ─── Channel card (lista inline) ────────────────────────────────────────────
function ChannelCard({ channel, onToggle, onEdit, onDelete }) {
  const [testing, setTesting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const meta = CHANNEL_META[channel.type] || CHANNEL_TYPES[0];

  const runTest = async () => {
    setTesting(true);
    try {
      const res = await testNotificationChannel(channel.id);
      if (res.data.ok) toast.success('Mensaje de prueba enviado');
      else toast.error(res.data.error || 'El canal respondió con error');
    } catch (err) { toast.error(apiErrorMsg(err, 'No se pudo probar el canal')); }
    finally { setTesting(false); }
  };

  return (
    <div className="mk-card mk-channel-card" style={channel.enabled ? undefined : { opacity: 0.6 }}>
      <div className="mk-channel-icon" style={{ background: `${ACCENT}1F`, color: ACCENT }}>{meta.emoji}</div>
      <div className="mk-channel-body">
        <div className="mk-channel-top">
          <span className="mk-channel-name truncate">{channel.name}</span>
          <span className={`mk-pill ${meta.pill}`}>{channel.type}</span>
        </div>
        <div className="mk-channel-meta">
          <span>{channel.events?.length || 0} eventos suscritos</span>
          <span>·</span>
          <span>{channel.enabled ? 'Activo' : 'Deshabilitado'}</span>
        </div>
      </div>
      <div className="mk-channel-actions">
        <MkSwitch checked={!!channel.enabled} onChange={(v) => onToggle(channel, v)} />
        <button type="button" className="mk-btn mk-btn-secondary mk-btn-sm" onClick={runTest} disabled={testing || !channel.enabled}>
          {testing ? <Loader2 size={12} className="animate-spin" /> : 'Probar'}
        </button>
        <div style={{ position: 'relative' }}>
          <button type="button" className="mk-menu-btn" aria-label="Más acciones" onClick={() => setMenuOpen((v) => !v)}>⋮</button>
          {menuOpen && (
            <div className="mk-dropdown">
              <button type="button" onClick={() => { setMenuOpen(false); onEdit(channel); }}><Pencil size={13} /> Editar</button>
              <button type="button" className="danger" onClick={() => { setMenuOpen(false); onDelete(channel); }}><Trash2 size={13} /> Borrar</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── PANEL: Notificaciones ──────────────────────────────────────────────────
function NotificationsPanel({ isMobile }) {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try { setChannels((await getNotificationChannels()).data || []); }
    catch { /* EmptyState cubre el fallo */ }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const toggle = async (ch, enabled) => {
    try { await updateNotificationChannel(ch.id, { enabled }); load(); }
    catch (err) { toast.error(apiErrorMsg(err, 'No se pudo cambiar el estado')); }
  };
  const remove = async (ch) => {
    try { await deleteNotificationChannel(ch.id); toast.success('Canal borrado'); load(); }
    catch (err) { toast.error(apiErrorMsg(err, 'No se pudo borrar')); }
  };

  return (
    <section>
      <div className="mk-section-head">
        <div>
          <h2>Canales de notificación</h2>
          <p>Eventos de cola, inventario, mantenimiento, compras y cotizaciones enviados por el canal que elijas.</p>
        </div>
        <button type="button" className="mk-btn mk-btn-primary" onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus size={15} /> Nuevo canal
        </button>
      </div>

      {loading ? (
        <p className="text-center text-gunmetal text-sm py-8">Cargando canales…</p>
      ) : channels.length === 0 ? (
        <EmptyState icon={Bell} accent={ACCENT} title="Sin canales configurados"
          hint="Agrega Telegram, Discord, ntfy, email o un webhook para recibir avisos." />
      ) : (
        <div className="mk-channel-grid">
          {channels.map((c) => (
            <ChannelCard key={c.id} channel={c} onToggle={toggle}
              onEdit={(ch) => { setEditing(ch); setFormOpen(true); }} onDelete={remove} />
          ))}
        </div>
      )}

      <div className="mk-divider" />
      <TemplatesSection />

      <ChannelFormDrawer
        open={formOpen} initial={editing} isMobile={isMobile}
        onClose={() => setFormOpen(false)}
        onSaved={() => { setFormOpen(false); load(); }}
      />
    </section>
  );
}

// ─── PANEL: Sistema ─────────────────────────────────────────────────────────
function SystemPanel() {
  const [info, setInfo] = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [levels, setLevels] = useState({ ERROR: true, WARNING: true, INFO: true });

  useEffect(() => {
    getSystemInfo().then((r) => setInfo(r.data)).catch(() => {}).finally(() => setLoadingInfo(false));
  }, []);
  useEffect(() => {
    getSystemLogs('', 200).then((r) => setLogs(r.data || [])).catch(() => {});
  }, []);

  const runBackup = async () => {
    setDownloading(true);
    try { await downloadSystemBackup(); toast.success('Backup descargado'); }
    catch (err) { toast.error(apiErrorMsg(err, 'No se pudo descargar el backup')); }
    finally { setDownloading(false); }
  };

  const shownLogs = logs.filter((l) => {
    const lv = l.level === 'CRITICAL' ? 'ERROR' : l.level === 'WARN' ? 'WARNING' : l.level;
    if (lv === 'ERROR') return levels.ERROR;
    if (lv === 'WARNING') return levels.WARNING;
    return levels.INFO;
  });

  const topTables = info?.db?.top_tables || [];

  return (
    <section>
      <div className="mk-section-head">
        <div>
          <h2>Sistema</h2>
          <p>Backup de base de datos, información de la plataforma y log de la aplicación. Solo rol admin.</p>
        </div>
        <span className="mk-pill mk-pill-violet mk-pill-lg">Solo admin</span>
      </div>

      <div className="mk-sys-grid">
        {/* Card Backup */}
        <div className="mk-card mk-card-pad">
          <div className="mk-card-title-row"><span>💾</span><h3>Backup</h3></div>
          <p className="mk-card-sub">Dump completo de PostgreSQL (pg_dump, formato custom).</p>
          <button type="button" className="mk-btn mk-btn-primary mk-btn-block" onClick={runBackup} disabled={downloading}>
            {downloading ? <Loader2 size={14} className="animate-spin" /> : <><Download size={15} /> Descargar backup</>}
          </button>
          <div className="mk-backup-note">
            <span className="ic">🔒</span>
            <span>Restaurar y los backups programados se gestionan por CLI en el servidor (ver docs/despliegue.md) — no se exponen en la UI para no duplicar el mecanismo del deploy.</span>
          </div>
        </div>

        {/* Card System info */}
        <div className="mk-card mk-card-pad">
          <div className="mk-card-title-row"><span>📊</span><h3>Información del sistema</h3></div>
          <p className="mk-card-sub">Estado en vivo — versión, almacenamiento y migraciones.</p>

          {loadingInfo ? (
            <p className="text-center text-gunmetal text-sm py-6">Cargando…</p>
          ) : info ? (
            <>
              <div className="mk-tile-strip">
                <div className="mk-tile"><span className="mk-tile-label">Versión</span><span className="mk-tile-val mono">{info.version}</span></div>
                <div className="mk-tile"><span className="mk-tile-label">Uptime</span><span className="mk-tile-val mono">{fmtUptime(info.uptime_seconds)}</span></div>
                <div className="mk-tile"><span className="mk-tile-label">BD</span><span className="mk-tile-val mono">{info.db?.size_pretty}</span></div>
                <div className="mk-tile"><span className="mk-tile-label">MinIO</span><span className="mk-tile-val mono">{fmtBytes(info.minio?.used_bytes)}</span></div>
                <div className="mk-tile"><span className="mk-tile-label">Modelos</span><span className="mk-tile-val mono">{info.counts?.model_files}</span></div>
                <div className="mk-tile"><span className="mk-tile-label">Prints</span><span className="mk-tile-val mono">{info.counts?.queue_items_done}</span></div>
              </div>

              <span className="mk-f-label">Tamaño por tabla (top {topTables.length})</span>
              <div className="mk-table-wrap">
                <table className="mk-size-table">
                  <thead><tr><th>Tabla</th><th className="r">Tamaño</th></tr></thead>
                  <tbody>
                    {topTables.map((t) => (
                      <tr key={t.name}><td>{t.name}</td><td className="r">{t.size_pretty}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mk-size-cards">
                {topTables.map((t) => (
                  <div key={t.name} className="mk-size-card">
                    <div><div className="name">{t.name}</div></div>
                    <div className="size">{t.size_pretty}</div>
                  </div>
                ))}
              </div>

              <div className="mk-migration-row">
                <span className="lbl">Migraciones Alembic</span>
                <span className="rev">current = {info.migrations?.current || '—'}</span>
                {info.migrations?.up_to_date
                  ? <span className="mk-pill mk-pill-teal"><CheckCircle2 size={11} /> al día</span>
                  : <span className="mk-pill mk-pill-rose"><AlertTriangle size={11} /> desactualizada</span>}
              </div>
            </>
          ) : (
            <p className="text-center text-gunmetal text-sm py-6">No se pudo cargar la información.</p>
          )}

          <span className="mk-f-label">Log de la aplicación (últimas 200)</span>
          <div className="mk-log-filters">
            {['ERROR', 'WARNING', 'INFO'].map((lv) => (
              <button key={lv} type="button"
                className={`mk-log-chip ${levels[lv] ? `active ${lv === 'ERROR' ? 'err' : lv === 'WARNING' ? 'warn' : 'info'}` : ''}`}
                onClick={() => setLevels((p) => ({ ...p, [lv]: !p[lv] }))}>
                {lv}
              </button>
            ))}
          </div>
          <div className="mk-log-viewer">
            {shownLogs.length === 0 ? (
              <div className="mk-log-line" style={{ color: 'var(--cfs-text-tertiary)' }}>Sin líneas</div>
            ) : shownLogs.map((l, i) => (
              <div key={i} className="mk-log-line">
                <span className="ts">{l.ts?.slice(11, 19)}</span>{' '}
                <span className={`lvl-${l.level}`}>{l.level}</span>{'  '}
                {l.logger} — {l.msg}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── PANEL: Integraciones (Bambu Cloud) ─────────────────────────────────────
function IntegrationsPanel() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(null);
  const [tfaKey, setTfaKey] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setStatus((await getMakerworldAuthStatus()).data); }
    catch { setStatus({ configured: false }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const submitLogin = async () => {
    setSubmitting(true);
    try {
      const res = await loginMakerworld(email, password);
      if (res.data.status === 'ok') { toast.success('Cuenta conectada'); setPassword(''); load(); }
      else { setPending(res.data.status === 'tfa' ? 'tfa' : 'email'); setTfaKey(res.data.tfa_key || null); toast(res.data.message); }
    } catch (err) { toast.error(apiErrorMsg(err, 'No se pudo iniciar sesión')); }
    finally { setSubmitting(false); }
  };
  const submitVerify = async () => {
    setSubmitting(true);
    try { await verifyMakerworld(code, tfaKey); toast.success('Cuenta conectada'); setPending(null); setCode(''); load(); }
    catch (err) { toast.error(apiErrorMsg(err, 'Código inválido')); }
    finally { setSubmitting(false); }
  };
  const disconnect = async () => {
    try { await logoutMakerworld(); toast.success('Cuenta desconectada'); load(); }
    catch (err) { toast.error(apiErrorMsg(err, 'No se pudo desconectar')); }
  };

  return (
    <section>
      <div className="mk-section-head">
        <div>
          <h2>Integraciones</h2>
          <p>Conectá servicios externos para enriquecer el Vault y automatizar imports.</p>
        </div>
      </div>

      <div className="mk-card mk-card-pad mk-bambu-card">
        <div className="mk-bambu-head">
          <div className="mk-bambu-logo">🌍</div>
          <div className="flex-1 min-w-0">
            <div className="mk-card-title-row" style={{ marginBottom: 2 }}><h3>Bambu Cloud</h3></div>
            {loading ? <span className="mk-pill mk-pill-neutral">Cargando…</span>
              : status?.configured ? <span className="mk-pill mk-pill-teal">● Conectado</span>
              : <span className="mk-pill mk-pill-neutral">○ Sin conectar</span>}
          </div>
        </div>

        {status?.configured && <p className="mk-card-sub" style={{ marginTop: 10 }}>{status.email_masked}</p>}

        <div className="mk-secrets-warn">
          <span className="ic">🔒</span>
          <span className="txt">Las credenciales y tokens de refresh se guardan cifrados en el servidor. Nunca se muestran en texto plano ni se registran en logs.</span>
        </div>

        {loading ? null : status?.configured ? (
          <button type="button" className="mk-btn mk-btn-secondary mk-btn-block" onClick={disconnect}>Desconectar cuenta</button>
        ) : pending ? (
          <div className="flex flex-col gap-2">
            <label className="mk-f-label">{pending === 'tfa' ? 'Código de tu app de autenticación' : 'Código de 6 dígitos enviado a tu email'}</label>
            <input className="mk-f-input" placeholder="Código" value={code} onChange={(e) => setCode(e.target.value)} />
            <button type="button" className="mk-btn mk-btn-primary mk-btn-block" onClick={submitVerify} disabled={submitting || !code}>
              {submitting ? <Loader2 size={14} className="animate-spin" /> : 'Verificar'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <input className="mk-f-input" placeholder="Email de Bambu" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="mk-f-input" type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" className="mk-btn mk-btn-primary mk-btn-block" onClick={submitLogin} disabled={submitting || !email || !password}>
              {submitting ? <Loader2 size={14} className="animate-spin" /> : 'Conectar'}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── PANEL: Cuenta ──────────────────────────────────────────────────────────
function AccountPanel({ user, onSaved }) {
  const [form, setForm] = useState({ username: user?.username || '', email: user?.email || '' });
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm({ username: user?.username || '', email: user?.email || '' }); }, [user]);

  const save = async (e) => {
    e?.preventDefault?.();
    const payload = {};
    if (form.username !== user.username) payload.username = form.username;
    if (form.email !== user.email) payload.email = form.email;
    if (pw.next) {
      if (pw.next !== pw.confirm) { toast.error('Las contraseñas nuevas no coinciden'); return; }
      payload.current_password = pw.current; payload.new_password = pw.next;
    }
    if (Object.keys(payload).length === 0) { toast('Sin cambios que guardar'); return; }
    setSaving(true);
    try { await updateMe(payload); toast.success('Cuenta actualizada'); setPw({ current: '', next: '', confirm: '' }); onSaved?.(payload); }
    catch (err) { toast.error(apiErrorMsg(err, 'Error al guardar')); }
    finally { setSaving(false); }
  };

  return (
    <section>
      <div className="mk-section-head"><div><h2>Mi cuenta</h2><p>Cambia tu nombre de usuario, email o contraseña local.</p></div></div>
      <form onSubmit={save} className="mk-card mk-card-pad" style={{ maxWidth: 560 }}>
        <span className="mk-f-section-title">Perfil</span>
        <div className="mk-f-row"><label className="mk-f-label">Nombre de usuario <span className="mk-f-req">*</span></label>
          <input className="mk-f-input" required minLength={3} maxLength={50} value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} /></div>
        <div className="mk-f-row"><label className="mk-f-label">Correo electrónico <span className="mk-f-req">*</span></label>
          <input className="mk-f-input" type="email" required value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} /></div>

        <span className="mk-f-section-title">Cambiar contraseña</span>
        <p className="mk-f-hint" style={{ marginBottom: 8 }}>Opcional. Si entrás vía OIDC no necesitás contraseña local.</p>
        <div className="mk-f-row"><label className="mk-f-label">Contraseña actual</label>
          <div style={{ position: 'relative' }}>
            <input className="mk-f-input" type={showPw ? 'text' : 'password'} style={{ paddingRight: 38 }} value={pw.current} onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} placeholder="Requerida solo si cambiás la contraseña" />
            <button type="button" onClick={() => setShowPw((v) => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--cfs-text-tertiary)' }} aria-label="Mostrar/ocultar">
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>
        <div className="mk-f-grid-2">
          <div className="mk-f-row"><label className="mk-f-label">Nueva contraseña</label>
            <input className="mk-f-input" type="password" minLength={8} maxLength={128} value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} placeholder="Mín. 8 caracteres" /></div>
          <div className="mk-f-row"><label className="mk-f-label">Confirmar</label>
            <input className="mk-f-input" type="password" value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} placeholder="Repetir" /></div>
        </div>
        <button type="submit" className="mk-btn mk-btn-primary" disabled={saving}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <><Save size={15} /> Guardar</>}
        </button>
      </form>
    </section>
  );
}

// ─── PANEL: Idioma ──────────────────────────────────────────────────────────
function LanguagePanel({ current }) {
  const { t } = useTranslation();
  return (
    <section>
      <div className="mk-section-head"><div><h2>{t('settings.language.title')}</h2><p>{t('settings.language.description')}</p></div></div>
      <div className="mk-card mk-card-pad" style={{ maxWidth: 560 }}>
        <div className="flex flex-col gap-2">
          {SUPPORTED_LANGS.map((lang) => (
            <button key={lang.code} type="button" onClick={() => setLanguage(lang.code)}
              className="mk-card mk-channel-card" style={{ padding: 12, borderColor: lang.code === current ? 'var(--page-accent)' : undefined }}>
              <span className="mk-channel-icon" style={{ background: 'var(--cfs-surface-card-2)', fontSize: 22 }}>{lang.flag}</span>
              <div className="mk-channel-body"><div className="mk-channel-name">{lang.label}</div></div>
              {lang.code === current && <span className="mk-pill mk-pill-teal">Activo</span>}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── PANEL: Apariencia ──────────────────────────────────────────────────────
function AppearancePanel() {
  const { t } = useTranslation();
  const { mode, setMode } = useTheme();
  const MODES = [
    { id: 'light', emoji: '☀️' },
    { id: 'dark', emoji: '🌙' },
    { id: 'system', emoji: '🖥' },
  ];
  return (
    <section>
      <div className="mk-section-head"><div><h2>{t('settings.appearance.title')}</h2><p>{t('settings.appearance.description')}</p></div></div>
      <div className="mk-card mk-card-pad" style={{ maxWidth: 560 }}>
        <div className="flex flex-col gap-2">
          {MODES.map((m) => (
            <button key={m.id} type="button" onClick={() => setMode(m.id)}
              className="mk-card mk-channel-card" style={{ padding: 12, borderColor: mode === m.id ? 'var(--page-accent)' : undefined }}>
              <span className="mk-channel-icon" style={{ background: 'var(--cfs-surface-card-2)', fontSize: 20 }}>{m.emoji}</span>
              <div className="mk-channel-body"><div className="mk-channel-name">{t(`settings.appearance.${m.id}`)}</div></div>
              {mode === m.id && <span className="mk-pill mk-pill-teal">Activo</span>}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── PANEL: Empresa ─────────────────────────────────────────────────────────
function CompanyPanel() {
  return (
    <section>
      <div className="mk-section-head"><div><h2>Empresa</h2><p>El perfil de la empresa se edita en Compañía › Resumen.</p></div></div>
      <div className="mk-card mk-card-pad" style={{ maxWidth: 560 }}>
        <div className="mk-card-title-row"><span>🏢</span><h3>Perfil de empresa</h3></div>
        <p className="mk-card-sub">Nombre, logo, datos fiscales y branding de las cotizaciones.</p>
        <button type="button" className="mk-btn mk-btn-secondary mk-btn-block" onClick={() => window.location.assign('/company')}>
          <Building2 size={15} /> Ir a Compañía
        </button>
      </div>
    </section>
  );
}

// ─── PANEL: Usuarios ────────────────────────────────────────────────────────
function UserRow({ u, currentUserId, expanded, onToggle, onSaved }) {
  const badge = roleBadge(u.role);
  const [role, setRole] = useState(u.role || 'viewer');
  const [pw, setPw] = useState({ next: '', confirm: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (expanded) { setRole(u.role || 'viewer'); setPw({ next: '', confirm: '' }); } }, [expanded, u.role]);

  const save = async (e) => {
    e?.preventDefault?.();
    const payload = {};
    if (role !== u.role) payload.role = role;
    if (pw.next) { if (pw.next !== pw.confirm) { toast.error('Las contraseñas no coinciden'); return; } payload.new_password = pw.next; }
    if (Object.keys(payload).length === 0) { toast('Sin cambios que guardar'); return; }
    setSaving(true);
    try { await updateUser(u.id, payload); toast.success(`Usuario "${u.username}" actualizado`); onSaved?.(); }
    catch (err) { toast.error(apiErrorMsg(err, 'Error al actualizar')); }
    finally { setSaving(false); }
  };

  return (
    <div className="mk-card" style={{ overflow: 'hidden' }}>
      <button type="button" onClick={() => onToggle(u.id)} className="mk-channel-card" style={{ width: '100%', textAlign: 'left', background: 'none' }}>
        <span className="mk-channel-icon" style={{ background: u.is_active ? `${ACCENT}1F` : 'rgba(248,113,113,.12)', color: u.is_active ? ACCENT : '#F87171' }}><UserIcon size={16} /></span>
        <div className="mk-channel-body">
          <div className="mk-channel-top">
            <span className="mk-channel-name truncate">{u.username}</span>
            <span className={`mk-pill ${badge.pill}`}>{badge.label}</span>
            {!u.is_active && <span className="mk-pill mk-pill-rose">Inactivo</span>}
            {u.id === currentUserId && <span className="mono text-[10px]" style={{ color: 'var(--page-accent)' }}>· tú</span>}
          </div>
          <div className="mk-channel-meta">{u.email}</div>
        </div>
      </button>
      {expanded && (
        <form onSubmit={save} className="flex flex-col gap-2" style={{ padding: '0 14px 14px' }}>
          <div className="mk-f-grid-2">
            <div className="mk-f-row" style={{ marginBottom: 0 }}><label className="mk-f-label">Rol</label>
              <select className="mk-f-select" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="viewer">Visualizador</option>
                <option value="operator">Operador</option>
                <option value="admin">Admin</option>
              </select></div>
            <div className="mk-f-row" style={{ marginBottom: 0 }}><label className="mk-f-label">Nueva contraseña</label>
              <input className="mk-f-input" type="password" value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} placeholder="Opcional" /></div>
          </div>
          {pw.next && (
            <div className="mk-f-row" style={{ marginBottom: 0 }}><label className="mk-f-label">Confirmar contraseña</label>
              <input className="mk-f-input" type="password" value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} /></div>
          )}
          <button type="submit" className="mk-btn mk-btn-primary mk-btn-sm" disabled={saving}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : 'Guardar cambios'}
          </button>
        </form>
      )}
    </div>
  );
}

function UsersPanel({ currentUserId }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  const load = async () => {
    setLoading(true);
    try { setUsers((await getUsers()).data || []); }
    catch { /* EmptyState cubre */ }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  return (
    <section>
      <div className="mk-section-head"><div><h2>Usuarios</h2><p>Listar usuarios y editar su rol o contraseña. Solo admin.</p></div>
        <span className="mk-pill mk-pill-violet mk-pill-lg">Solo admin</span></div>
      {loading ? (
        <p className="text-center text-gunmetal text-sm py-8">Cargando usuarios…</p>
      ) : users.length === 0 ? (
        <EmptyState icon={Users} accent={ACCENT} title="Sin usuarios" hint="Los usuarios se aprovisionan al iniciar sesión vía OIDC." />
      ) : (
        <div className="flex flex-col gap-2" style={{ maxWidth: 720 }}>
          {users.map((u) => (
            <UserRow key={u.id} u={u} currentUserId={currentUserId} expanded={expandedId === u.id}
              onToggle={(id) => setExpandedId((cur) => (cur === id ? null : id))} onSaved={load} />
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const isMobile = useIsMobile();
  const { openSidebar } = useOutletContext() || {};
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { i18n } = useTranslation();
  const currentLang = SUPPORTED_LANGS.find((l) => l.code === i18n.language) || SUPPORTED_LANGS[0];

  const TABS = useMemo(() => {
    const base = [
      { id: 'account', label: 'Cuenta' },
      { id: 'language', label: 'Idioma' },
      { id: 'appearance', label: 'Apariencia' },
    ];
    if (isAdmin) {
      base.push(
        { id: 'company', label: 'Empresa' },
        { id: 'users', label: 'Usuarios' },
        { id: 'notifications', label: 'Notificaciones' },
        { id: 'system', label: 'Sistema', count: 'admin' },
        { id: 'integrations', label: 'Integraciones' },
      );
    }
    return base;
  }, [isAdmin]);

  const [tab, setTab] = useState('account');
  const tabLabel = TABS.find((x) => x.id === tab)?.label || 'Settings';

  return (
    <div
      className="flex flex-col min-h-screen -m-4 md:-m-6 xl:-m-8"
      style={{ '--page-accent': 'var(--color-forge-teal)' }}
    >
      {isMobile && (
        <MobileAppHeader appName="Settings" appIcon={Cpu} appAccent={ACCENT} title={tabLabel} onMenu={() => openSidebar?.()} />
      )}

      <main className="px-4 md:px-8 pt-4 md:pt-7 pb-24">
        <div className="mk-set-head">
          <span className="mk-eyebrow">Configuración</span>
          <h1>Settings</h1>
          <p>Cuenta, notificaciones, sistema e integraciones del estudio.</p>
        </div>

        <nav className="mk-settings-tabs" role="tablist">
          {TABS.map((x) => (
            <button key={x.id} type="button" role="tab" aria-selected={tab === x.id}
              className={`mk-settings-tab ${tab === x.id ? 'active' : ''}`} onClick={() => setTab(x.id)}>
              {x.label}
              {x.count && <span className="count mono">{x.count}</span>}
            </button>
          ))}
        </nav>

        {tab === 'account' && <AccountPanel user={user} />}
        {tab === 'language' && <LanguagePanel current={currentLang.code} />}
        {tab === 'appearance' && <AppearancePanel />}
        {tab === 'company' && isAdmin && <CompanyPanel />}
        {tab === 'users' && isAdmin && <UsersPanel currentUserId={user?.id} />}
        {tab === 'notifications' && isAdmin && <NotificationsPanel isMobile={isMobile} />}
        {tab === 'system' && isAdmin && <SystemPanel />}
        {tab === 'integrations' && isAdmin && <IntegrationsPanel />}
      </main>
    </div>
  );
}
