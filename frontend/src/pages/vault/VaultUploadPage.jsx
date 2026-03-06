/**
 * @file Página de subida de modelos .3mf al Vault.
 *
 * Flujo en 2 pasos:
 * 1. URL → "Obtener metadata" → pre-rellena el formulario
 * 2. Completar / ajustar datos + seleccionar archivo → subir con barra de progreso
 *
 * Solo accesible para usuarios con is_admin=true. Los no-admins son
 * redirigidos a /vault al montar el componente.
 *
 * @module pages/vault/VaultUploadPage
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Link as LinkIcon, X, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { fetchVaultMetadata, uploadVaultFile } from '../../services/api';

export default function VaultUploadPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Redirigir si no es admin
  useEffect(() => {
    if (user && !user.is_admin) {
      navigate('/vault', { replace: true });
    }
  }, [user, navigate]);

  const [urlInput, setUrlInput] = useState('');
  const [fetchingMeta, setFetchingMeta] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    thumbnail_url: '',
    source_url: '',
    source_platform: '',
    creator_name: '',
    creator_url: '',
    tags: '',
  });

  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  const fileRef = useRef(null);

  const handleFetchMeta = async () => {
    if (!urlInput.trim()) return;
    setFetchingMeta(true);
    try {
      const res = await fetchVaultMetadata(urlInput.trim());
      const m = res.data;
      setForm((prev) => ({
        ...prev,
        name:            m.name            ?? prev.name,
        description:     m.description     ?? prev.description,
        thumbnail_url:   m.thumbnail_url   ?? prev.thumbnail_url,
        source_url:      urlInput.trim(),
        source_platform: m.source_platform ?? prev.source_platform,
        creator_name:    m.creator_name    ?? prev.creator_name,
        creator_url:     m.creator_url     ?? prev.creator_url,
      }));
      toast.success('Metadata obtenida correctamente');
    } catch {
      toast.error('No se pudo obtener la metadata de esa URL');
    } finally {
      setFetchingMeta(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error('Selecciona un archivo .3mf');
      return;
    }
    if (!form.name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    const tagsArr = form.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const metadata = {
      name:            form.name.trim(),
      description:     form.description.trim() || null,
      thumbnail_url:   form.thumbnail_url.trim() || null,
      source_url:      form.source_url.trim() || null,
      source_platform: form.source_platform || null,
      creator_name:    form.creator_name.trim() || null,
      creator_url:     form.creator_url.trim() || null,
      tags:            tagsArr,
    };

    const formData = new FormData();
    formData.append('file', file);
    formData.append('metadata', JSON.stringify(metadata));

    setUploading(true);
    setProgress(0);

    try {
      await uploadVaultFile(formData, (evt) => {
        if (evt.total) {
          setProgress(Math.round((evt.loaded / evt.total) * 100));
        }
      });
      setDone(true);
      toast.success('Archivo subido correctamente');
    } catch (err) {
      const msg = err.response?.data?.detail ?? 'Error al subir el archivo';
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setForm({
      name: '', description: '', thumbnail_url: '', source_url: '',
      source_platform: '', creator_name: '', creator_url: '', tags: '',
    });
    setFile(null);
    setUrlInput('');
    setProgress(0);
    setDone(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  if (done) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <CheckCircle size={56} className="text-rose-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-steel mb-2">¡Archivo subido!</h2>
        <p className="text-gunmetal mb-6">El modelo .3mf está disponible en la galería.</p>
        <div className="flex gap-3 justify-center">
          <button className="tf-btn-ghost" onClick={() => navigate('/vault')}>
            Ver galería
          </button>
          <button className="tf-btn-primary" onClick={resetForm}>
            Subir otro
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-steel mb-1">Subir modelo al Vault</h1>
      <p className="text-sm text-gunmetal mb-6">
        Sube un archivo .3mf probado. Opcionalmente pega la URL del modelo para
        pre-rellenar los metadatos automáticamente.
      </p>

      {/* Paso 1: obtener metadata desde URL */}
      <div className="bg-surface border border-border rounded-xl p-5 mb-5">
        <h2 className="text-sm font-semibold text-steel mb-3 flex items-center gap-2">
          <LinkIcon size={14} className="text-rose-400" />
          Obtener metadata desde URL <span className="text-gunmetal font-normal">(opcional)</span>
        </h2>
        <div className="flex gap-2">
          <input
            className="tf-input flex-1"
            placeholder="https://makerworld.com/en/models/…"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleFetchMeta()}
          />
          <button
            type="button"
            className="tf-btn-primary whitespace-nowrap"
            onClick={handleFetchMeta}
            disabled={fetchingMeta || !urlInput.trim()}
          >
            {fetchingMeta ? 'Obteniendo…' : 'Obtener metadata'}
          </button>
        </div>
      </div>

      {/* Paso 2: formulario + archivo */}
      <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-steel flex items-center gap-2">
          <Upload size={14} className="text-rose-400" />
          Datos del modelo
        </h2>

        {/* Nombre */}
        <div>
          <label className="block text-xs text-gunmetal mb-1">
            Nombre <span className="text-rose-500">*</span>
          </label>
          <input
            className="tf-input w-full"
            placeholder="Nombre display del modelo"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            required
          />
        </div>

        {/* Descripción */}
        <div>
          <label className="block text-xs text-gunmetal mb-1">Descripción</label>
          <textarea
            className="tf-input w-full h-24 resize-none"
            placeholder="Descripción del modelo, notas de impresión, etc."
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          />
        </div>

        {/* Grid de dos columnas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gunmetal mb-1">Plataforma</label>
            <select
              className="tf-input w-full"
              value={form.source_platform}
              onChange={(e) => setForm((p) => ({ ...p, source_platform: e.target.value }))}
            >
              <option value="">— Seleccionar —</option>
              <option value="makerworld">MakerWorld</option>
              <option value="printables">Printables</option>
              <option value="thingiverse">Thingiverse</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gunmetal mb-1">Creador</label>
            <input
              className="tf-input w-full"
              placeholder="Nombre del diseñador"
              value={form.creator_name}
              onChange={(e) => setForm((p) => ({ ...p, creator_name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gunmetal mb-1">URL de origen</label>
            <input
              className="tf-input w-full"
              placeholder="https://…"
              value={form.source_url}
              onChange={(e) => setForm((p) => ({ ...p, source_url: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gunmetal mb-1">URL miniatura</label>
            <input
              className="tf-input w-full"
              placeholder="https://…/thumbnail.jpg"
              value={form.thumbnail_url}
              onChange={(e) => setForm((p) => ({ ...p, thumbnail_url: e.target.value }))}
            />
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-xs text-gunmetal mb-1">
            Tags <span className="text-gunmetal/60">(separados por coma)</span>
          </label>
          <input
            className="tf-input w-full"
            placeholder="ej: minis, soporte, PLA"
            value={form.tags}
            onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))}
          />
        </div>

        {/* Archivo .3mf */}
        <div>
          <label className="block text-xs text-gunmetal mb-1">
            Archivo .3mf <span className="text-rose-500">*</span>
          </label>
          <input
            ref={fileRef}
            type="file"
            accept=".3mf"
            className="tf-input w-full file:mr-3 file:bg-rose-500/10 file:text-rose-400 file:border-0 file:rounded file:px-3 file:py-1 file:cursor-pointer"
            onChange={(e) => setFile(e.target.files[0] ?? null)}
          />
          {file && (
            <p className="text-xs text-gunmetal mt-1 font-mono">
              {file.name} — {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          )}
        </div>

        {/* Barra de progreso */}
        {uploading && (
          <div>
            <div className="flex items-center justify-between text-xs text-gunmetal mb-1">
              <span>Subiendo…</span>
              <span className="font-mono">{progress}%</span>
            </div>
            <div className="h-2 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-rose-500 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Acciones */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            className="tf-btn-ghost"
            onClick={resetForm}
            disabled={uploading}
          >
            Limpiar
          </button>
          <button
            type="submit"
            className="tf-btn-primary flex items-center gap-2"
            disabled={uploading || !file || !form.name.trim()}
          >
            {uploading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Subiendo…
              </>
            ) : (
              <>
                <Upload size={14} />
                Subir al Vault
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
