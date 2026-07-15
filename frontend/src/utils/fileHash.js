/**
 * @file Hash SHA-256 client-side de un `File` (issue #128).
 *
 * Se calcula ANTES de subir, para poder chequear duplicados
 * (`POST /vault/check-duplicate`) sin mandar el archivo completo al
 * servidor solo para descubrir que ya existe.
 *
 * @module utils/fileHash
 */

const BYTE_TO_HEX = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

/**
 * @param {File} file
 * @returns {Promise<string>} hash SHA-256 en hex (64 caracteres, minúsculas)
 */
export async function hashFile(file) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < bytes.length; i += 1) {
    hex += BYTE_TO_HEX[bytes[i]];
  }
  return hex;
}
