/**
 * @file Página de gestión de usuarios de la empresa.
 *
 * Lista los usuarios de la empresa y permite crear nuevos (solo admin).
 * Ruta: /settings/users
 *
 * @module pages/settings/UsuariosPage
 */

import { useState, useEffect } from 'react';
import { getUsers, register, updateUser } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { Users, X, Pencil } from 'lucide-react';
import { apiErrorMsg } from '../../utils/apiError';

export default function UsuariosPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [newUserModal, setNewUserModal] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    username: '', email: '', password: '', is_admin: false,
  });
  const [creating, setCreating] = useState(false);

  const [editModal, setEditModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ new_password: '', confirm: '', is_admin: false });
  const [saving, setSaving] = useState(false);

  const openEdit = (u) => {
    setEditTarget(u);
    setEditForm({ new_password: '', confirm: '', is_admin: u.is_admin });
    setEditModal(true);
  };

  const loadUsers = async () => {
    try {
      const res = await getUsers();
      setUsers(res.data);
    } catch {
      toast.error('Error cargando usuarios');
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const handleEdit = async (e) => {
    e.preventDefault();
    const payload = { is_admin: editForm.is_admin };
    if (editForm.new_password) {
      if (editForm.new_password !== editForm.confirm) {
        toast.error('Las contraseñas no coinciden');
        return;
      }
      payload.new_password = editForm.new_password;
    }
    setSaving(true);
    try {
      await updateUser(editTarget.id, payload);
      toast.success('Usuario actualizado');
      setEditModal(false);
      loadUsers();
    } catch (err) {
      toast.error(apiErrorMsg(err, 'Error al actualizar usuario'));
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await register(newUserForm);
      toast.success('Usuario creado');
      setNewUserModal(false);
      setNewUserForm({ username: '', email: '', password: '', is_admin: false });
      loadUsers();
    } catch (err) {
      toast.error(apiErrorMsg(err, 'Error al crear usuario'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <h2 className="tf-page-title">Usuarios</h2>

      {user?.is_admin && (
        <div className="flex justify-end mb-4">
          <button onClick={() => setNewUserModal(true)} className="tf-btn-primary gap-2">
            <Users size={16} /> Agregar usuario
          </button>
        </div>
      )}

      {/* Modal editar usuario */}
      {editModal && editTarget && (
        <div className="tf-modal-overlay">
          <div className="tf-modal max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="tf-section-title">Editar — {editTarget.username}</h3>
              <button onClick={() => setEditModal(false)} className="tf-btn-ghost">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="tf-label">Nueva contraseña</label>
                <input
                  type="password"
                  className="tf-input"
                  value={editForm.new_password}
                  onChange={(e) => setEditForm((p) => ({ ...p, new_password: e.target.value }))}
                  minLength={8}
                  maxLength={128}
                  placeholder="Dejar vacío para no cambiar"
                />
              </div>
              {editForm.new_password && (
                <div>
                  <label className="tf-label">Confirmar contraseña</label>
                  <input
                    type="password"
                    className="tf-input"
                    value={editForm.confirm}
                    onChange={(e) => setEditForm((p) => ({ ...p, confirm: e.target.value }))}
                    placeholder="Repetir nueva contraseña"
                  />
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer text-sm text-steel">
                <input
                  type="checkbox"
                  checked={editForm.is_admin}
                  onChange={(e) => setEditForm((p) => ({ ...p, is_admin: e.target.checked }))}
                  className="rounded"
                />
                Administrador
              </label>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setEditModal(false)}
                  className="tf-btn-ghost px-4 py-2"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="tf-btn-primary px-4 py-2"
                >
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
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
            <form onSubmit={handleCreate} className="space-y-4">
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
                  disabled={creating}
                  className="tf-btn-primary px-4 py-2"
                >
                  {creating ? 'Creando...' : 'Crear usuario'}
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
              <th className="tf-th-right">Acciones</th>
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
                <td className="tf-td-right">
                  <button
                    onClick={() => openEdit(u)}
                    className="text-gunmetal hover:text-tech-white transition-colors"
                    title="Editar usuario"
                  >
                    <Pencil size={15} />
                  </button>
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
  );
}
