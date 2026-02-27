/**
 * @file Página de lista de templates de cotización Liquid.
 *
 * Muestra los templates de la empresa con sus acciones: establecer como
 * default, editar, previsualizar PDF y eliminar.
 * Ruta: /company/templates
 *
 * @module pages/company/CompanyTemplatesPage
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getCompanyTemplates,
  deleteCompanyTemplate,
  setDefaultTemplate,
  previewTemplate,
} from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { apiErrorMsg } from '../../utils/apiError';
import { Plus, Pencil, Trash2, Star, Eye, FileCode } from 'lucide-react';

/** Etiqueta legible del tipo de template */
const TYPE_LABELS = { cot: 'COT', all: 'Todos' };

export default function CompanyTemplatesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewingId, setPreviewingId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getCompanyTemplates();
      setTemplates(res.data);
    } catch {
      toast.error('Error cargando templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este template?')) return;
    try {
      await deleteCompanyTemplate(id);
      toast.success('Template eliminado');
      load();
    } catch (err) {
      toast.error(apiErrorMsg(err, 'Error al eliminar'));
    }
  };

  const handleSetDefault = async (id) => {
    try {
      await setDefaultTemplate(id);
      toast.success('Template marcado como default');
      load();
    } catch (err) {
      toast.error(apiErrorMsg(err, 'Error al establecer default'));
    }
  };

  const handlePreview = async (id) => {
    setPreviewingId(id);
    try {
      const res = await previewTemplate(id);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      toast.error(apiErrorMsg(err, 'Error generando preview'));
    } finally {
      setPreviewingId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="tf-page-title mb-0">Templates PDF</h2>
        {user?.is_admin && (
          <button
            onClick={() => navigate('/company/templates/new')}
            className="tf-btn-primary gap-2 text-sm"
          >
            <Plus size={16} />
            Nuevo template
          </button>
        )}
      </div>

      <p className="text-sm text-gunmetal mb-6">
        Los templates Liquid permiten personalizar el diseño del PDF de cotización COT-XXXX.
        El template marcado como <strong className="text-steel">Default</strong> se usa automáticamente al descargar.
        Si no hay template activo, se usa ReportLab con la paleta configurada en Marca & Colores.
      </p>

      {loading ? (
        <p className="text-steel text-sm">Cargando...</p>
      ) : templates.length === 0 ? (
        <div className="tf-card p-10 text-center">
          <FileCode size={40} className="mx-auto text-gunmetal mb-3" />
          <p className="text-steel mb-4">No hay templates creados.</p>
          {user?.is_admin && (
            <button
              onClick={() => navigate('/company/templates/new')}
              className="tf-btn-primary gap-2"
            >
              <Plus size={16} />
              Crear primer template
            </button>
          )}
        </div>
      ) : (
        <div className="tf-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e2125]">
                  <th className="text-left px-4 py-3 text-gunmetal font-medium">Nombre</th>
                  <th className="text-left px-4 py-3 text-gunmetal font-medium">Tipo</th>
                  <th className="text-left px-4 py-3 text-gunmetal font-medium">Estado</th>
                  <th className="text-left px-4 py-3 text-gunmetal font-medium">Creado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {templates.map((tpl) => (
                  <tr key={tpl.id} className="border-b border-[#1e2125] hover:bg-[#0d1014] transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-tech-white font-medium">{tpl.name}</span>
                      {tpl.description && (
                        <p className="text-xs text-gunmetal mt-0.5">{tpl.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs font-mono bg-[#1e2125] text-steel">
                        {TYPE_LABELS[tpl.template_type] || tpl.template_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {tpl.is_default ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                          <Star size={12} className="fill-emerald-400" />
                          Default
                        </span>
                      ) : (
                        <span className="text-xs text-gunmetal">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gunmetal text-xs">
                      {new Date(tpl.created_at).toLocaleDateString('es-CO')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        {/* Preview */}
                        <button
                          onClick={() => handlePreview(tpl.id)}
                          disabled={previewingId === tpl.id}
                          className="text-gunmetal hover:text-steel transition-colors disabled:opacity-50"
                          title="Previsualizar PDF"
                        >
                          <Eye size={16} />
                        </button>
                        {/* Editar */}
                        {user?.is_admin && (
                          <button
                            onClick={() => navigate(`/company/templates/${tpl.id}`)}
                            className="text-gunmetal hover:text-steel transition-colors"
                            title="Editar template"
                          >
                            <Pencil size={16} />
                          </button>
                        )}
                        {/* Marcar como default */}
                        {user?.is_admin && !tpl.is_default && (
                          <button
                            onClick={() => handleSetDefault(tpl.id)}
                            className="text-gunmetal hover:text-emerald-400 transition-colors"
                            title="Usar como template por defecto"
                          >
                            <Star size={16} />
                          </button>
                        )}
                        {/* Eliminar */}
                        {user?.is_admin && (
                          <button
                            onClick={() => handleDelete(tpl.id)}
                            className="text-gunmetal hover:text-red-400 transition-colors"
                            title="Eliminar template"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
