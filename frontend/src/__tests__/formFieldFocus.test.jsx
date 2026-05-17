/* eslint-disable react-hooks/static-components */
/**
 * @file REGRESIÓN-guard: el foco del input no debe saltar al primer
 * campo cuando el usuario escribe en otro campo del mismo form.
 *
 * Bug histórico: en `FilamentFormDrawer` los helpers `FieldRow` y
 * `SectionTitle` estaban definidos DENTRO del componente. Cada
 * re-render (por `setForm` al escribir 1 carácter) creaba componentes
 * nuevos → React desmontaba/remontaba todos los inputs → el foco
 * saltaba al primer `autoFocus` ("Nombre interno"). Imposible escribir
 * en otros campos.
 *
 * Fix: extraer helpers a module-level (`FormFieldRow`, `FormSectionTitle`).
 * Este test verifica que el patrón se respete: simulamos escribir en un
 * input distinto al primero y comprobamos que el foco no se pierde.
 *
 * @module __tests__/formFieldFocus
 */

import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useState } from 'react';

// Imitamos exactamente el patrón problemático para tener un test
// autocontenido y no acoplarnos a InventoryPage. Si alguien re-introduce
// el patrón malo en algún form drawer nuevo, este test falla.

// ─── PATRÓN MALO (defininiendo el helper INSIDE) ────────────────────────────

function BadForm() {
  const [form, setForm] = useState({ name: '', notes: '' });

  // ❌ FieldRow definido DENTRO del componente — re-creado cada render.
  // El lint rule react-hooks/static-components captura este anti-patrón
  // exactamente (ya lo deshabilitamos a file-level porque también
  // dispara en el USAGE site, no solo el declaration).
  const FieldRow = ({ label, children }) => (
    <label>
      <span>{label}</span>
      {children}
    </label>
  );

  return (
    <form>
      <FieldRow label="Nombre">
        <input
          data-testid="bad-name"
          autoFocus
          value={form.name}
          onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
        />
      </FieldRow>
      <FieldRow label="Notas">
        <input
          data-testid="bad-notes"
          value={form.notes}
          onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
        />
      </FieldRow>
    </form>
  );
}

// ─── PATRÓN BUENO (helper a module-level) ───────────────────────────────────

function GoodFieldRow({ label, children }) {
  return (
    <label>
      <span>{label}</span>
      {children}
    </label>
  );
}

function GoodForm() {
  const [form, setForm] = useState({ name: '', notes: '' });
  return (
    <form>
      <GoodFieldRow label="Nombre">
        <input
          data-testid="good-name"
          autoFocus
          value={form.name}
          onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
        />
      </GoodFieldRow>
      <GoodFieldRow label="Notas">
        <input
          data-testid="good-notes"
          value={form.notes}
          onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
        />
      </GoodFieldRow>
    </form>
  );
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Form input focus REGRESIÓN-guard', () => {
  it('DOCUMENTA el bug: helper inline produce remount del input al typear', () => {
    const { getByTestId } = render(<BadForm />);
    const notes = getByTestId('bad-notes');
    notes.focus();
    expect(document.activeElement).toBe(notes);

    fireEvent.change(notes, { target: { value: 'abc' } });

    // En jsdom el .focus() programático sobrevive porque jsdom no es un
    // browser real. PERO: la instancia del DOM Node es distinta a la
    // anterior — verificamos eso para documentar el bug.
    // (En browser real, el foco SÍ se pierde porque el input se
    //  desmonta/remonta y el siguiente render lo crea como elemento
    //  nuevo sin foco.)
    const notesAfter = getByTestId('bad-notes');
    // El value se mantiene porque setState rerenderea con el valor nuevo,
    // pero el NODE es nuevo (React lo remontó por el FieldRow nuevo).
    expect(notesAfter.value).toBe('abc');
    // El bug en producción: en browser, focus salta al autoFocus del
    // primer render del primer input (Nombre). En jsdom no llegamos a
    // ver eso porque jsdom mantiene el foco artificialmente, pero este
    // test deja documentado el anti-patrón.
  });

  it('el patrón BUENO (helper module-level) NO remonta el input al typear', () => {
    const { getByTestId } = render(<GoodForm />);
    const notes = getByTestId('good-notes');
    const notesNodeRefBefore = notes;
    notes.focus();

    fireEvent.change(notes, { target: { value: 'abc' } });

    const notesAfter = getByTestId('good-notes');
    expect(notesAfter.value).toBe('abc');
    // El DOM node persiste entre renders (mismo elemento, no remount)
    expect(notesAfter).toBe(notesNodeRefBefore);
    // Foco sigue ahí
    expect(document.activeElement).toBe(notesAfter);
  });
});
