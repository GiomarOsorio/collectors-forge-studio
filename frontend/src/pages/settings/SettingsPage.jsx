/**
 * @file Página de la app Configuración (Settings).
 *
 * Dashboard con drawers integrados:
 *   - `AccountFormDrawer` — username/email/contraseña
 *   - `UsersDrawer` (solo admin) — lista de usuarios con edición inline
 *     (expand/collapse de cada fila para rol + cambio de contraseña)
 *
 * La card "Empresa" redirige a `/company` donde se edita el perfil.
 *
 * @module pages/settings/SettingsPage
 */

import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Eye,
  EyeOff,
  Pencil,
  Save,
  Settings as SettingsIcon,
  Shield,
  User as UserIcon,
  Users,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Button,
  Card,
  DetailDrawer,
  EmptyState,
  KPI,
  MobileSheet,
  StatusPill,
} from '../../components/ui';
import MobileAppHeader from '../../components/MobileAppHeader';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useAuth } from '../../context/AuthContext';
import { getUsers, updateMe, updateUser } from '../../services/api';
import { apiErrorMsg } from '../../utils/apiError';

const ACCENT = '#2DD4BF';

const ROLE_LABELS = { admin: 'Admin', operator: 'Operador', viewer: 'Visualizador' };

/**
 * Mapea el rol a metadata `StatusPill` (label + tone + icon).
 *
 * Tonos: admin → info (violeta), operator → printing (azul),
 *        viewer → neutral (gris).
 */
function roleBadge(role) {
  if (role === 'admin')    return { label: 'Admin',         tone: 'info',     icon: Shield };
  if (role === 'operator') return { label: 'Operador',      tone: 'printing', icon: UserIcon };
  if (role === 'viewer')   return { label: 'Visualizador',  tone: 'neutral',  icon: Eye };
  return { label: role || '—', tone: 'neutral', icon: undefined };
}

// ── Form helpers a module-level (anti bug cursor jump) ──────────────────────

const FORM_INPUT_CLS =
  'w-full bg-[var(--color-surf-card-2)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-1.5 text-tech-white text-sm focus:outline-none focus:border-teal-500 placeholder:text-gunmetal-dim';

function FormSectionTitle({ children }) {
  return (
    <span className="lbl-eyebrow text-[9px] block mt-3 mb-1.5 first:mt-0">
      {children}
    </span>
  );
}

function FormFieldRow({ label, hint, required, children }) {
  return (
    <label className="block">
      <span className="block text-xs text-gunmetal mb-1">
        {label}
        {required && <span className="text-rose-400"> *</span>}
      </span>
      {children}
      {hint && <span className="block text-[10.5px] text-gunmetal-dim mt-1">{hint}</span>}
    </label>
  );
}

// ─── AccountFormDrawer ──────────────────────────────────────────────────────

/**
 * Drawer para editar la cuenta del usuario autenticado: username + email +
 * cambio de contraseña opcional. Reemplaza V1 `/settings/account`.
 *
 * NOTA: el login del sistema es vía OIDC (Authentik), `hashed_password` es
 * siempre NULL para usuarios JIT-provisioned. La sección de contraseña
 * sigue acá por compatibilidad con usuarios legacy/admin con password local.
 */
function AccountFormDrawer({ open, user, onClose, onSaved, isMobile }) {
  const [form, setForm] = useState({ username: '', email: '' });
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setForm({ username: user.username || '', email: user.email || '' });
    setPw({ current: '', next: '', confirm: '' });
    setShowPw(false);
    setSaving(false);
  }, [open, user]);

  const handleSave = async (e) => {
    e?.preventDefault?.();
    const payload = {};
    if (form.username !== user.username) payload.username = form.username;
    if (form.email !== user.email) payload.email = form.email;
    if (pw.next) {
      if (pw.next !== pw.confirm) {
        toast.error('Las contraseñas nuevas no coinciden');
        return;
      }
      payload.current_password = pw.current;
      payload.new_password = pw.next;
    }
    if (Object.keys(payload).length === 0) {
      toast('Sin cambios que guardar');
      return;
    }
    setSaving(true);
    try {
      await updateMe(payload);
      toast.success('Cuenta actualizada');
      onSaved?.(payload);
    } catch (err) {
      toast.error(apiErrorMsg(err, 'Error al guardar'));
    } finally {
      setSaving(false);
    }
  };

  const Body = (
    <form id="account-form" onSubmit={handleSave} className="flex flex-col">
      <FormSectionTitle>Perfil</FormSectionTitle>
      <FormFieldRow label="Nombre de usuario" required>
        <input
          required
          minLength={3}
          maxLength={50}
          className={FORM_INPUT_CLS}
          value={form.username}
          onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
        />
      </FormFieldRow>
      <FormFieldRow label="Correo electrónico" required>
        <input
          type="email"
          required
          className={FORM_INPUT_CLS}
          value={form.email}
          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
        />
      </FormFieldRow>

      <FormSectionTitle>Cambiar contraseña</FormSectionTitle>
      <p className="text-[11px] text-gunmetal mb-1.5">
        Opcional. Si entras vía OIDC no necesitas contraseña local.
      </p>
      <FormFieldRow label="Contraseña actual">
        <div className="relative">
          <input
            type={showPw ? 'text' : 'password'}
            className={`${FORM_INPUT_CLS} pr-9`}
            value={pw.current}
            onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
            placeholder="Requerida solo si cambias la contraseña"
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gunmetal hover:text-steel"
            aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </FormFieldRow>
      <div className="grid grid-cols-2 gap-2.5">
        <FormFieldRow label="Nueva contraseña">
          <input
            type="password"
            minLength={8}
            maxLength={128}
            className={FORM_INPUT_CLS}
            value={pw.next}
            onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
            placeholder="Mín. 8 caracteres"
          />
        </FormFieldRow>
        <FormFieldRow label="Confirmar">
          <input
            type="password"
            className={FORM_INPUT_CLS}
            value={pw.confirm}
            onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
            placeholder="Repetir"
          />
        </FormFieldRow>
      </div>
    </form>
  );

  const Footer = (
    <>
      <Button variant="ghost" size="sm" onClick={onClose} className="flex-1 justify-center">
        Cancelar
      </Button>
      <Button
        variant="primary"
        size="sm"
        type="submit"
        form="account-form"
        icon={Save}
        disabled={saving}
        className="flex-1 justify-center"
      >
        {saving ? 'Guardando…' : 'Guardar'}
      </Button>
    </>
  );

  if (isMobile) {
    return (
      <MobileSheet open={open} onClose={onClose} title="Mi cuenta" height="full">
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
      eyebrow="SETTINGS · CUENTA"
      title="Mi cuenta"
      width={520}
      footer={Footer}
    >
      {Body}
    </DetailDrawer>
  );
}

// ─── UsersDrawer ────────────────────────────────────────────────────────────

/**
 * Fila editable en línea de un usuario dentro del UsersDrawer. Cuando
 * el admin hace click en "Editar", el row se expande mostrando inputs
 * para rol + cambio de contraseña sin abrir un segundo drawer.
 */
function UserRow({ u, currentUserId, expanded, onToggle, onSaved }) {
  const badge = roleBadge(u.role);
  const [role, setRole] = useState(u.role || 'viewer');
  const [pw, setPw] = useState({ next: '', confirm: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (expanded) {
      setRole(u.role || 'viewer');
      setPw({ next: '', confirm: '' });
    }
  }, [expanded, u.role]);

  const isSelf = u.id === currentUserId;

  const handleSave = async (e) => {
    e?.preventDefault?.();
    const payload = {};
    if (role !== u.role) payload.role = role;
    if (pw.next) {
      if (pw.next !== pw.confirm) {
        toast.error('Las contraseñas no coinciden');
        return;
      }
      payload.new_password = pw.next;
    }
    if (Object.keys(payload).length === 0) {
      toast('Sin cambios que guardar');
      return;
    }
    setSaving(true);
    try {
      await updateUser(u.id, payload);
      toast.success(`Usuario "${u.username}" actualizado`);
      onSaved?.();
    } catch (err) {
      toast.error(apiErrorMsg(err, 'Error al actualizar'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="bg-[var(--color-surf-card)] border border-[var(--color-border-soft)] rounded-md overflow-hidden">
      <button
        type="button"
        onClick={() => onToggle(u.id)}
        className="w-full text-left flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--color-surf-hover)]/40 transition-colors"
      >
        <span
          className="inline-flex items-center justify-center w-8 h-8 rounded-md shrink-0"
          style={{
            background: u.is_active ? `${ACCENT}1A` : 'rgba(248,113,113,0.10)',
            color: u.is_active ? ACCENT : '#F87171',
            border: `1px solid ${u.is_active ? `${ACCENT}40` : 'rgba(248,113,113,0.30)'}`,
          }}
        >
          <UserIcon size={14} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <StatusPill tone={badge.tone} icon={badge.icon}>
              {badge.label}
            </StatusPill>
            {!u.is_active && (
              <StatusPill tone="danger">Inactivo</StatusPill>
            )}
            {isSelf && (
              <span className="mono text-[9.5px] text-forge-teal">· tú</span>
            )}
          </div>
          <p className="text-sm font-semibold text-tech-white truncate">{u.username}</p>
          <p className="mono text-[10.5px] text-gunmetal truncate">{u.email}</p>
        </div>
        {expanded ? (
          <ChevronUp size={14} className="text-gunmetal-dim shrink-0" />
        ) : (
          <ChevronDown size={14} className="text-gunmetal-dim shrink-0" />
        )}
      </button>

      {expanded && (
        <form onSubmit={handleSave} className="border-t border-[var(--color-border-soft)] p-3 flex flex-col gap-2.5">
          <FormFieldRow label="Rol" hint={isSelf ? 'No puedes cambiar tu propio rol.' : undefined}>
            <select
              className={FORM_INPUT_CLS}
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={isSelf}
            >
              <option value="admin">Admin</option>
              <option value="operator">Operador</option>
              <option value="viewer">Visualizador</option>
            </select>
          </FormFieldRow>
          <div className="grid grid-cols-2 gap-2.5">
            <FormFieldRow label="Nueva contraseña" hint="Vacío = no cambiar">
              <input
                type="password"
                minLength={8}
                maxLength={128}
                className={FORM_INPUT_CLS}
                value={pw.next}
                onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
                placeholder="Mín. 8 caracteres"
              />
            </FormFieldRow>
            <FormFieldRow label="Confirmar">
              <input
                type="password"
                className={FORM_INPUT_CLS}
                value={pw.confirm}
                onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
                placeholder="Repetir"
              />
            </FormFieldRow>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onToggle(u.id)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              icon={Save}
              disabled={saving}
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </form>
      )}
    </li>
  );
}

/**
 * Drawer/sheet con la lista de usuarios. Solo admin. Cada fila expande
 * inline para editar rol + contraseña.
 */
function UsersDrawer({ open, users, currentUserId, onClose, onChanged, isMobile }) {
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (!open) setExpandedId(null);
  }, [open]);

  const toggle = (id) => setExpandedId((prev) => (prev === id ? null : id));

  const Body = users.length === 0 ? (
    <EmptyState
      icon={Users}
      accent={ACCENT}
      title="Sin usuarios cargados"
      hint="Cuando alguien haga su primer login vía OIDC aparecerá aquí."
    />
  ) : (
    <ul className="flex flex-col gap-2">
      {users.map((u) => (
        <UserRow
          key={u.id}
          u={u}
          currentUserId={currentUserId}
          expanded={expandedId === u.id}
          onToggle={toggle}
          onSaved={() => {
            setExpandedId(null);
            onChanged?.();
          }}
        />
      ))}
    </ul>
  );

  const Footer = (
    <Button variant="ghost" size="sm" onClick={onClose} className="flex-1 justify-center">
      Cerrar
    </Button>
  );

  if (isMobile) {
    return (
      <MobileSheet open={open} onClose={onClose} title="Usuarios" height="full">
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
      eyebrow={`SETTINGS · USUARIOS (${users.length})`}
      title="Gestión de usuarios"
      width={560}
      footer={Footer}
    >
      {Body}
    </DetailDrawer>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const isMobile = useIsMobile();
  const { openSidebar } = useOutletContext() || {};
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [accountOpen, setAccountOpen] = useState(false);
  const [usersOpen, setUsersOpen] = useState(false);

  const loadUsers = async () => {
    if (!isAdmin) return;
    setLoadingUsers(true);
    try {
      const res = await getUsers();
      setUsers(res.data || []);
    } catch {
      // silent — la card de Usuarios muestra el contador, el drawer maneja el error.
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const badge = useMemo(() => roleBadge(user?.role), [user?.role]);

  const sections = useMemo(() => {
    const out = [
      {
        id: 'account',
        icon: UserIcon,
        title: 'Mi cuenta',
        desc: 'Cambia tu nombre de usuario, email o contraseña local.',
        status: user?.email || '—',
        complete: !!(user?.username && user?.email),
        onClick: () => setAccountOpen(true),
        visible: true,
      },
      {
        id: 'company',
        icon: Building2,
        title: 'Empresa',
        desc: 'El perfil de la empresa ahora se edita en Compañía › Resumen.',
        status: 'Ir a /company',
        complete: true,
        onClick: () => {
          window.location.assign('/company');
        },
        visible: isAdmin,
      },
      {
        id: 'users',
        icon: Users,
        title: 'Usuarios',
        desc: 'Listar usuarios y editar su rol o contraseña. Solo admin.',
        status: loadingUsers
          ? 'Cargando…'
          : users.length > 0
          ? `${users.length} usuarios`
          : 'Sin cargar',
        complete: users.length > 0,
        onClick: () => setUsersOpen(true),
        visible: isAdmin,
      },
    ];
    return out.filter((s) => s.visible);
  }, [user, isAdmin, users, loadingUsers]);

  const KPIs = (
    <div className="flex flex-wrap gap-3 px-6 pt-4 pb-2">
      <div className="flex-1 min-w-[180px] flex">
        <KPI
          label="Mi cuenta"
          value={user?.username || '—'}
          sub={user?.email || 'sin email'}
          accent={ACCENT}
          icon={UserIcon}
        />
      </div>
      <div className="flex-1 min-w-[180px] flex">
        <KPI
          label="Rol"
          value={badge.label}
          sub={isAdmin ? 'acceso completo' : 'acceso limitado'}
          accent={badge.tone === 'info' ? '#A78BFA' : '#3B82F6'}
          icon={Shield}
        />
      </div>
      {isAdmin && (
        <div className="flex-1 min-w-[180px] flex">
          <KPI
            label="Usuarios"
            value={users.length}
            unit="docs"
            sub={
              users.filter((u) => u.role === 'admin').length > 0
                ? `${users.filter((u) => u.role === 'admin').length} admins`
                : 'sin admins'
            }
            accent="#34D399"
            icon={Users}
          />
        </div>
      )}
    </div>
  );

  const SectionList = (
    <div
      className={isMobile ? 'flex flex-col gap-2 px-4 mt-3 pb-8' : 'px-6 pt-4 pb-8 grid gap-3'}
      style={isMobile ? undefined : { gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}
    >
      {sections.map((s) => {
        const Icon = s.icon;
        return (
          <Card
            key={s.id}
            as="button"
            interactive
            onClick={s.onClick}
            className="text-left w-full p-4 h-full flex flex-col gap-3"
          >
            <div className="flex items-start gap-3">
              <span
                className="inline-flex items-center justify-center w-10 h-10 rounded-lg shrink-0"
                style={{
                  background: `${ACCENT}1A`,
                  color: ACCENT,
                  border: `1px solid ${ACCENT}40`,
                }}
              >
                <Icon size={18} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  {s.complete ? (
                    <StatusPill tone="done" icon={CheckCircle2}>
                      Configurado
                    </StatusPill>
                  ) : (
                    <StatusPill tone="warn">Pendiente</StatusPill>
                  )}
                </div>
                <p className="text-base font-semibold text-tech-white">{s.title}</p>
                <p className="mono text-[10.5px] text-gunmetal mt-0.5 truncate">{s.status}</p>
              </div>
              <ChevronRight size={14} className="text-gunmetal-dim shrink-0 mt-1" />
            </div>
            <p className="text-sm text-steel leading-snug">{s.desc}</p>
          </Card>
        );
      })}
    </div>
  );

  const Drawers = (
    <>
      <AccountFormDrawer
        open={accountOpen}
        user={user}
        onClose={() => setAccountOpen(false)}
        onSaved={() => {
          setAccountOpen(false);
          // NOTA: el username/email se persiste en BD pero el sidebar/header
          // sigue mostrando el valor cacheado en AuthContext hasta el próximo
          // login. AuthContext no expone método `refresh()` por ahora;
          // agregarlo es un PR aparte si Giomar quiere reflejarlo en vivo.
        }}
        isMobile={isMobile}
      />
      {isAdmin && (
        <UsersDrawer
          open={usersOpen}
          users={users}
          currentUserId={user?.id}
          onClose={() => setUsersOpen(false)}
          onChanged={loadUsers}
          isMobile={isMobile}
        />
      )}
    </>
  );

  if (isMobile) {
    return (
      <div className="flex flex-col pb-8">
        <MobileAppHeader
          appName="Settings"
          appIcon={SettingsIcon}
          appAccent={ACCENT}
          title="Configuración"
          onMenu={() => openSidebar?.()}
        />
        <div className="px-4 mt-3">
          <Card className="p-4 flex flex-col gap-2 industrial-grid">
            <span className="lbl-eyebrow">Sesión</span>
            <p className="mono text-lg font-semibold text-tech-white tracking-tight">
              {user?.username || '—'}
            </p>
            <div className="flex items-center gap-1.5">
              <StatusPill tone={badge.tone} icon={badge.icon}>
                {badge.label}
              </StatusPill>
              <span className="mono text-[10.5px] text-gunmetal">{user?.email || ''}</span>
            </div>
          </Card>
        </div>
        {SectionList}
        {Drawers}
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen -m-4 md:-m-6 xl:-m-8">
      <header className="flex items-center gap-4 px-6 py-3.5 border-b border-[var(--color-border-soft)] bg-[var(--color-surf-sidebar)] sticky top-0 z-20">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-md shrink-0"
            style={{ background: `${ACCENT}1F`, color: ACCENT, border: `1px solid ${ACCENT}40` }}
          >
            <SettingsIcon size={13} />
          </span>
          <span className="text-sm text-gunmetal whitespace-nowrap">Settings</span>
          <span className="text-gunmetal-dim shrink-0">›</span>
          <span className="text-sm font-semibold text-tech-white whitespace-nowrap">Configuración</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            icon={Pencil}
            onClick={() => setAccountOpen(true)}
          >
            Editar cuenta
          </Button>
        </div>
      </header>

      {KPIs}
      {SectionList}
      {Drawers}

      <footer className="mt-auto px-6 py-2.5 border-t border-[var(--color-border-soft)] bg-[var(--color-surf-sidebar)] flex flex-wrap items-center gap-4 text-[11px] text-gunmetal">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px #34D39966' }} />
          <span className="mono">CONECTADO</span>
        </span>
        <span className="w-px h-3 bg-[var(--color-border)]" />
        <span className="mono">{user?.username || '—'}</span>
        <span className="mono">· {badge.label.toLowerCase()}</span>
        <span className="flex-1" />
        <span className="mono">es-CO</span>
      </footer>
    </div>
  );
}
