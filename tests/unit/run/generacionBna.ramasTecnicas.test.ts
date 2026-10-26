// Ramas técnicas internas de la fachada. La aptitud contractual y la política se
// sustituyen SOLO con `vi.mock`, exclusivamente bajo `tests/**`: la API pública de
// `src/run/generacionBna.ts` no expone ningún argumento para hacerlo. Así se prueban
// serializer, inspector y clasificación de errores sin abrir un bypass productivo.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AptitudBna, ErrorInspeccionBna, PoliticaBna } from '../../../src/banks/bna';
import type { Centavos } from '../../../src/domain/money';
import type { ResultadoConciliacion } from '../../../src/reconciliation';
import { evaluarGeneracionBna, generarBna } from '../../../src/run/generacionBna';
import {
  conciliacionGoldenBna,
  parametrosGoldenBna,
  perfilV2Golden,
} from '../../fixtures/synthetic/goldenBna';

const estado = vi.hoisted(() => ({
  aptitud: null as AptitudBna | null,
}));

const bnaReal =
  await vi.importActual<typeof import('../../../src/banks/bna')>('../../../src/banks/bna');

vi.mock('../../../src/banks/bna', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/banks/bna')>();
  const habilitada: AptitudBna = {
    bloqueos: [],
    interpretacionesByte: [],
    interpretacionesSinBytes: [],
    generadorHabilitado: true,
    homologacion: 'PENDIENTE_DE_HOMOLOGACION',
  };
  // Política sintética definida acá (sin importar auxiliares) para no reentrar en el
  // módulo mockeado durante la creación del mock.
  const politica: PoliticaBna = {
    documento: () => actual.resuelto({ claseDocumento: '1', tipoDocumento: '02' }),
    cbuCuenta: (pago) => actual.resuelto(pago.cbu),
    sucursalEmpresa: (perfil) => actual.resuelto(String(perfil.cbuEmpresa).slice(3, 7)),
    entidadSucursal: (perfil) => {
      const cbu = String(perfil.cbuEmpresa);
      return actual.resuelto({ entidad: `0${cbu.slice(0, 3)}`, sucursal: cbu.slice(3, 7) });
    },
    identificadorPrestamo: () => actual.resuelto('0000'),
    infoCriterio: (_perfil, parametros) => actual.resuelto(parametros.infoCriterioEmpresa),
    camposBeneficiario: (pago) =>
      actual.resuelto({
        identificacionBeneficiario: String(pago.cuil),
        datosEmpresa: 'USO INTERNO',
      }),
  };
  return {
    ...actual,
    aptitudBna: () => estado.aptitud ?? habilitada,
    POLITICA_BNA_PRODUCTIVA: politica,
    serializarBna: vi.fn(actual.serializarBna),
    inspeccionarBna: vi.fn(actual.inspeccionarBna),
  };
});

const { inspeccionarBna, serializarBna } = await import('../../../src/banks/bna');

beforeEach(() => {
  estado.aptitud = null;
  vi.mocked(serializarBna).mockImplementation(bnaReal.serializarBna);
  vi.mocked(inspeccionarBna).mockImplementation(bnaReal.inspeccionarBna);
});

function entrada(conciliacion: ResultadoConciliacion | null = conciliacionGoldenBna()) {
  return {
    perfil: perfilV2Golden(),
    conciliacion,
    parametros: parametrosGoldenBna(),
  };
}

describe('pipeline técnico de la fachada con aptitud/política mockeadas en tests', () => {
  it('la evaluación puede llegar a LISTO_TECNICAMENTE sin producir bytes', () => {
    const evaluacion = evaluarGeneracionBna(entrada());
    expect(evaluacion.estado).toBe('LISTO_TECNICAMENTE');
    if (evaluacion.estado === 'LISTO_TECNICAMENTE') {
      expect(evaluacion.readiness.estado).toBe('LISTO_PARA_GENERAR');
      expect(evaluacion.pagos).toHaveLength(2);
      expect(evaluacion.aptitud.generadorHabilitado).toBe(true);
    }
  });

  it('GENERADO devuelve bytes inspeccionados y pendiente de homologación', () => {
    const resultado = generarBna(entrada());
    expect(resultado.estado).toBe('GENERADO');
    if (resultado.estado === 'GENERADO') {
      expect(resultado.totales.cantidad).toBe(2);
      expect(resultado.totales.totalImporte).toBe(84_000_050n as Centavos);
      expect(resultado.separador).toBe('\n');
      expect(resultado.trailingSeparator).toBe(false);
      expect(resultado.inspeccion.cantidadCalculada).toBe(2);
      expect(resultado.pendienteHomologacion).toBe(true);
      expect(resultado.bytes).toBeInstanceOf(Uint8Array);
      expect(resultado.bytes.length).toBe(803);
    }
    expect(vi.mocked(serializarBna)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(inspeccionarBna)).toHaveBeenCalledTimes(1);
  });

  it('SERIALIZACION_FALLIDA no devuelve bytes ni inspecciona', () => {
    vi.mocked(serializarBna).mockReturnValueOnce({
      ok: false,
      error: [{ codigo: 'ERROR_SERIALIZACION', errores: [{ codigo: 'SPEC_INVALIDA' }] }],
    });
    const resultado = generarBna(entrada());
    expect(resultado.estado).toBe('SERIALIZACION_FALLIDA');
    if (resultado.estado === 'SERIALIZACION_FALLIDA') {
      expect(resultado.errores).toEqual([
        { codigo: 'ERROR_SERIALIZACION', errores: [{ codigo: 'SPEC_INVALIDA' }] },
      ]);
    }
    expect(vi.mocked(inspeccionarBna)).not.toHaveBeenCalled();
    expect('bytes' in resultado).toBe(false);
  });

  it('un error de política del serializer se clasifica como MAPEO_NO_RESUELTO', () => {
    vi.mocked(serializarBna).mockReturnValueOnce({
      ok: false,
      error: [{ codigo: 'POLITICA_SIN_RESOLUCION', punto: 'BNA-2' }],
    });
    const resultado = generarBna(entrada());
    expect(resultado.estado).toBe('MAPEO_NO_RESUELTO');
    if (resultado.estado === 'MAPEO_NO_RESUELTO') {
      expect(resultado.puntos).toEqual(['BNA-2']);
    }
    expect(vi.mocked(inspeccionarBna)).not.toHaveBeenCalled();
    expect('bytes' in resultado).toBe(false);
  });

  it('un error de política sin punto no inventa puntos', () => {
    vi.mocked(serializarBna).mockReturnValueOnce({
      ok: false,
      error: [{ codigo: 'POLITICA_SIN_RESOLUCION' }],
    });
    const resultado = generarBna(entrada());
    expect(resultado.estado).toBe('MAPEO_NO_RESUELTO');
    if (resultado.estado === 'MAPEO_NO_RESUELTO') {
      expect(resultado.puntos).toEqual([]);
    }
    expect('bytes' in resultado).toBe(false);
  });

  it('INSPECCION_BNA_FALLIDA no devuelve archivo', () => {
    const error: readonly ErrorInspeccionBna[] = [{ codigo: 'ARCHIVO_BNA_INVALIDO' }];
    vi.mocked(inspeccionarBna).mockReturnValueOnce({ ok: false, error });
    const resultado = generarBna(entrada());
    expect(resultado.estado).toBe('INSPECCION_BNA_FALLIDA');
    if (resultado.estado === 'INSPECCION_BNA_FALLIDA') {
      expect(resultado.errores).toEqual(error);
    }
    expect('bytes' in resultado).toBe(false);
  });

  it('un upstream inconsistente sin pagos convertibles da SIN_REGISTROS', () => {
    const real = conciliacionGoldenBna();
    const inconsistente: ResultadoConciliacion = {
      ...real,
      filas: [],
      global: {
        ...real.global,
        bna: { cantidad: 1, importe: 100n as Centavos, filasSinImporte: 0 },
      },
    };
    const resultado = generarBna(entrada(inconsistente));
    expect(resultado.estado).toBe('SIN_REGISTROS');
    if (resultado.estado === 'SIN_REGISTROS') {
      expect(resultado.motivo).toBe('SIN_PAGOS_CONVERTIBLES');
    }
    expect(vi.mocked(serializarBna)).not.toHaveBeenCalled();
    expect('bytes' in resultado).toBe(false);
  });

  it('un bloqueo de separador no inventa referencias de issues BNA', () => {
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
    const resultado = generarBna(entrada());
    expect(resultado.estado).toBe('CONTRATO_BNA_BLOQUEADO');
    if (resultado.estado === 'CONTRATO_BNA_BLOQUEADO') {
      expect(resultado.referencias).toEqual([]);
      expect(resultado.bloqueos).toHaveLength(2);
    }
    expect(vi.mocked(serializarBna)).not.toHaveBeenCalled();
  });
});
