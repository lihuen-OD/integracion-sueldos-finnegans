// Ramas técnicas internas de la fachada Patagonia. La aptitud contractual y la política se
// sustituyen SOLO con `vi.mock`, exclusivamente bajo `tests/**`: la API pública de
// `src/run/generacionPatagonia.ts` no expone ningún argumento para hacerlo. Así se prueban
// serializer, inspector y clasificación de errores sin abrir un bypass productivo.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AptitudPatagonia,
  ErrorInspeccionPatagonia,
  PoliticaPatagonia,
} from '../../../src/banks/patagonia-b2';
import type { Centavos } from '../../../src/domain/money';
import type { ResultadoConciliacion } from '../../../src/reconciliation';
import { evaluarGeneracionPatagonia, generarPatagonia } from '../../../src/run/generacionPatagonia';
import {
  conciliacionGoldenPatagonia,
  parametrosGoldenPatagonia,
  perfilV3Golden,
} from '../../fixtures/synthetic/goldenPatagonia';

const estado = vi.hoisted(() => ({
  aptitud: null as AptitudPatagonia | null,
  politica: null as PoliticaPatagonia | null,
}));

const patagoniaReal = await vi.importActual<typeof import('../../../src/banks/patagonia-b2')>(
  '../../../src/banks/patagonia-b2',
);

vi.mock('../../../src/banks/patagonia-b2', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/banks/patagonia-b2')>();
  const habilitada: AptitudPatagonia = {
    bloqueos: [],
    interpretacionesByte: [],
    interpretacionesSinBytes: [],
    generadorHabilitado: true,
    homologacion: 'PENDIENTE_DE_HOMOLOGACION',
  };
  const politica: PoliticaPatagonia = {
    loteo: (pagos) => actual.resuelto([{ numeroLote: '0001', pagos }]),
    tipoLiquidacion: () => actual.resuelto('001'),
    nombre: () =>
      actual.resuelto({
        original: 'PEREZ ANA',
        generado: 'PEREZ ANA',
        transformado: false,
        truncado: false,
      }),
    provinciaNoAplica: () => actual.resuelto('00'),
    versionLote: () => actual.resuelto(''),
    comprobanteNoInformado: () => actual.resuelto('0000000'),
  };
  const efectiva = (): PoliticaPatagonia => estado.politica ?? politica;
  const politicaEfectiva: PoliticaPatagonia = {
    loteo: (pagos) => efectiva().loteo(pagos),
    tipoLiquidacion: (pago) => efectiva().tipoLiquidacion(pago),
    nombre: (pago) => efectiva().nombre(pago),
    provinciaNoAplica: (pago) => efectiva().provinciaNoAplica(pago),
    versionLote: (perfil, parametros) => efectiva().versionLote(perfil, parametros),
    comprobanteNoInformado: (pago) => efectiva().comprobanteNoInformado(pago),
  };
  return {
    ...actual,
    aptitudPatagonia: () => estado.aptitud ?? habilitada,
    POLITICA_PATAGONIA_PRODUCTIVA: politicaEfectiva,
    serializarPatagonia: vi.fn(actual.serializarPatagonia),
    inspeccionarPatagonia: vi.fn(actual.inspeccionarPatagonia),
  };
});

const { inspeccionarPatagonia, serializarPatagonia } =
  await import('../../../src/banks/patagonia-b2');

beforeEach(() => {
  estado.aptitud = null;
  estado.politica = null;
  vi.mocked(serializarPatagonia).mockImplementation(patagoniaReal.serializarPatagonia);
  vi.mocked(inspeccionarPatagonia).mockImplementation(patagoniaReal.inspeccionarPatagonia);
});

function entrada(conciliacion: ResultadoConciliacion | null = conciliacionGoldenPatagonia()) {
  return {
    perfil: perfilV3Golden(),
    conciliacion,
    parametros: parametrosGoldenPatagonia(),
  };
}

describe('pipeline técnico de la fachada Patagonia con aptitud/política mockeadas', () => {
  it('la evaluación puede llegar a LISTO_TECNICAMENTE sin producir bytes', () => {
    const evaluacion = evaluarGeneracionPatagonia(entrada());
    expect(evaluacion.estado).toBe('LISTO_TECNICAMENTE');
    if (evaluacion.estado === 'LISTO_TECNICAMENTE') {
      expect(evaluacion.readiness.estado).toBe('LISTO_PARA_GENERAR');
      expect(evaluacion.pagos).toHaveLength(2);
      expect(evaluacion.aptitud.generadorHabilitado).toBe(true);
    }
  });

  it('la política productiva sigue sin resolver todos los puntos abiertos', () => {
    estado.politica = patagoniaReal.POLITICA_PATAGONIA_PRODUCTIVA;
    const evaluacion = evaluarGeneracionPatagonia(entrada());
    expect(evaluacion.estado).toBe('MAPEO_NO_RESUELTO');
    if (evaluacion.estado === 'MAPEO_NO_RESUELTO') {
      expect(evaluacion.motivo).toBe('POLITICA_SIN_RESOLUCION');
      expect(evaluacion.puntos).toEqual(
        expect.arrayContaining([
          'P-20',
          'PAT-4',
          'PAT-7/P-09/P-10',
          'PAT-9/P-14',
          'PAT-15',
          'PAT-16',
        ]),
      );
    }
    expect(vi.mocked(serializarPatagonia)).not.toHaveBeenCalled();
    expect('bytes' in evaluacion).toBe(false);
  });

  it('GENERADO devuelve bytes inspeccionados y pendiente de homologación', () => {
    const resultado = generarPatagonia(entrada());
    expect(resultado.estado).toBe('GENERADO');
    if (resultado.estado === 'GENERADO') {
      expect(resultado.totales.cantidadPagos).toBe(2);
      expect(resultado.totales.cantidadLotes).toBe(1);
      expect(resultado.totales.totalImporte).toBe(84_000_050n as Centavos);
      expect(resultado.separador).toBe('\n');
      expect(resultado.trailingSeparator).toBe(false);
      expect(resultado.inspeccion.cantidadPagosCalculada).toBe(2);
      expect(resultado.inspeccion.totalCalculado).toBe(84_000_050n as Centavos);
      expect(resultado.pendienteHomologacion).toBe(true);
      expect(resultado.bytes).toBeInstanceOf(Uint8Array);
      expect(resultado.bytes.length).toBe(803);
    }
    expect(vi.mocked(serializarPatagonia)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(inspeccionarPatagonia)).toHaveBeenCalledTimes(1);
  });

  it('SERIALIZACION_FALLIDA no devuelve bytes ni inspecciona', () => {
    vi.mocked(serializarPatagonia).mockReturnValueOnce({
      ok: false,
      error: [{ codigo: 'ERROR_SERIALIZACION', errores: [{ codigo: 'SPEC_INVALIDA' }] }],
    });
    const resultado = generarPatagonia(entrada());
    expect(resultado.estado).toBe('SERIALIZACION_FALLIDA');
    if (resultado.estado === 'SERIALIZACION_FALLIDA') {
      expect(resultado.errores).toEqual([
        { codigo: 'ERROR_SERIALIZACION', errores: [{ codigo: 'SPEC_INVALIDA' }] },
      ]);
    }
    expect(vi.mocked(inspeccionarPatagonia)).not.toHaveBeenCalled();
    expect('bytes' in resultado).toBe(false);
  });

  it('un error de política del serializer se clasifica como MAPEO_NO_RESUELTO', () => {
    vi.mocked(serializarPatagonia).mockReturnValueOnce({
      ok: false,
      error: [{ codigo: 'POLITICA_SIN_RESOLUCION', punto: 'P-20' }],
    });
    const resultado = generarPatagonia(entrada());
    expect(resultado.estado).toBe('MAPEO_NO_RESUELTO');
    if (resultado.estado === 'MAPEO_NO_RESUELTO') {
      expect(resultado.puntos).toEqual(['P-20']);
    }
    expect(vi.mocked(inspeccionarPatagonia)).not.toHaveBeenCalled();
    expect('bytes' in resultado).toBe(false);
  });

  it('un error de política sin punto no inventa puntos', () => {
    vi.mocked(serializarPatagonia).mockReturnValueOnce({
      ok: false,
      error: [{ codigo: 'POLITICA_SIN_RESOLUCION' }],
    });
    const resultado = generarPatagonia(entrada());
    expect(resultado.estado).toBe('MAPEO_NO_RESUELTO');
    if (resultado.estado === 'MAPEO_NO_RESUELTO') {
      expect(resultado.puntos).toEqual([]);
    }
    expect('bytes' in resultado).toBe(false);
  });

  it('INSPECCION_PATAGONIA_FALLIDA no devuelve archivo', () => {
    const error: readonly ErrorInspeccionPatagonia[] = [{ codigo: 'ARCHIVO_PATAGONIA_INVALIDO' }];
    vi.mocked(inspeccionarPatagonia).mockReturnValueOnce({ ok: false, error });
    const resultado = generarPatagonia(entrada());
    expect(resultado.estado).toBe('INSPECCION_PATAGONIA_FALLIDA');
    if (resultado.estado === 'INSPECCION_PATAGONIA_FALLIDA') {
      expect(resultado.errores).toEqual(error);
    }
    expect('bytes' in resultado).toBe(false);
  });

  it('un upstream inconsistente sin pagos convertibles da SIN_REGISTROS', () => {
    const real = conciliacionGoldenPatagonia();
    const inconsistente: ResultadoConciliacion = {
      ...real,
      filas: [],
      global: {
        ...real.global,
        patagonia: { cantidad: 1, importe: 100n as Centavos, filasSinImporte: 0 },
      },
    };
    const resultado = generarPatagonia(entrada(inconsistente));
    expect(resultado.estado).toBe('SIN_REGISTROS');
    if (resultado.estado === 'SIN_REGISTROS') {
      expect(resultado.motivo).toBe('SIN_PAGOS_CONVERTIBLES');
    }
    expect(vi.mocked(serializarPatagonia)).not.toHaveBeenCalled();
    expect('bytes' in resultado).toBe(false);
  });

  it('un bloqueo de separador o un campo inexistente no inventa referencias', () => {
    estado.aptitud = {
      bloqueos: [
        { tipo: 'lineSeparator' },
        { tipo: 'campo', registroId: 'NO_EXISTE', campoId: 'NO_EXISTE' },
      ],
      interpretacionesByte: [],
      interpretacionesSinBytes: [],
      generadorHabilitado: false,
      homologacion: 'PENDIENTE_DE_HOMOLOGACION',
    };
    const resultado = generarPatagonia(entrada());
    expect(resultado.estado).toBe('CONTRATO_PATAGONIA_BLOQUEADO');
    if (resultado.estado === 'CONTRATO_PATAGONIA_BLOQUEADO') {
      expect(resultado.referencias).toEqual([]);
      expect(resultado.bloqueos).toHaveLength(2);
    }
    expect(vi.mocked(serializarPatagonia)).not.toHaveBeenCalled();
  });
});
