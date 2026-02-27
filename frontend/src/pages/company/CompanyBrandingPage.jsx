/**
 * @file Página de marca y colores PDF en la app Compañía.
 *
 * Permite configurar la paleta de colores del PDF de cotización (lista dinámica
 * de entradas {nombre, hex}) y los términos de pago personalizados.
 * Los colores son accesibles en templates Liquid como {{ palette.nombre }}.
 * Ruta: /company/branding
 *
 * @module pages/company/CompanyBrandingPage
 */

import { useState, useEffect } from 'react';
import { getCompany, updateCompany } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { apiErrorMsg } from '../../utils/apiError';
import { Plus, Trash2 } from 'lucide-react';

/** Paleta por defecto si la empresa no tiene ninguna configurada */
const DEFAULT_PALETTE = [
  { name: 'primary',    hex: '#1A1A1A' },
  { name: 'accent',     hex: '#B67E3A' },
  { name: 'highlight',  hex: '#A33221' },
  { name: 'table_text', hex: '#D1A054' },
];

export default function CompanyBrandingPage() {
  const { user } = useAuth();
  const [palette, setPalette]   = useState(DEFAULT_PALETTE.map((c) => ({ ...c })));
  const [pdfTerms, setPdfTerms] = useState('');
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getCompany();
        const d = res.data;
        if (Array.isArray(d.pdf_palette) && d.pdf_palette.length > 0) {
          setPalette(d.pdf_palette.map((c) => ({ name: c.name || '', hex: c.hex || '#000000' })));
        }
        setPdfTerms(d.pdf_terms || '');
      } catch {
        toast.error('Error cargando configuración de empresa');
      }
    };
    load();
  }, []);

  /* ── Manipulación de la paleta ── */
  const addColor = () =>
    setPalette((prev) => [...prev, { name: '', hex: '#AAAAAA' }]);

  const removeColor = (idx) =>
    setPalette((prev) => prev.filter((_, i) => i !== idx));

  const updateColor = (idx, field, value) =>
    setPalette((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c))
    );

  /* ── Guardar ── */
  const handleSave = async (e) => {
    e.preventDefault();

    // Validaciones básicas del cliente
    for (const c of palette) {
      if (!c.name.trim()) {
        toast.error('Todos los colores deben tener un nombre');
        return;
      }
      if (!/^#[0-9A-Fa-f]{6}$/.test(c.hex)) {
        toast.error(`Hex inválido para "${c.name}": ${c.hex}`);
        return;
      }
    }
    const names = palette.map((c) => c.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) {
      toast.error('Los nombres de los colores deben ser únicos');
      return;
    }

    setSaving(true);
    try {
      await updateCompany({
        pdf_palette: palette.map((c) => ({ name: c.name.trim(), hex: c.hex.toUpperCase() })),
        pdf_terms:   pdfTerms,
      });
      toast.success('Configuración de marca guardada');
    } catch (err) {
      toast.error(apiErrorMsg(err, 'Error al guardar'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2 className="tf-page-title">Marca & Colores PDF</h2>

      <form onSubmit={handleSave} className="max-w-2xl space-y-6">

        {/* ── Paleta dinámica de colores ── */}
        <div className="tf-card p-6 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-steel uppercase tracking-wider">
              Paleta de colores PDF
            </h3>
            <p className="text-xs text-gunmetal mt-1">
              Añade tantos colores como necesites. En templates Liquid usa{' '}
              <code className="font-mono text-indigo-400">{'{{ palette.nombre }}'}</code> o
              itera con{' '}
              <code className="font-mono text-indigo-400">{'{% for c in colors %}'}</code>.
            </p>
          </div>

          {/* Encabezado de columnas */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-1">
            <span className="text-xs text-gunmetal font-medium">Nombre (variable Liquid)</span>
            <span className="text-xs text-gunmetal font-medium">Color</span>
            <span className="text-xs text-gunmetal font-medium">Hex</span>
            <span />
          </div>

          {/* Filas de colores */}
          <div className="space-y-2">
            {palette.map((color, idx) => (
              <div
                key={idx}
                className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center"
              >
                {/* Nombre */}
                <input
                  type="text"
                  value={color.name}
                  onChange={(e) => updateColor(idx, 'name', e.target.value)}
                  disabled={!user?.is_admin}
                  placeholder="ej: primary"
                  className="tf-input font-mono text-xs py-1.5"
                />

                {/* Color picker */}
                <input
                  type="color"
                  value={color.hex}
                  onChange={(e) => updateColor(idx, 'hex', e.target.value)}
                  disabled={!user?.is_admin}
                  className="w-10 h-9 rounded-lg border border-[#2a2d31] cursor-pointer bg-transparent p-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={color.name || 'Elegir color'}
                />

                {/* Hex textual */}
                <input
                  type="text"
                  value={color.hex}
                  onChange={(e) => updateColor(idx, 'hex', e.target.value)}
                  disabled={!user?.is_admin}
                  pattern="^#[0-9A-Fa-f]{6}$"
                  maxLength={7}
                  className="tf-input font-mono text-xs py-1.5 w-24"
                  placeholder="#RRGGBB"
                />

                {/* Eliminar */}
                <button
                  type="button"
                  onClick={() => removeColor(idx)}
                  disabled={!user?.is_admin || palette.length <= 1}
                  className="p-1.5 text-gunmetal hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Eliminar color"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>

          {/* Añadir color */}
          {user?.is_admin && (
            <button
              type="button"
              onClick={addColor}
              className="tf-btn-secondary text-xs gap-1.5 py-1.5 px-3"
            >
              <Plus size={14} />
              Añadir color
            </button>
          )}
        </div>

        {/* ── Términos de pago personalizados ── */}
        <div className="tf-card p-6 space-y-3">
          <h3 className="text-sm font-semibold text-steel uppercase tracking-wider">
            Pie de cotización
          </h3>
          <p className="text-xs text-gunmetal">
            Texto de términos de pago y envío. Cada línea se muestra como un ítem separado.
            Si se deja vacío se usan los términos por defecto.
          </p>
          <textarea
            value={pdfTerms}
            onChange={(e) => setPdfTerms(e.target.value)}
            disabled={!user?.is_admin}
            rows={5}
            className="tf-input resize-y font-mono text-xs"
            placeholder={`• Pago del 50% al aprobar la cotización.\n• Saldo antes del envío.\n• Los gastos de envío corren por cuenta del cliente.`}
          />
        </div>

        {user?.is_admin ? (
          <button type="submit" disabled={saving} className="tf-btn-primary w-full py-2.5">
            {saving ? 'Guardando...' : 'Guardar configuración de marca'}
          </button>
        ) : (
          <p className="text-xs text-gunmetal text-center">
            Solo administradores pueden editar la configuración de marca.
          </p>
        )}
      </form>
    </div>
  );
}
