// Herramienta LOCAL de análisis de variantes de `Descripcion` (PD-18, D-051) para preparar P-10.
// Solo agrupa y muestra: NO crea reglas de producción, NO infiere período ni tipo de liquidación
// y NO mapea a códigos bancarios. Opt-in, fuera de `npm test`, sin escribir archivos.
// Uso: F2_DESCRIPCION_PATHS="ruta1.xlsx:ruta2.xlsx" npm run local:f2
// Se omite (y se cuenta) toda variante que pueda contener un dato personal: el apellido o el
// nombre de su propia fila, 5 o más dígitos seguidos, o algo con forma de CUIL o CBU.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { scanText } from '../../scripts/lib/sensitive.ts';
import type { PayrollLine } from '../../src/domain/liquidacion';
import { parseFinnegans } from '../../src/import/finnegans/parseFinnegans';
import { readWorkbook } from '../../src/import/xlsx';

const rutas = process.env['F2_DESCRIPCION_PATHS'];

function posibleDatoPersonal(valor: string, linea: PayrollLine): boolean {
  const normal = (texto: string) => texto.trim().toLowerCase();
  const nombres = [linea.apellido, linea.nombre].map(normal).filter((texto) => texto.length >= 3);
  return (
    nombres.some((texto) => normal(valor).includes(texto)) ||
    /[0-9]{5,}/.test(valor) ||
    scanText('descripcion.txt', valor).length > 0
  );
}

describe.skipIf(rutas === undefined)('Variantes de Descripcion (solo análisis, sin PII)', () => {
  it('agrupa las variantes exactas y cuenta las omitidas', async () => {
    const variantes = new Map<string, { filas: number; archivos: Set<number> }>();
    let lineas = 0;
    let omitidas = 0;
    const archivos = (rutas ?? '').split(':').filter((ruta) => ruta.length > 0);
    for (const [indice, ruta] of archivos.entries()) {
      const libro = await readWorkbook(new Uint8Array(readFileSync(ruta)));
      if (!libro.ok) {
        throw new Error(`Lectura fallida (archivo ${String(indice + 1)}): ${libro.error.kind}`);
      }
      for (const linea of parseFinnegans(libro.value).lineas) {
        lineas += 1;
        const valor = linea.descripcion.descripcionOriginal;
        if (posibleDatoPersonal(valor, linea)) {
          omitidas += 1;
          continue;
        }
        const entrada = variantes.get(valor) ?? { filas: 0, archivos: new Set<number>() };
        entrada.filas += 1;
        entrada.archivos.add(indice);
        variantes.set(valor, entrada);
      }
    }
    const tabla = [...variantes.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([valor, datos]) => ({
        // JSON muestra los espacios extremos y las mayúsculas tal como vienen.
        variante: JSON.stringify(valor),
        filas: datos.filas,
        archivos: datos.archivos.size,
        palabras: valor.trim().split(/\s+/).length,
        espaciosExtremos: valor !== valor.trim(),
      }));
    process.stdout.write(
      `Variantes de Descripcion (sin regla, sin mapeo):\n${JSON.stringify(
        {
          archivos: archivos.length,
          lineas,
          omitidasPorPosibleDatoPersonal: omitidas,
          variantes: tabla,
        },
        null,
        2,
      )}\n`,
    );
    expect(tabla.reduce((total, fila) => total + fila.filas, 0) + omitidas).toBe(lineas);
  });
});
