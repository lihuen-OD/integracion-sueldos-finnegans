import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { produccionBnaHabilitada } from '../../src/banks/bna';
import { produccionPatagoniaHabilitada } from '../../src/banks/patagonia-b2';
import type { ResultadoConciliacion } from '../../src/reconciliation';
import { generarBna } from '../../src/run/generacionBna';
import { generarPatagonia } from '../../src/run/generacionPatagonia';
import {
  ETIQUETA_HOMOLOGACION_SINTETICA,
  componerBnaHomologacionSintetica,
  componerPatagoniaHomologacionSintetica,
  type VarianteBnaSintetica,
  type VariantePatagoniaSintetica,
} from '../harness/homologacionSintetica';
import {
  conciliacionGoldenBna,
  parametrosGoldenBna,
  perfilV2Golden,
} from '../fixtures/synthetic/goldenBna';
import {
  conciliacionGoldenPatagonia,
  parametrosGoldenPatagoniaAlfanumerica,
  perfilV3Golden,
} from '../fixtures/synthetic/goldenPatagonia';

type EntradaHarnessBna = Parameters<typeof componerBnaHomologacionSintetica>[0];
type EntradaHarnessPatagonia = Parameters<typeof componerPatagoniaHomologacionSintetica>[0];
type BnaAceptaCorridaReal = ResultadoConciliacion extends EntradaHarnessBna ? true : false;
type PatagoniaAceptaCorridaReal = ResultadoConciliacion extends EntradaHarnessPatagonia
  ? true
  : false;
const BNA_NO_ACEPTA_CORRIDA_REAL: BnaAceptaCorridaReal = false;
const PATAGONIA_NO_ACEPTA_CORRIDA_REAL: PatagoniaAceptaCorridaReal = false;

function valoresDe(
  registros: readonly {
    readonly registroId: string;
    readonly valores: Readonly<Record<string, string>>;
  }[],
  registroId: string,
  campo: string,
): string[] {
  return registros
    .filter((registro) => registro.registroId === registroId)
    .map((registro) => registro.valores[campo] ?? '');
}

describe('CP-F7-D1-A · composición BNA exclusivamente sintética', () => {
  it('compone A1+B1/B2+B3, conserva orden, cobertura, totales y registros de 200 bytes', () => {
    const resultado = componerBnaHomologacionSintetica();

    expect(resultado.estado).toBe('COMPUESTA_EN_MEMORIA');
    if (resultado.estado !== 'COMPUESTA_EN_MEMORIA') return;
    expect(resultado.etiqueta).toBe(ETIQUETA_HOMOLOGACION_SINTETICA);
    expect(resultado.politica).toBe('BNA_A1+BNA_B1_B2+BNA_B3');
    expect(resultado.cantidadPagos).toBe(2);
    expect(resultado.coberturaCompleta).toBe(true);
    expect(resultado.productivo).toBe(false);
    expect(resultado.homologado).toBe(false);
    expect(resultado.totales).toEqual({ cantidad: 2, totalImporte: 84_000_050n });
    expect(resultado.inspeccion.cantidadDeclarada).toBe(2);
    expect(resultado.inspeccion.cantidadCalculada).toBe(2);
    expect(resultado.inspeccion.totalDeclarado).toBe(84_000_050n);
    expect(resultado.inspeccion.totalCalculado).toBe(84_000_050n);
    expect(resultado.inspeccion.registros.map((registro) => registro.registroId)).toEqual([
      'BNA_R1',
      'BNA_R2',
      'BNA_R2',
      'BNA_R3',
    ]);
    expect(resultado.bytes).toHaveLength(4 * 200 + 3);

    const r2 = resultado.inspeccion.registros.filter(
      (registro) => registro.registroId === 'BNA_R2',
    );
    expect(r2.map((registro) => registro.valores['r2_claseDocumento'])).toEqual(['1', '1']);
    expect(r2.map((registro) => registro.valores['r2_tipoDocumento'])).toEqual(['02', '02']);
    expect(r2.map((registro) => registro.valores['r2_identificadorPrestamo'])).toEqual([
      '0000',
      '0003',
    ]);
    expect(
      r2.every((registro) =>
        /^\d{11} {11}$/.test(registro.valores['r2_identificacionBeneficiario'] ?? ''),
      ),
    ).toBe(true);
    expect(r2.map((registro) => registro.valores['r2_datosEmpresa'])).toEqual([
      ' '.repeat(13),
      ' '.repeat(13),
    ]);
    expect(valoresDe(resultado.inspeccion.registros, 'BNA_R1', 'r1_infoCriterioEmpresa')).toEqual([
      'PAGO DE HABERES'.padEnd(20, ' '),
    ]);
  });

  it.each([
    ['HUELLA_VENCIDA', 'SNAPSHOT_INCONSISTENTE'],
    ['SELECCION_INCOMPLETA', 'SELECCION_INCOMPLETA'],
    ['REVISION_INCORRECTA', 'REVISION_INCONSISTENTE'],
    ['REFERENCIA_DUPLICADA', 'COBERTURA_INCOMPLETA'],
    ['COBERTURA_INCOMPLETA', 'COBERTURA_INCOMPLETA'],
    ['PARAMETROS_INVALIDOS', 'SERIALIZACION_RECHAZADA'],
  ] as const)('rechaza %s antes de devolver bytes', (variante, codigo) => {
    const resultado = componerBnaHomologacionSintetica(variante);
    expect(resultado).toMatchObject({ estado: 'RECHAZADA', codigo });
    expect('bytes' in resultado).toBe(false);
  });

  it('rechaza controles ajenos a la lista cerrada y no acepta corridas reales por tipo', () => {
    const invalida = componerBnaHomologacionSintetica('NO_EXISTE' as VarianteBnaSintetica);
    expect(invalida).toMatchObject({ estado: 'RECHAZADA', codigo: 'VARIANTE_NO_ADMITIDA' });
    expect(BNA_NO_ACEPTA_CORRIDA_REAL).toBe(false);
  });
});

describe('CP-F7-D1-A · composición Patagonia 034 exclusivamente sintética', () => {
  it('exige aptitud técnica y compone PAT-2 alfanumérica, PAT-8=001 y decisiones explícitas', () => {
    const resultado = componerPatagoniaHomologacionSintetica();

    expect(resultado.estado).toBe('COMPUESTA_EN_MEMORIA');
    if (resultado.estado !== 'COMPUESTA_EN_MEMORIA') return;
    expect(resultado.etiqueta).toBe(ETIQUETA_HOMOLOGACION_SINTETICA);
    expect(resultado.politica).toBe('PATAGONIA_PRODUCTIVA+SELECCION_EXPLICITA_PROVISIONAL');
    expect(resultado.destinoCuenta).toBe('034');
    expect(resultado.tipoDocumento).toBe('001');
    expect(resultado.dependencia).toBe('ALFANUMERICA');
    expect(resultado.cantidadPagos).toBe(2);
    expect(resultado.coberturaCompleta).toBe(true);
    expect(resultado.productivo).toBe(false);
    expect(resultado.homologado).toBe(false);
    expect(resultado.totales).toEqual({
      totalImporte: 84_000_050n,
      cantidadPagos: 2,
      cantidadLotes: 1,
      importesPorLote: [84_000_050n],
    });
    expect(resultado.inspeccion.cantidadLotesCalculada).toBe(1);
    expect(resultado.inspeccion.cantidadPagosCalculada).toBe(2);
    expect(resultado.inspeccion.totalCalculado).toBe(84_000_050n);
    expect(resultado.inspeccion.registros.map((registro) => registro.registroId)).toEqual([
      'PAT_R0',
      'PAT_R1',
      'PAT_R2',
      'PAT_R2',
    ]);
    expect(resultado.bytes).toHaveLength(4 * 200 + 3);

    const r2 = resultado.inspeccion.registros.filter(
      (registro) => registro.registroId === 'PAT_R2',
    );
    expect(r2.map((registro) => registro.valores['r2_codigoBanco'])).toEqual(['034', '034']);
    expect(r2.map((registro) => registro.valores['r2_tipoDocumento'])).toEqual(['001', '001']);
    expect(r2.map((registro) => registro.valores['r2_codigoDependencia'])).toEqual([
      'DEP001'.padEnd(15, ' '),
      'DEP001'.padEnd(15, ' '),
    ]);
    expect(r2.map((registro) => registro.valores['r2_tipoLiquidacion'])).toEqual(['001', '002']);
  });

  it.each([
    ['HUELLA_VENCIDA', 'SNAPSHOT_INCONSISTENTE'],
    ['SELECCION_INCOMPLETA', 'SELECCION_INCOMPLETA'],
    ['REVISION_INCORRECTA', 'REVISION_INCONSISTENTE'],
    ['COBERTURA_INCOMPLETA', 'COBERTURA_INCOMPLETA'],
    ['PARAMETROS_INVALIDOS', 'SERIALIZACION_RECHAZADA'],
  ] as const)('rechaza %s antes de devolver bytes', (variante, codigo) => {
    const resultado = componerPatagoniaHomologacionSintetica(variante);
    expect(resultado).toMatchObject({ estado: 'RECHAZADA', codigo });
    expect('bytes' in resultado).toBe(false);
  });

  it('rechaza controles ajenos a la lista cerrada y no acepta corridas reales por tipo', () => {
    const invalida = componerPatagoniaHomologacionSintetica(
      'NO_EXISTE' as VariantePatagoniaSintetica,
    );
    expect(invalida).toMatchObject({ estado: 'RECHAZADA', codigo: 'VARIANTE_NO_ADMITIDA' });
    expect(PATAGONIA_NO_ACEPTA_CORRIDA_REAL).toBe(false);
  });
});

describe('CP-F7-D1-A · aislamiento, memoria y bloqueos productivos', () => {
  it('mantiene bancos independientes y ambas compuertas productivas en false', () => {
    const bna = componerBnaHomologacionSintetica();
    const patagonia = componerPatagoniaHomologacionSintetica();
    expect(bna.estado).toBe('COMPUESTA_EN_MEMORIA');
    expect(patagonia.estado).toBe('COMPUESTA_EN_MEMORIA');
    if (bna.estado !== 'COMPUESTA_EN_MEMORIA' || patagonia.estado !== 'COMPUESTA_EN_MEMORIA') {
      return;
    }
    expect(bna.banco).toBe('BNA_GT_200');
    expect(patagonia.banco).toBe('PATAGONIA_B2');
    expect(bna.bytes).not.toEqual(patagonia.bytes);
    expect(produccionBnaHabilitada()).toBe(false);
    expect(produccionPatagoniaHabilitada()).toBe(false);
  });

  it('no altera las fachadas normales ni permite que devuelvan bytes', () => {
    const bna = generarBna({
      perfil: perfilV2Golden(),
      conciliacion: conciliacionGoldenBna(),
      parametros: parametrosGoldenBna(),
    });
    const patagonia = generarPatagonia({
      perfil: perfilV3Golden(),
      conciliacion: conciliacionGoldenPatagonia(),
      parametros: parametrosGoldenPatagoniaAlfanumerica(),
    });
    expect('bytes' in bna).toBe(false);
    expect('bytes' in patagonia).toBe(false);
    expect(produccionBnaHabilitada()).toBe(false);
    expect(produccionPatagoniaHabilitada()).toBe(false);
  });

  it('el harness no importa APIs de escritura ni expone nombre o ruta de archivo', () => {
    const fuente = readFileSync(
      new URL('../harness/homologacionSintetica.ts', import.meta.url),
      'utf8',
    );
    expect(fuente).not.toMatch(/from ['"]node:fs['"]/);
    expect(fuente).not.toMatch(/\b(writeFile|appendFile|createWriteStream|mkdir|openSync)\b/);

    const bna = componerBnaHomologacionSintetica();
    const patagonia = componerPatagoniaHomologacionSintetica();
    for (const resultado of [bna, patagonia]) {
      expect('ruta' in resultado).toBe(false);
      expect('path' in resultado).toBe(false);
      expect('nombreArchivo' in resultado).toBe(false);
      expect('blob' in resultado).toBe(false);
    }
  });
});
