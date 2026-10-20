// F2 · Verificación LOCAL con el Excel real de Finnegans. Opt-in, fuera de `npm test`.
// Uso: F2_FINNEGANS_PATH=references/Finnegans_Reporte_Ejemplo.xlsx npm run local:f2
// Como todavía no existe un maestro real, arma EN MEMORIA un maestro prellenado desde la misma
// liquidación (sin datos bancarios) y concilia. Imprime y compara solo agregados: conteos por
// estado y por código/nivel/alcance, y booleanos de los invariantes. Nunca imprime CUIL,
// nombres, legajos, bancos de personas ni importes. No escribe ningún archivo.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseFinnegans } from '../../src/import/finnegans/parseFinnegans';
import { calcularHuella } from '../../src/import/huella';
import { parseMaestro } from '../../src/import/master/parseMaestro';
import {
  generarPlantillaMaestro,
  prellenarDesdeFinnegans,
} from '../../src/import/master/plantillaMaestro';
import { readWorkbook, type Workbook } from '../../src/import/xlsx';
import { conciliar, evaluarReadiness, type Totales } from '../../src/reconciliation';

const path = process.env['F2_FINNEGANS_PATH'];

function contar(valores: readonly string[]): Record<string, number> {
  const conteo: Record<string, number> = {};
  for (const valor of valores) {
    conteo[valor] = (conteo[valor] ?? 0) + 1;
  }
  return conteo;
}

async function leer(bytes: Uint8Array): Promise<Workbook> {
  const resultado = await readWorkbook(bytes);
  if (!resultado.ok) {
    throw new Error(`Lectura fallida: ${resultado.error.kind}`);
  }
  return resultado.value;
}

/** Solo cantidades: los importes reales no se imprimen. */
const cantidades = (totales: Totales) => ({
  cantidad: totales.cantidad,
  filasSinImporte: totales.filasSinImporte,
});

describe.skipIf(path === undefined)(
  'F2 · conciliación con la liquidación real (solo agregados)',
  () => {
    it('parsea, prellena el maestro en memoria y concilia sin perder filas', async () => {
      const bytes = new Uint8Array(readFileSync(path ?? ''));
      const finnegans = parseFinnegans(await leer(bytes));
      const prellenado = prellenarDesdeFinnegans(finnegans);
      const bytesMaestro = await generarPlantillaMaestro({
        fechaGeneracion: '2026-10-20',
        filas: prellenado.filas,
      });
      const maestro = parseMaestro(await leer(bytesMaestro));
      const resultado = conciliar({
        finnegans,
        maestro,
        huellas: {
          finnegans: await calcularHuella(bytes),
          maestro: await calcularHuella(bytesMaestro),
        },
      });
      const { bna, patagonia } = evaluarReadiness(resultado);
      const cuilesFinnegans = new Set(finnegans.lineas.map((linea) => linea.cuil));

      const resumen = {
        lectura: {
          hoja: finnegans.hoja,
          visibilidad: finnegans.visibilidadHoja,
          lineas: finnegans.lineas.length,
          cuilValidos: finnegans.lineas.filter((linea) => linea.cuil !== null).length,
          hallazgosDelParser: contar(finnegans.hallazgos.map((h) => `${h.codigo}:${h.nivel}`)),
        },
        prellenado: prellenado.resumen,
        maestroEnMemoria: {
          registros: maestro.registros.length,
          hallazgos: contar(maestro.hallazgos.map((h) => `${h.codigo}:${h.nivel}`)),
          cuilCanonicoComoFinnegans: maestro.registros.filter((r) => cuilesFinnegans.has(r.cuil))
            .length,
          // Las filas excluidas por neto cero no se cruzan (D-034).
          filasCruzadas: resultado.filas.filter((fila) => fila.registro !== null).length,
          filasCruzadasConLegajoExacto: resultado.filas.filter(
            (fila) => fila.registro !== null && fila.registro.legajo === fila.linea.legajo,
          ).length,
        },
        estados: contar(
          resultado.filas.map((fila) =>
            fila.estado.estado === 'INCLUIDA'
              ? `INCLUIDA:${fila.estado.destino}`
              : fila.estado.estado,
          ),
        ),
        incidencias: contar(
          resultado.incidencias.map((i) => `${i.codigo}:${i.nivel}:${i.alcance}`),
        ),
        global: {
          estado: resultado.global.estado,
          finnegans: cantidades(resultado.global.finnegans),
          bna: cantidades(resultado.global.bna),
          patagonia: cantidades(resultado.global.patagonia),
          excluidas: cantidades(resultado.global.excluidas),
          pendientes: cantidades(resultado.global.pendientes),
          invarianteCantidad: resultado.global.invarianteCantidad,
          invarianteImporte: resultado.global.invarianteImporte,
          motivos: resultado.global.motivos,
        },
        readiness: {
          bna: { estado: bna.estado, motivos: bna.motivos },
          patagonia: { estado: patagonia.estado, motivos: patagonia.motivos },
        },
      };
      process.stdout.write(`F2 local (solo agregados):\n${JSON.stringify(resumen, null, 2)}\n`);

      // docs/03 §A: 156 filas, CUIL válidos y sin repetidos; N-02 estricta los acepta a todos.
      expect(resumen.lectura.lineas).toBe(156);
      expect(resumen.lectura.cuilValidos).toBe(156);
      expect(resumen.lectura.hallazgosDelParser).toEqual({});
      // Ida y vuelta real: CUIL con guiones → canónico y legajos exactos (ceros conservados).
      expect(resumen.prellenado.prellenadas).toBe(156);
      expect(resumen.maestroEnMemoria.hallazgos).toEqual({});
      expect(resumen.maestroEnMemoria.cuilCanonicoComoFinnegans).toBe(156);
      expect(resumen.maestroEnMemoria.filasCruzadasConLegajoExacto).toBe(
        resumen.maestroEnMemoria.filasCruzadas,
      );
      expect(
        resumen.incidencias['LEGAJO_NO_COINCIDE:REQUIERE_REVISION:BNA_GT_HABERES'],
      ).toBeUndefined();
      // Ninguna fila se pierde; los invariantes valen con datos reales.
      expect(resultado.filas).toHaveLength(156);
      expect(resumen.global.invarianteCantidad).toBe(true);
      expect(resumen.global.invarianteImporte).toBe(true);
      expect(resumen.incidencias['NETO_CERO:INFORMACION:GLOBAL']).toBe(1);
      expect(resumen.incidencias['BANCO_VACIO:REQUIERE_REVISION:GLOBAL']).toBe(1);
    });
  },
);
