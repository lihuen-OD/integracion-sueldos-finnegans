// CP-F8-D: demostración completa con XLSX sintéticos. Recorre adaptador, importadores y
// conciliación; no llama fachadas de generación ni materializa archivos bancarios.
import { describe, expect, it } from 'vitest';
import { produccionBnaHabilitada } from '../../src/banks/bna';
import {
  produccionPatagoniaHabilitada,
  validarTipoDocumentoFlujoConfirmadoPatagonia,
  validarTipoDocumentoPatagonia,
} from '../../src/banks/patagonia-b2';
import { parseFinnegans } from '../../src/import/finnegans/parseFinnegans';
import { parseMaestro } from '../../src/import/master/parseMaestro';
import { readWorkbook } from '../../src/import/xlsx';
import { conciliar, type PoliticaLiquidaciones } from '../../src/reconciliation';
import {
  demostracionIntegral,
  finnegansXlsx,
  maestroXlsx,
} from '../fixtures/synthetic/escenarios.ts';

const TODO_MAPEADO: PoliticaLiquidaciones = {
  resolver: () => ({ estado: 'MAPEO_APROBADO' }),
};

async function parsear(bytesFinnegans: Uint8Array, bytesMaestro: Uint8Array) {
  const [libroFinnegans, libroMaestro] = await Promise.all([
    readWorkbook(bytesFinnegans),
    readWorkbook(bytesMaestro),
  ]);
  if (!libroFinnegans.ok || !libroMaestro.ok) throw new Error('XLSX sintético ilegible');
  return {
    finnegans: parseFinnegans(libroFinnegans.value),
    maestro: parseMaestro(libroMaestro.value),
  };
}

function conciliarDemo(lecturas: Awaited<ReturnType<typeof parsear>>) {
  return conciliar({
    ...lecturas,
    huellas: { finnegans: 'demo-finnegans', maestro: 'demo-maestro' },
    liquidaciones: TODO_MAPEADO,
  });
}

const resumenEstados = (resultado: ReturnType<typeof conciliarDemo>) =>
  resultado.filas.map((fila) =>
    fila.estado.estado === 'INCLUIDA'
      ? `${fila.estado.estado}:${fila.estado.destino}`
      : fila.estado.estado,
  );

describe('demo integral sintética CP-F8-D', () => {
  const demo = demostracionIntegral();

  it('importa la corrida válida y conserva distribución, legajos y referencias', async () => {
    const lecturas = await parsear(
      finnegansXlsx(demo.valida.filas),
      maestroXlsx(demo.valida.registros, {
        bancosReferencia: demo.valida.bancosReferencia,
      }),
    );
    expect(lecturas.finnegans.hallazgos).toEqual([]);
    expect(lecturas.maestro.hallazgos).toEqual([]);
    expect(lecturas.finnegans.lineas).toHaveLength(156);
    expect(lecturas.maestro.registros).toHaveLength(156);
    expect(lecturas.finnegans.lineas.map((linea) => linea.legajo)).toEqual(
      lecturas.maestro.registros.map((registro) => registro.legajo),
    );
    expect(
      lecturas.maestro.registros.reduce<Record<string, number>>((conteo, registro) => {
        const referencia = registro.bancoReferencia ?? '';
        conteo[referencia] = (conteo[referencia] ?? 0) + 1;
        return conteo;
      }, {}),
    ).toEqual({ 'Banco Nación': 116, 'Banco Patagonia': 39, 'Dato pendiente de identificar': 1 });
  });

  it('BANCO_REFERENCIA no modifica destinos ni diagnósticos', async () => {
    const bytesFinnegans = finnegansXlsx(demo.valida.filas);
    const correcta = conciliarDemo(
      await parsear(
        bytesFinnegans,
        maestroXlsx(demo.valida.registros, {
          bancosReferencia: demo.valida.bancosReferencia,
        }),
      ),
    );
    const deliberadamenteIncorrecta = conciliarDemo(
      await parsear(
        bytesFinnegans,
        maestroXlsx(demo.valida.registros, {
          bancosReferencia: demo.valida.registros.map(() => 'Banco Patagonia'),
        }),
      ),
    );
    expect(resumenEstados(deliberadamenteIncorrecta)).toEqual(resumenEstados(correcta));
    expect(deliberadamenteIncorrecta.incidencias.map((item) => item.codigo)).toEqual(
      correcta.incidencias.map((item) => item.codigo),
    );
    expect(correcta.global.finnegans.cantidad).toBe(156);
  });

  it('mantiene compatible el maestro v1 anterior sin BANCO_REFERENCIA', async () => {
    const lecturas = await parsear(
      finnegansXlsx(demo.valida.filas),
      maestroXlsx(demo.valida.registros),
    );
    expect(lecturas.maestro.hallazgos).toEqual([]);
    expect(
      lecturas.maestro.registros.every((registro) => registro.bancoReferencia === undefined),
    ).toBe(true);
  });

  it('la pareja negativa produce diagnósticos intencionales y no pierde filas', async () => {
    const lecturas = await parsear(
      finnegansXlsx(demo.invalida.filas),
      maestroXlsx(demo.invalida.registros, {
        bancosReferencia: demo.invalida.bancosReferencia,
      }),
    );
    const resultado = conciliarDemo(lecturas);
    expect(resultado.filas).toHaveLength(6);
    expect(resultado.incidencias.map((item) => item.codigo)).toEqual(
      expect.arrayContaining([
        'CBU_INVALIDO',
        'NETO_NO_CUADRA_COMPONENTES',
        'DATO_PATAGONIA_INVALIDO',
        'BANCO_NO_SOPORTADO',
        'BANCO_VACIO',
      ]),
    );
  });

  it('documento Patagonia: el catálogo conoce variantes, pero el flujo confirma solo 001', () => {
    expect(validarTipoDocumentoPatagonia('002')).toEqual({ ok: true, value: '002' });
    expect(validarTipoDocumentoFlujoConfirmadoPatagonia('001')).toEqual({
      ok: true,
      value: '001',
    });
    expect(validarTipoDocumentoFlujoConfirmadoPatagonia('002')).toEqual({
      ok: false,
      error: 'TIPO_DOCUMENTO_NO_CONFIRMADO',
    });
  });

  it('la demo no abre las compuertas productivas', () => {
    expect(produccionBnaHabilitada()).toBe(false);
    expect(produccionPatagoniaHabilitada()).toBe(false);
  });
});
