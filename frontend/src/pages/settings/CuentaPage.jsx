/**
 * @file Página de configuración de la cuenta del usuario.
 *
 * Permite cambiar username, email y contraseña del usuario autenticado.
 * Ruta: /settings/account
 *
 * @module pages/settings/CuentaPage
 */

import { useState, useEffect } from 'react';
import { updateMe } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { Eye, EyeOff } from 'lucide-react';

export default function CuentaPage() {
  const { user } = useAuth();
  const [accountForm, setAccountForm] = useState({ username: '', email: '' });
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) setAccountForm({ username: user.username, email: user.email });
  }, [user]);

  const handleSave = async (e) => {
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

    setSaving(true);
    try {
      await updateMe(payload);
      toast.success('Perfil actualizado');
      setPwForm({ current_password: '', new_password: '', confirm: '' });
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2 className="tf-page-title">Cuenta</h2>

      <form onSubmit={handleSave} className="tf-card p-6 max-w-lg space-y-4">
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

        <button type="submit" disabled={saving} className="tf-btn-primary w-full py-2.5 mt-2">
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>
    </div>
  );
}
