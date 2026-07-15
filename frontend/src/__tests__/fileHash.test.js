/**
 * @file Tests del hash SHA-256 client-side (issue #128).
 */

import { describe, it, expect } from 'vitest';
import { hashFile } from '../utils/fileHash';

describe('hashFile', () => {
  it('produce un hex de 64 caracteres', async () => {
    const file = new File(['contenido de prueba'], 'test.3mf');
    const hash = await hashFile(file);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('es determinista — mismo contenido, mismo hash', async () => {
    const a = new File(['igual'], 'a.3mf');
    const b = new File(['igual'], 'b.3mf'); // nombre distinto, contenido igual
    expect(await hashFile(a)).toBe(await hashFile(b));
  });

  it('contenido distinto produce hash distinto', async () => {
    const a = new File(['uno'], 'a.3mf');
    const b = new File(['dos'], 'a.3mf');
    expect(await hashFile(a)).not.toBe(await hashFile(b));
  });

  it('coincide con el SHA-256 conocido de un string vacío', async () => {
    const file = new File([''], 'empty.3mf');
    const hash = await hashFile(file);
    expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});
