/**
 * @file Página de configuración de cuenta, empresa y usuarios.
 *
 * Presenta tres pestañas:
 * - Cuenta: cambiar username, email y contraseña del usuario actual.
 * - Empresa: editar el perfil de la empresa (nombre, slogan, dirección, etc.) y subir logo.
 * - Usuarios: listar y crear usuarios de la empresa (solo administradores).
 *
 * @module pages/AccountPage
 */

import { useState, useEffect, useRef } from 'react';
import {
  getCompany, updateCompany, uploadCompanyLogo,
  updateMe, getUsers, register,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { User, Building2, Users, X, Eye, EyeOff, Upload } from 'lucide-react';

const TABS = [
  { id: 'cuenta',   label: 'Cuenta',   icon: User },
  { id: 'empresa',  label: 'Empresa',  icon: Building2 },
  { id: 'usuarios', label: 'Usuarios', icon: Users },
];

export default function AccountPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('cuenta');

  // ── Cuenta ──────────────────────────────────────────────────────────────────
  const [accountForm, setAccountForm] = useState({ username: '', email: '' });
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);

  useEffect(() => {
    if (user) setAccountForm({ username: user.username, email: user.email });
  }, [user]);

  const handleSaveAccount = async (e) => {
    e.preventDefault();
    const payload = {};
    if (accountForm.username !== user.username) payload.username = accountForm.username;
    if (accountForm.email !== user.email) payload.email = accountForm.email;

    if (pwForm.new_password) {
      if (pwForm.new_password !== pwForm.confirm) {
        toast.error('Las contraseñas nuevas no coinciden');
        return;
      }
      payload.current_password = pwForm.current_password;
      payload.new_password = pwForm.new_password;
    }

    if (Object.keys(payload).length === 0) {
      toast('Sin cambios que guardar');
      return;
    }

    setSavingAccount(true);
    try {
      await updateMe(payload);
      toast.success('Perfil actualizado');
      setPwForm({ current_password: '', new_password: '', confirm: '' });
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Error al guardar';
      toast.error(msg);
    } finally {
      setSavingAccount(false);
    }
  };

  // ── Empresa ─────────────────────────────────────────────────────────────────
  const [company, setCompany] = useState(null);
  const [companyForm, setCompanyForm] = useState({
    name: '', slogan: '', address: '', phone: '', contact_email: '', nit: '',
  });
  const [savingCompany, setSavingCompany] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef(null);

  const loadCompany = async () => {
    try {
      const res = await getCompany();
      setCompany(res.data);
      setCompanyForm({
        name: res.data.name || '',
        slogan: res.data.slogan || '',
        address: res.data.address || '',
        phone: res.data.phone || '',
        contact_email: res.data.contact_email || '',
        nit: res.data.nit || '',
      });
    } catch {
      toast.error('Error cargando datos de la empresa');
    }
  };

  useEffect(() => {
    if (activeTab === 'empresa') loadCompany();
  }, [activeTab]);

  const handleSaveCompany = async (e) => {
    e.preventDefault();
    setSavingCompany(true);
    try {
      const res = await updateCompany(companyForm);
      setCompany(res.data);
      toast.success('Empresa actualizada');
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Error al guardar';
      toast.error(msg);
    } finally {
      setSavingCompany(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const res = await uploadCompanyLogo(file);
      setCompany(res.data);
      toast.success('Logo actualizado');
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Error al subir logo';
      toast.error(msg);
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  // ── Usuarios ─────────────────────────────────────────────────────────────────
  const [users, setUsers] = useState([]);
  const [newUserModal, setNewUserModal] = useState(false);
  const [newUserForm, setNewUserForm] = useState({ username: '', email: '', password: '', is_admin: false });
  const [creatingUser, setCreatingUser] = useState(false);

  const loadUsers = async () => {
    try {
      const res = await getUsers();
      setUsers(res.data);
    } catch {
      toast.error('Error cargando usuarios');
    }
  };

  useEffect(() => {
    if (activeTab === 'usuarios') loadUsers();
  }, [activeTab]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreatingUser(true);
    try {
      await register(newUserForm);
      toast.success('Usuario creado');
      setNewUserModal(false);
      setNewUserForm({ username: '', email: '', password: '', is_admin: false });
      loadUsers();
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Error al crear usuario';
      toast.error(msg);
    } finally {
      setCreatingUser(false);
    }
  };

  return (
    <div>
      <h2 className="tf-page-title">Mi Cuenta</h2>

      {/* Pestañas */}
      <div className="flex gap-2 mb-6">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === id
                ? 'bg-forge-green text-black'
                : 'bg-[#0d1014] border border-[#1e2125] text-steel hover:text-tech-white'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Pestaña Cuenta ──────────────────────────────────────────────────── */}
      {activeTab === 'cuenta' && (
        <form onSubmit={handleSaveAccount} className="tf-card p-6 max-w-lg space-y-4">
          <div>
            <label className="tf-label">Nombre de usuario</label>
            <input
              className="tf-input"
              value={accountForm.username}
              onChange={(e) => setAccountForm((p) => ({ ...p, username: e.target.value }))}
              minLength={3}
              maxLength={50}
              required
            />
          </div>
          <div>
            <label className="tf-label">Correo electrónico</label>
            <input
              type="email"
              className="tf-input"
              value={accountForm.email}
              onChange={(e) => setAccountForm((p) => ({ ...p, email: e.target.value }))}
              required
            />
          </div>

          <hr className="tf-hr" />
          <p className="text-sm font-medium text-steel">Cambiar contraseña</p>

          <div>
            <label className="tf-label">Contraseña actual</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                className="tf-input pr-10"
                value={pwForm.current_password}
                onChange={(e) => setPwForm((p) => ({ ...p, current_password: e.target.value }))}
                placeholder="Requerida para cambiar contraseña"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gunmetal hover:text-steel"
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="tf-label">Nueva contraseña</label>
              <input
                type="password"
                className="tf-input"
                value={pwForm.new_password}
                onChange={(e) => setPwForm((p) => ({ ...p, new_password: e.target.value }))}
                minLength={8}
                maxLength={128}
                placeholder="Mín. 8 caracteres"
              />
            </div>
            <div>
              <label className="tf-label">Confirmar contraseña</label>
              <input
                type="password"
                className="tf-input"
                value={pwForm.confirm}
                onChange={(e) => setPwForm((p) => ({ ...p, confirm: e.target.value }))}
                placeholder="Repetir nueva contraseña"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={savingAccount}
            className="tf-btn-primary w-full py-2.5 mt-2"
          >
            {savingAccount ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </form>
      )}

      {/* ── Pestaña Empresa ──────────────────────────────────────────────────── */}
      {activeTab === 'empresa' && (
        <div className="max-w-lg space-y-6">
          {/* Logo */}
          <div className="tf-card p-6">
            <p className="text-sm font-medium text-steel mb-3">Logo de la empresa</p>
            <div className="flex items-center gap-4">
              {company?.logo_url ? (
                <img
                  src={company.logo_url}
                  alt="Logo"
                  className="h-16 w-auto rounded-lg border border-[#2a2d31] object-contain bg-[#0d1014] p-1"
                />
              ) : (
                <div className="h-16 w-24 rounded-lg border border-[#2a2d31] bg-[#0d1014] flex items-center justify-center text-gunmetal text-xs">
                  Sin logo
                </div>
              )}
              <div>
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo || !user?.is_admin}
                  className="tf-btn-secondary gap-2 text-sm"
                >
                  <Upload size={14} />
                  {uploadingLogo ? 'Subiendo...' : 'Cambiar logo'}
                </button>
                {!user?.is_admin && (
                  <p className="text-xs text-gunmetal mt-1">Solo administradores</p>
                )}
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
              </div>
            </div>
          </div>

          {/* Datos empresa */}
          <form onSubmit={handleSaveCompany} className="tf-card p-6 space-y-4">
            <div>
              <label className="tf-label">Nombre de la empresa *</label>
              <input
                className="tf-input"
                value={companyForm.name}
                onChange={(e) => setCompanyForm((p) => ({ ...p, name: e.target.value }))}
                required
                disabled={!user?.is_admin}
              />
            </div>
            <div>
              <label className="tf-label">Slogan</label>
              <input
                className="tf-input"
                value={companyForm.slogan}
                onChange={(e) => setCompanyForm((p) => ({ ...p, slogan: e.target.value }))}
                placeholder="Ej: Impresión 3D de calidad"
                disabled={!user?.is_admin}
              />
            </div>
            <div>
              <label className="tf-label">Dirección</label>
              <input
                className="tf-input"
                value={companyForm.address}
                onChange={(e) => setCompanyForm((p) => ({ ...p, address: e.target.value }))}
                placeholder="Ej: Medellín, Antioquia, Colombia"
                disabled={!user?.is_admin}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="tf-label">Teléfono</label>
                <input
                  className="tf-input"
                  value={companyForm.phone}
                  onChange={(e) => setCompanyForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="+57 300 000 0000"
                  disabled={!user?.is_admin}
                />
              </div>
              <div>
                <label className="tf-label">Email de contacto</label>
                <input
                  type="email"
                  className="tf-input"
                  value={companyForm.contact_email}
                  onChange={(e) => setCompanyForm((p) => ({ ...p, contact_email: e.target.value }))}
                  placeholder="hola@empresa.com"
                  disabled={!user?.is_admin}
                />
              </div>
            </div>
            <div>
              <label className="tf-label">NIT</label>
              <input
                className="tf-input"
                value={companyForm.nit}
                onChange={(e) => setCompanyForm((p) => ({ ...p, nit: e.target.value }))}
                placeholder="900.000.000-0"
                disabled={!user?.is_admin}
              />
            </div>

            {user?.is_admin ? (
              <button
                type="submit"
                disabled={savingCompany}
                className="tf-btn-primary w-full py-2.5 mt-2"
              >
                {savingCompany ? 'Guardando...' : 'Guardar empresa'}
              </button>
            ) : (
              <p className="text-xs text-gunmetal text-center pt-2">
                Solo administradores pueden editar los datos de la empresa.
              </p>
            )}
          </form>
        </div>
      )}

      {/* ── Pestaña Usuarios ─────────────────────────────────────────────────── */}
      {activeTab === 'usuarios' && (
        <div>
          {user?.is_admin && (
            <div className="flex justify-end mb-4">
              <button
                onClick={() => setNewUserModal(true)}
                className="tf-btn-primary gap-2"
              >
                <Users size={16} /> Agregar usuario
              </button>
            </div>
          )}

          {/* Modal nuevo usuario */}
          {newUserModal && (
            <div className="tf-modal-overlay">
              <div className="tf-modal max-w-md">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="tf-section-title">Nuevo usuario</h3>
                  <button onClick={() => setNewUserModal(false)} className="tf-btn-ghost">
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div>
                    <label className="tf-label">Nombre de usuario *</label>
                    <input
                      className="tf-input"
                      value={newUserForm.username}
                      onChange={(e) => setNewUserForm((p) => ({ ...p, username: e.target.value }))}
                      required
                      minLength={3}
                    />
                  </div>
                  <div>
                    <label className="tf-label">Correo electrónico *</label>
                    <input
                      type="email"
                      className="tf-input"
                      value={newUserForm.email}
                      onChange={(e) => setNewUserForm((p) => ({ ...p, email: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="tf-label">Contraseña inicial *</label>
                    <input
                      type="password"
                      className="tf-input"
                      value={newUserForm.password}
                      onChange={(e) => setNewUserForm((p) => ({ ...p, password: e.target.value }))}
                      required
                      minLength={8}
                      placeholder="Mín. 8 caracteres"
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-steel">
                    <input
                      type="checkbox"
                      checked={newUserForm.is_admin}
                      onChange={(e) => setNewUserForm((p) => ({ ...p, is_admin: e.target.checked }))}
                      className="rounded"
                    />
                    Administrador
                  </label>
                  <div className="flex gap-3 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setNewUserModal(false)}
                      className="tf-btn-ghost px-4 py-2"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={creatingUser}
                      className="tf-btn-primary px-4 py-2"
                    >
                      {creatingUser ? 'Creando...' : 'Crear usuario'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Tabla de usuarios */}
          <div className="tf-table-wrap">
            <table className="w-full min-w-[500px]">
              <thead className="tf-thead border-b">
                <tr>
                  <th className="tf-th">Usuario</th>
                  <th className="tf-th">Email</th>
                  <th className="tf-th-right">Admin</th>
                  <th className="tf-th-right">Estado</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="tf-tr">
                    <td className="tf-td font-medium text-tech-white">
                      {u.username}
                      {u.id === user?.id && (
                        <span className="ml-2 text-xs text-forge-green">(tú)</span>
                      )}
                    </td>
                    <td className="tf-td text-steel">{u.email}</td>
                    <td className="tf-td-right">
                      {u.is_admin ? (
                        <span className="text-xs bg-forge-green/20 text-forge-green border border-forge-green/30 rounded px-2 py-0.5">Admin</span>
                      ) : (
                        <span className="text-xs text-gunmetal">—</span>
                      )}
                    </td>
                    <td className="tf-td-right">
                      {u.is_active ? (
                        <span className="text-xs text-forge-green">Activo</span>
                      ) : (
                        <span className="text-xs text-red-400">Inactivo</span>
                      )}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-gunmetal">
                      Cargando usuarios...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
