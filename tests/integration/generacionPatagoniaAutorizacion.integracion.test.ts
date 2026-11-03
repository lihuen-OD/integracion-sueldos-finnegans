// Compuerta de autorización productiva Patagonia (CP-F7-C2.0). Con PAT-1/PAT-2
// confirmados en sus hipótesis respaldadas (C2.2/C2.3) no quedan bloqueos
// contractuales; este archivo demuestra que la producción sigue cerrada sin
// autorización. La compuerta real no se abre con perfil, parámetros, entorno ni
// propiedades extra de la entrada.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompanyProfileImportado } from '../../src/profile';
import type { ResultadoConciliacion } from '../../src/reconciliation';
import {
  evaluarGeneracionPatagonia,
  generarPatagonia,
  type EntradaGeneracionPatagonia,
  type ResultadoGeneracionPatagonia,
} from '../../src/run/generacionPatagonia';
import {
  conciliacionGoldenPatagonia,
  parametrosGoldenPatagoniaAlfanumerica,
  perfilV3Golden,
} from '../fixtures/synthetic/goldenPatagonia';
import { BANCO_NACION, BANCO_PATAGONIA } from '../fixtures/synthetic/finnegansLike';
import { filaFinnegans, registroBna, registroPatagonia } from '../fixtures/synthetic/escenarios';
import { createRandom } from '../fixtures/synthetic/identities';
import { escenario, gente } from '../unit/reconciliation/helpers';

vi.mock('../../src/banks/patagonia-b2', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/banks/patagonia-b2')>();
  return {
    ...actual,
    serializarPatagonia: vi.fn(actual.serializarPatagonia),
    inspeccionarPatagonia: vi.fn(actual.inspeccionarPatagonia),
  };
});

const patagoniaReal = await vi.importActual<typeof import('../../src/banks/patagonia-b2')>(
  '../../src/banks/patagonia-b2',
);
const { inspeccionarPatagonia, serializarPatagonia } = await import('../../src/banks/patagonia-b2');

beforeEach(() => {
  vi.mocked(serializarPatagonia).mockImplementation(patagoniaReal.serializarPatagonia);
  vi.mocked(inspeccionarPatagonia).mockImplementation(patagoniaReal.inspeccionarPatagonia);
});

function entrada(
  conciliacion: ResultadoConciliacion | null = conciliacionGoldenPatagonia(),
  perfil: CompanyProfileImportado | null = perfilV3Golden(),
): EntradaGeneracionPatagonia {
  return {
    perfil,
    conciliacion,
    parametros: parametrosGoldenPatagoniaAlfanumerica(),
  };
}

function sinBytes(resultado: ResultadoGeneracionPatagonia): boolean {
  return !('bytes' in resultado);
}

function conciliacionConTipoDocumento(
  tipoDocumento: string,
  provinciaDocumento: string | null = null,
): ResultadoConciliacion {
  const random = createRandom(2026);
  const p0 = gente(1, 2026)(0);
  return escenario(
    [filaFinnegans(p0, { Banco: BANCO_PATAGONIA })],
    [
      registroPatagonia(p0, random, {
        PAT_TIPO_DOCUMENTO: tipoDocumento,
        PAT_PROVINCIA_DOCUMENTO: provinciaDocumento,
      }),
    ],
  );
}

describe('compuerta de autorización productiva Patagonia', () => {
  it('con PAT-1/PAT-2 confirmados y sin autorización devuelve HOMOLOGACION_PATAGONIA_PENDIENTE', () => {
    const resultado = generarPatagonia(entrada());
    expect(resultado.estado).toBe('HOMOLOGACION_PATAGONIA_PENDIENTE');
    expect(sinBytes(resultado)).toBe(true);
    expect(vi.mocked(serializarPatagonia)).not.toHaveBeenCalled();
    expect(vi.mocked(inspeccionarPatagonia)).not.toHaveBeenCalled();
  });

  it('sin autorización la evaluación no llega a LISTO_TECNICAMENTE', () => {
    const evaluacion = evaluarGeneracionPatagonia(entrada());
    expect(evaluacion.estado).toBe('HOMOLOGACION_PATAGONIA_PENDIENTE');

    const resultado = generarPatagonia(entrada());
    expect(resultado.estado).toBe('HOMOLOGACION_PATAGONIA_PENDIENTE');
    expect(sinBytes(resultado)).toBe(true);
    expect(vi.mocked(serializarPatagonia)).not.toHaveBeenCalled();
    expect(vi.mocked(inspeccionarPatagonia)).not.toHaveBeenCalled();
  });

  it('propiedades adicionales de la entrada no abren la compuerta', () => {
    const conIntento = {
      ...entrada(),
      autorizacion: { estado: 'HOMOLOGACION_APROBADA', evidencia: 'HOM-PAT-2026-001' },
      produccionHabilitada: true,
      homologacion: 'HOMOLOGACION_APROBADA',
    } as unknown as EntradaGeneracionPatagonia;

    const resultado = generarPatagonia(conIntento);
    expect(resultado.estado).toBe('HOMOLOGACION_PATAGONIA_PENDIENTE');
    expect(sinBytes(resultado)).toBe(true);
  });

  it('la configuración incompleta sigue teniendo precedencia', () => {
    const resultado = generarPatagonia(entrada(conciliacionGoldenPatagonia(), null));
    expect(resultado.estado).toBe('CONFIGURACION_INCOMPLETA');
    expect(sinBytes(resultado)).toBe(true);
  });

  it('la conciliación global pendiente sigue teniendo precedencia', () => {
    const random = createRandom(2026);
    const p0 = gente(2, 2026)(0);
    const p1 = gente(2, 2026)(1);
    const conciliacion = escenario(
      [filaFinnegans(p0, { Banco: BANCO_PATAGONIA }), filaFinnegans(p1, { Banco: '' })],
      [registroPatagonia(p0, random), registroPatagonia(p1, random)],
    );
    const resultado = generarPatagonia(entrada(conciliacion));
    expect(resultado.estado).toBe('CONCILIACION_NO_LISTA');
    expect(sinBytes(resultado)).toBe(true);
  });

  it('el banco sin filas sigue teniendo precedencia', () => {
    const random = createRandom(2026);
    const p0 = gente(1, 2026)(0);
    const conciliacion = escenario(
      [filaFinnegans(p0, { Banco: BANCO_NACION })],
      [registroBna(p0, random)],
    );
    const resultado = generarPatagonia(entrada(conciliacion));
    expect(resultado.estado).toBe('SIN_REGISTROS');
    expect(sinBytes(resultado)).toBe(true);
  });

  it('las incidencias bloqueantes preceden a PAT-8 y a la autorización', () => {
    const p0 = gente(1, 2026)(0);
    const conBloqueo = escenario(
      [filaFinnegans(p0, { Banco: BANCO_PATAGONIA })],
      [
        registroPatagonia(p0, createRandom(2026), {
          PAT_TIPO_CUENTA: '9',
          PAT_TIPO_DOCUMENTO: '004',
          PAT_PROVINCIA_DOCUMENTO: '01',
        }),
      ],
    );

    const resultado = generarPatagonia(entrada(conBloqueo));
    expect(resultado.estado).toBe('CONCILIACION_NO_LISTA');
    if (resultado.estado === 'CONCILIACION_NO_LISTA') {
      expect(resultado.motivo).toBe('BLOQUEANTES_PATAGONIA');
    }
    expect(sinBytes(resultado)).toBe(true);
    expect(vi.mocked(serializarPatagonia)).not.toHaveBeenCalled();
  });

  it('LIQUIDACION_SIN_MAPEO precede a PAT-8 y a la autorización', () => {
    const p0 = gente(1, 2026)(0);
    const conciliacion = escenario(
      [filaFinnegans(p0, { Banco: BANCO_PATAGONIA })],
      [
        registroPatagonia(p0, createRandom(2026), {
          PAT_TIPO_DOCUMENTO: '004',
          PAT_PROVINCIA_DOCUMENTO: '01',
        }),
      ],
      { liquidaciones: null },
    );

    const resultado = generarPatagonia(entrada(conciliacion));
    expect(resultado.estado).toBe('MAPEO_NO_RESUELTO');
    if (resultado.estado === 'MAPEO_NO_RESUELTO') {
      expect(resultado.motivo).toBe('LIQUIDACION_SIN_MAPEO');
    }
    expect(sinBytes(resultado)).toBe(true);
    expect(vi.mocked(serializarPatagonia)).not.toHaveBeenCalled();
  });

  it('PAT-8 se evalúa antes de la compuerta de autorización', () => {
    const resultado = generarPatagonia(entrada(conciliacionConTipoDocumento('004', '01')));
    expect(resultado.estado).toBe('TIPO_DOCUMENTO_NO_CONFIRMADO');
    expect(sinBytes(resultado)).toBe(true);
  });

  it('PAT-8: 001 pasa la validación de flujo y queda en la compuerta de autorización', () => {
    const resultado = generarPatagonia(entrada(conciliacionConTipoDocumento('001')));
    expect(resultado.estado).toBe('HOMOLOGACION_PATAGONIA_PENDIENTE');
    expect(sinBytes(resultado)).toBe(true);
    expect(vi.mocked(serializarPatagonia)).not.toHaveBeenCalled();
  });

  it.each([
    ['004', '01'],
    ['002', null],
    ['003', null],
    ['006', null],
  ] as const)(
    'PAT-8: %s es conocido pero no confirmado para el flujo',
    (tipoDocumento, provinciaDocumento) => {
      const resultado = generarPatagonia(
        entrada(conciliacionConTipoDocumento(tipoDocumento, provinciaDocumento)),
      );
      expect(resultado.estado).toBe('TIPO_DOCUMENTO_NO_CONFIRMADO');
      if (resultado.estado === 'TIPO_DOCUMENTO_NO_CONFIRMADO') {
        expect(resultado.motivo).toBe('TIPO_DOCUMENTO_NO_CONFIRMADO');
        expect(resultado.tiposDocumento).toEqual([tipoDocumento]);
        expect(resultado.refs).toHaveLength(1);
      }
      expect(sinBytes(resultado)).toBe(true);
      expect(vi.mocked(serializarPatagonia)).not.toHaveBeenCalled();
    },
  );

  it('PAT-8: un valor fuera del catálogo no llega a la compuerta PAT-8', () => {
    const resultado = generarPatagonia(entrada(conciliacionConTipoDocumento('005')));
    expect(resultado.estado).toBe('CONCILIACION_NO_LISTA');
    expect(sinBytes(resultado)).toBe(true);
  });
});
