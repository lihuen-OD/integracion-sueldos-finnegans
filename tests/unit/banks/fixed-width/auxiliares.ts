// Auxiliares de test para el motor fixed-width (specs EXCLUSIVAMENTE sintéticas, D-077:
// sin ids, posiciones ni campos de layouts bancarios reales). Los bytes de prueba se
// construyen a mano desde literales ASCII; 1 unidad UTF-16 == 1 byte en todo helper aqui.
export function bytesDe(texto: string): Uint8Array {
  return Uint8Array.from(texto, (c) => c.charCodeAt(0));
}

export function textoDe(bytes: Uint8Array): string {
  let texto = '';
  bytes.forEach((byte) => {
    texto += String.fromCharCode(byte);
  });
  return texto;
}
