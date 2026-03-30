/**
 * @file Página de configuración del perfil de empresa.
 *
 * Permite editar nombre, slogan, dirección, teléfono, email, NIT y logo.
 * Solo los administradores pueden guardar cambios.
 * Ruta: /settings/company
 *
 * @module pages/settings/EmpresaPage
 */

import { useState, useEffect, useRef } from 'react';
import { getCompany, updateCompany, uploadCompanyLogo } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { Upload } from 'lucide-react';
import { apiErrorMsg } from '../../utils/apiError';

export default function EmpresaPage() {
  const { user } = useAuth();
  const [company, setCompany] = useState(null);
  const [companyForm, setCompanyForm] = useState({
    name: '', slogan: '', address: '', phone: '', contact_email: '', nit: '',
  });
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef(null);

  useEffect(() => {
    const load = async () => {
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
    load();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await updateCompany(companyForm);
      setCompany(res.data);
      toast.success('Empresa actualizada');
    } catch (err) {
      toast.error(apiErrorMsg(err, 'Error al guardar'));
    } finally {
      setSaving(false);
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
      toast.error(apiErrorMsg(err, 'Error al subir logo'));
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  return (
    <div>
      <h2 className="tf-page-title">Empresa</h2>

      <div className="max-w-lg space-y-6">
        {/* Logo */}
        <div className="tf-card p-6">
          <p className="text-sm font-medium text-steel mb-3">Logo de la empresa</p>
          <div className="flex items-center gap-4">
            {company?.logo_url ? (
              <img
                src={company.logo_url}
                alt="Logo"
                className="h-16 w-auto rounded-lg border border-[#2A2F38] object-contain bg-[#0A0E16] p-1"
              />
            ) : (
              <div className="h-16 w-24 rounded-lg border border-[#2A2F38] bg-[#0A0E16] flex items-center justify-center text-gunmetal text-xs">
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
        <form onSubmit={handleSave} className="tf-card p-6 space-y-4">
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
            <button type="submit" disabled={saving} className="tf-btn-primary w-full py-2.5 mt-2">
              {saving ? 'Guardando...' : 'Guardar empresa'}
            </button>
          ) : (
            <p className="text-xs text-gunmetal text-center pt-2">
              Solo administradores pueden editar los datos de la empresa.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
