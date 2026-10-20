// Huella de un archivo de entrada: SHA-256 en hexadecimal, calculada localmente con Web Crypto
// (sin red). Ata las decisiones del operador a los datos exactos que observaron: si el archivo
// cambia, la decisión deja de aplicarse.
export async function calcularHuella(bytes: Uint8Array): Promise<string> {
  // Copia respaldada por un ArrayBuffer propio (requisito de SubtleCrypto).
  const copia = new Uint8Array(bytes.byteLength);
  copia.set(bytes);
  const resumen = await globalThis.crypto.subtle.digest('SHA-256', copia);
  return Array.from(new Uint8Array(resumen), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
