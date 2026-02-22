/**
 * @file Página de gestión de usuarios de la empresa.
 *
 * Lista los usuarios de la empresa y permite crear nuevos (solo admin).
 * Ruta: /settings/users
 *
 * @module pages/settings/UsuariosPage
 */

import { useState, useEffect } from 'react';
import { getUsers, register } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { Users, X } from 'lucide-react';

export default function UsuariosPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [newUserModal, setNewUserModal] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    username: '', email: '', password: '', is_admin: false,
  });
  const [creating, setCreating] = useState(false);

  const loadUsers = async () => {
    try {
      const res = await getUsers();
      setUsers(res.data);
    } catch {
      toast.error('Error cargando usuarios');
    }
  };

  useEffect(() => { loadUsers(); }, []);

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
      toast.error(err?.response?.data?.detail || 'Error al crear usuario');
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
  );
}
