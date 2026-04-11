/**
 * @file Página de gestión de usuarios.
 *
 * Lista los usuarios del sistema y permite al administrador cambiar
 * el rol y la contraseña de cualquier usuario.
 * Ruta: /settings/users
 *
 * @module pages/settings/UsuariosPage
 */

import { useState, useEffect } from 'react';
import { getUsers, updateUser } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { X, Pencil } from 'lucide-react';
import { apiErrorMsg } from '../../utils/apiError';

const ROLE_LABELS = {
  admin: 'Admin',
  operator: 'Operador',
  viewer: 'Visualizador',
};

const ROLE_COLORS = {
  admin: 'bg-forge-teal/20 text-forge-teal border border-forge-teal/30',
  operator: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  viewer: 'bg-gunmetal/40 text-steel border border-gunmetal/60',
};

export default function UsuariosPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);

  const [editModal, setEditModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ new_password: '', confirm: '', role: 'operator' });
  const [saving, setSaving] = useState(false);

  const openEdit = (u) => {
    setEditTarget(u);
    setEditForm({ new_password: '', confirm: '', role: u.role ?? 'operator' });
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
    const payload = { role: editForm.role };
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

  return (
    <div>
      <h2 className="tf-page-title">Usuarios</h2>

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
              <div>
                <label className="tf-label">Rol</label>
                <select
                  className="tf-input"
                  value={editForm.role}
                  onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))}
                  disabled={editTarget?.id === user?.id}
                >
                  <option value="admin">Admin</option>
                  <option value="operator">Operador</option>
                  <option value="viewer">Visualizador</option>
                </select>
                {editTarget?.id === user?.id && (
                  <p className="text-xs text-gunmetal mt-1">No puedes cambiar tu propio rol.</p>
                )}
              </div>
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

      {/* Tabla de usuarios */}
      <div className="tf-table-wrap">
        <table className="w-full min-w-[500px]">
          <thead className="tf-thead border-b">
            <tr>
              <th className="tf-th">Usuario</th>
              <th className="tf-th">Email</th>
              <th className="tf-th-right">Rol</th>
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
                    <span className="ml-2 text-xs text-forge-teal">(tú)</span>
                  )}
                </td>
                <td className="tf-td text-steel">{u.email}</td>
                <td className="tf-td-right">
                  <span className={`text-xs rounded px-2 py-0.5 ${ROLE_COLORS[u.role] ?? ROLE_COLORS.viewer}`}>
                    {ROLE_LABELS[u.role] ?? u.role}
                  </span>
                </td>
                <td className="tf-td-right">
                  {u.is_active ? (
                    <span className="text-xs text-forge-teal">Activo</span>
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
                <td colSpan={5} className="px-5 py-12 text-center text-gunmetal">
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
