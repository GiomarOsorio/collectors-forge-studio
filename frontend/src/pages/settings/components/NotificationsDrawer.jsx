/**
 * @file Drawer "Notificaciones" de Settings (issue #137).
 *
 * Dos secciones dentro del mismo drawer:
 *   1. Canales — lista + alta/edición inline por tipo + botón "Probar".
 *   2. Templates — selector de evento + editor Liquid + preview con datos dummy.
 *
 * Plain `<div>`s (no `<form>` propio) — el padre no envuelve esto en un
 * `<form>`, cada acción dispara su propio submit vía botón (mismo criterio
 * anti-nested-form de #134/#136).
 *
 * @module pages/settings/components/NotificationsDrawer
 */

import { useEffect, useState } from 'react';
import {
  Bell, Link2, Loader2, Mail, MessageSquare, Pencil, Plus, Send, Trash2, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Card, DetailDrawer, EmptyState, MobileSheet } from '../../../components/ui';
import {
  createNotificationChannel,
  deleteNotificationChannel,
  getNotificationChannels,
  getNotificationTemplate,
  previewNotificationTemplate,
  testNotificationChannel,
  updateNotificationChannel,
  updateNotificationTemplate,
} from '../../../services/api';
import { apiErrorMsg } from '../../../utils/apiError';

const ACCENT = '#2DD4BF';

const NOTIFICATION_EVENTS = [
  'queue.item_done',
  'queue.item_cancelled',
  'inventory.low_stock',
  'inventory.spool_low',
  'maintenance.due',
  'purchase_order.status_changed',
  'client_quote.created',
];

const CHANNEL_TYPES = [
  { value: 'ntfy', icon: Bell },
  { value: 'telegram', icon: Send },
  { value: 'discord', icon: MessageSquare },
  { value: 'email', icon: Mail },
  { value: 'webhook', icon: Link2 },
];

const INPUT_CLS =
  'w-full bg-[var(--color-surf-card-2)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-1.5 text-tech-white text-sm focus:outline-none focus:border-teal-500 placeholder:text-gunmetal-dim';

function emptyConfigFor(type) {
  if (type === 'telegram') return { bot_token: '', chat_id: '' };
  if (type === 'discord') return { webhook_url: '' };
  if (type === 'ntfy') return { server: 'https://ntfy.sh', topic: '' };
  if (type === 'email') return { recipients: [] };
  if (type === 'webhook') return { url: '', secret: '' };
  return {};
}

/** Campos de config dinámicos según `type` — sin validación de forma propia (el backend valida). */
function ConfigFields({ type, config, setConfig }) {
  const set = (key, value) => setConfig((prev) => ({ ...prev, [key]: value }));

  if (type === 'telegram') {
    return (
      <>
        <input className={INPUT_CLS} placeholder="Bot token" value={config.bot_token || ''}
          onChange={(e) => set('bot_token', e.target.value)} />
        <input className={INPUT_CLS} placeholder="Chat ID" value={config.chat_id || ''}
          onChange={(e) => set('chat_id', e.target.value)} />
      </>
    );
  }
  if (type === 'discord') {
    return (
      <input className={INPUT_CLS} placeholder="Webhook URL de Discord" value={config.webhook_url || ''}
        onChange={(e) => set('webhook_url', e.target.value)} />
    );
  }
  if (type === 'ntfy') {
    return (
      <>
        <input className={INPUT_CLS} placeholder="Servidor (ej. https://ntfy.sh)" value={config.server || ''}
          onChange={(e) => set('server', e.target.value)} />
        <input className={INPUT_CLS} placeholder="Topic" value={config.topic || ''}
          onChange={(e) => set('topic', e.target.value)} />
        <input className={INPUT_CLS} placeholder="Token (opcional)" value={config.token || ''}
          onChange={(e) => set('token', e.target.value)} />
      </>
    );
  }
  if (type === 'email') {
    return (
      <input className={INPUT_CLS} placeholder="Destinatarios separados por coma"
        value={(config.recipients || []).join(', ')}
        onChange={(e) => set('recipients', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />
    );
  }
  if (type === 'webhook') {
    return (
      <>
        <input className={INPUT_CLS} placeholder="URL" value={config.url || ''}
          onChange={(e) => set('url', e.target.value)} />
        <input className={INPUT_CLS} placeholder="Secret HMAC (opcional)" value={config.secret || ''}
          onChange={(e) => set('secret', e.target.value)} />
      </>
    );
  }
  return null;
}

/** Form de alta/edición de un canal — usado tanto para crear como editar (misma forma). */
function ChannelForm({ initial, onCancel, onSaved }) {
  const isEdit = !!initial?.id;
  const [type, setType] = useState(initial?.type || 'ntfy');
  const [name, setName] = useState(initial?.name || '');
  const [config, setConfig] = useState(initial?.config || emptyConfigFor('ntfy'));
  const [events, setEvents] = useState(initial?.events || []);
  const [deferToDigest, setDeferToDigest] = useState(initial?.defer_to_digest || false);
  const [saving, setSaving] = useState(false);

  const toggleEvent = (ev) => {
    setEvents((prev) => (prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]));
  };

  const submit = async () => {
    setSaving(true);
    try {
      const payload = { type, name, config, events, defer_to_digest: deferToDigest };
      if (isEdit) {
        await updateNotificationChannel(initial.id, payload);
      } else {
        await createNotificationChannel(payload);
      }
      toast.success(isEdit ? 'Canal actualizado' : 'Canal creado');
      onSaved();
    } catch (err) {
      toast.error(apiErrorMsg(err, 'No se pudo guardar el canal'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-tech-white">
          {isEdit ? 'Editar canal' : 'Nuevo canal'}
        </span>
        <button type="button" onClick={onCancel} className="text-gunmetal-dim hover:text-tech-white">
          <X size={16} />
        </button>
      </div>

      {!isEdit && (
        <div className="flex flex-wrap gap-1.5">
          {CHANNEL_TYPES.map(({ value, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => { setType(value); setConfig(emptyConfigFor(value)); }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs capitalize ${
                type === value
                  ? 'border-teal-500 text-teal-300 bg-teal-500/10'
                  : 'border-[var(--color-border-strong)] text-gunmetal hover:border-teal-500/50'
              }`}
            >
              <Icon size={13} /> {value}
            </button>
          ))}
        </div>
      )}

      <input
        className={INPUT_CLS}
        placeholder="Nombre del canal"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <div className="flex flex-col gap-2">
        <ConfigFields type={type} config={config} setConfig={setConfig} />
      </div>

      <div>
        <span className="lbl-eyebrow text-[9px] block mb-1.5">Eventos suscritos</span>
        <div className="flex flex-col gap-1">
          {NOTIFICATION_EVENTS.map((ev) => (
            <label key={ev} className="flex items-center gap-2 text-xs text-gunmetal cursor-pointer">
              <input type="checkbox" checked={events.includes(ev)} onChange={() => toggleEvent(ev)} />
              {ev}
            </label>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs text-gunmetal cursor-pointer">
        <input type="checkbox" checked={deferToDigest} onChange={(e) => setDeferToDigest(e.target.checked)} />
        Diferir a resumen diario durante horario silencioso (en vez de descartar)
      </label>

      <div className="flex gap-2 pt-1">
        <Button variant="primary" size="sm" onClick={submit} disabled={saving || !name}>
          {saving ? <Loader2 size={13} className="animate-spin" /> : 'Guardar'}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>
      </div>
    </Card>
  );
}

function ChannelRow({ channel, onEdit, onDeleted }) {
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const meta = CHANNEL_TYPES.find((c) => c.value === channel.type);
  const Icon = meta?.icon || Bell;

  const runTest = async () => {
    setTesting(true);
    try {
      const res = await testNotificationChannel(channel.id);
      if (res.data.ok) toast.success('Mensaje de prueba enviado');
      else toast.error(res.data.error || 'El canal respondió con error');
    } catch (err) {
      toast.error(apiErrorMsg(err, 'No se pudo probar el canal'));
    } finally {
      setTesting(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await deleteNotificationChannel(channel.id);
      toast.success('Canal borrado');
      onDeleted();
    } catch (err) {
      toast.error(apiErrorMsg(err, 'No se pudo borrar el canal'));
      setDeleting(false);
    }
  };

  return (
    <Card className="p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
          style={{ background: `${ACCENT}1A`, color: ACCENT }}>
          <Icon size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm text-tech-white font-medium truncate">{channel.name}</div>
          <div className="text-[11px] text-gunmetal-dim capitalize">{channel.type} · {channel.events.length} eventos</div>
        </div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${channel.enabled ? 'text-emerald-300 bg-emerald-500/10' : 'text-gunmetal-dim bg-white/5'}`}>
          {channel.enabled ? 'Activo' : 'Inactivo'}
        </span>
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={runTest} disabled={testing}>
          {testing ? <Loader2 size={12} className="animate-spin" /> : 'Probar'}
        </Button>
        <Button variant="ghost" size="sm" icon={Pencil} onClick={() => onEdit(channel)}>Editar</Button>
        <Button variant="ghost" size="sm" icon={Trash2} onClick={remove} disabled={deleting}>Borrar</Button>
      </div>
    </Card>
  );
}

function TemplatesSection() {
  const [event, setEvent] = useState(NOTIFICATION_EVENTS[0]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPreview(null);
    getNotificationTemplate(event)
      .then((res) => { if (!cancelled) setBody(res.data.body); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [event]);

  const runPreview = async () => {
    try {
      const res = await previewNotificationTemplate(event, body);
      setPreview(res.data);
    } catch (err) {
      toast.error(apiErrorMsg(err, 'No se pudo generar el preview'));
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateNotificationTemplate(event, body);
      toast.success('Template guardado');
    } catch (err) {
      toast.error(apiErrorMsg(err, 'Template inválido'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <select className={INPUT_CLS} value={event} onChange={(e) => setEvent(e.target.value)}>
        {NOTIFICATION_EVENTS.map((ev) => <option key={ev} value={ev}>{ev}</option>)}
      </select>
      <textarea
        className={`${INPUT_CLS} font-mono text-xs min-h-[110px]`}
        value={loading ? 'Cargando…' : body}
        disabled={loading}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={runPreview} disabled={loading}>Vista previa</Button>
        <Button variant="primary" size="sm" onClick={save} disabled={loading || saving}>
          {saving ? <Loader2 size={13} className="animate-spin" /> : 'Guardar'}
        </Button>
      </div>
      {preview && (
        preview.ok
          ? <p className="text-xs text-gunmetal bg-[var(--color-surf-card-2)] rounded-md p-2 border border-[var(--color-border-soft)]">{preview.rendered}</p>
          : <p className="text-xs text-red-400">{preview.error}</p>
      )}
    </div>
  );
}

export default function NotificationsDrawer({ open, onClose, isMobile }) {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getNotificationChannels();
      setChannels(res.data || []);
    } catch {
      // silent — el drawer muestra EmptyState si queda vacío
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) { load(); setFormOpen(false); setEditing(null); }
  }, [open]);

  const Body = (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="lbl-eyebrow text-[10px]">Canales</span>
          {!formOpen && (
            <Button variant="ghost" size="sm" icon={Plus} onClick={() => { setEditing(null); setFormOpen(true); }}>
              Nuevo canal
            </Button>
          )}
        </div>

        {formOpen && (
          <ChannelForm
            initial={editing}
            onCancel={() => setFormOpen(false)}
            onSaved={() => { setFormOpen(false); load(); }}
          />
        )}

        {!formOpen && (
          channels.length === 0 && !loading ? (
            <EmptyState icon={Bell} accent={ACCENT} title="Sin canales configurados"
              hint="Agrega Telegram, Discord, ntfy, email o un webhook para recibir avisos." />
          ) : (
            <div className="flex flex-col gap-2">
              {channels.map((c) => (
                <ChannelRow key={c.id} channel={c} onEdit={(ch) => { setEditing(ch); setFormOpen(true); }} onDeleted={load} />
              ))}
            </div>
          )
        )}
      </div>

      <div>
        <span className="lbl-eyebrow text-[10px] block mb-2">Templates</span>
        <TemplatesSection />
      </div>
    </div>
  );

  const Footer = (
    <Button variant="ghost" size="sm" onClick={onClose} className="flex-1 justify-center">
      Cerrar
    </Button>
  );

  if (isMobile) {
    return (
      <MobileSheet open={open} onClose={onClose} title="Notificaciones" height="full">
        <div className="px-5 pt-4 pb-3">{Body}</div>
        {open && (
          <div className="px-5 pt-3 pb-5 border-t border-[var(--color-border-soft)] flex flex-wrap gap-2 sticky bottom-0 bg-[var(--color-surf-sidebar)]">
            {Footer}
          </div>
        )}
      </MobileSheet>
    );
  }

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      eyebrow={`SETTINGS · NOTIFICACIONES (${channels.length})`}
      title="Notificaciones"
      width={560}
      footer={Footer}
    >
      {Body}
    </DetailDrawer>
  );
}
