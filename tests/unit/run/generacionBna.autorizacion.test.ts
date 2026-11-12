// La compuerta de autorización BNA debe impedir `GENERADO` aunque el contrato y la
// política estén resueltos. Acá se mockean SOLO la aptitud contractual y la política
// (bajo `tests/**`); la compuerta se deja REAL y cerrada. La API pública no ofrece
// ningún argumento para abrirla.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AptitudBna, PoliticaBna } from '../../../src/banks/bna';
import {
  coberturaPagosBna,
  evaluarGeneracionBna,
  generarBna,
} from '../../../src/run/generacionBna';
import {
  conciliacionGoldenBna,
  parametrosGoldenBna,
  perfilV2Golden,
} from '../../fixtures/synthetic/goldenBna';
import { evidenciaSeleccionBnaSintetica } from '../../fixtures/synthetic/seleccionBna';

vi.mock('../../../src/banks/bna', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/banks/bna')>();
  const habilitada: AptitudBna = {
    bloqueos: [],
    interpretacionesByte: [],
    interpretacionesSinBytes: [],
    generadorHabilitado: true,
    homologacion: 'PENDIENTE_DE_HOMOLOGACION',
  };
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
    // La compuerta `produccionBnaHabilitada` NO se sustituye: es la real y cerrada.
    aptitudBna: () => habilitada,
    POLITICA_BNA_PRODUCTIVA: politica,
    serializarBna: vi.fn(actual.serializarBna),
    inspeccionarBna: vi.fn(actual.inspeccionarBna),
  };
});

const { inspeccionarBna, serializarBna, produccionBnaHabilitada } =
  await import('../../../src/banks/bna');

beforeEach(() => {
  vi.mocked(serializarBna).mockClear();
  vi.mocked(inspeccionarBna).mockClear();
});

function entrada() {
  const evidencia = evidenciaSeleccionBnaSintetica(conciliacionGoldenBna());
  return {
    perfil: perfilV2Golden(),
    conciliacion: evidencia.conciliacion,
    parametros: parametrosGoldenBna(),
    seleccionIdentificadorHaberesBna: evidencia.seleccionIdentificadorHaberesBna,
    huellaFinnegans: evidencia.huellaFinnegans,
  };
}

describe('compuerta de autorización BNA en la fachada', () => {
  it('la compuerta real está cerrada', () => {
    expect(produccionBnaHabilitada()).toBe(false);
  });

  it('contrato, cobertura y política resueltos no alcanzan para generar', () => {
    // El escenario es exactamente el que en tests técnicos llega a `GENERADO` cuando
    // se mockea la compuerta. Con la compuerta real, la producción sigue detenida.
    const evaluacion = evaluarGeneracionBna(entrada());
    expect(evaluacion.estado).toBe('HOMOLOGACION_BNA_PENDIENTE');
    if (evaluacion.estado === 'HOMOLOGACION_BNA_PENDIENTE') {
      expect(evaluacion.motivo).toBe('HOMOLOGACION_BNA_PENDIENTE');
      expect(evaluacion.pendienteHomologacion).toBe(true);
    }
    expect('bytes' in evaluacion).toBe(false);

    const resultado = generarBna(entrada());
    expect(resultado.estado).toBe('HOMOLOGACION_BNA_PENDIENTE');
    expect('bytes' in resultado).toBe(false);
    expect(vi.mocked(serializarBna)).not.toHaveBeenCalled();
    expect(vi.mocked(inspeccionarBna)).not.toHaveBeenCalled();
  });

  it('props extra en la entrada no abren la compuerta', () => {
    const conIntentoDeBypass = {
      ...entrada(),
      produccionHabilitada: true,
      produccionBnaHabilitada: true,
      homologacion: 'APROBADA',
      autorizacion: { estado: 'HOMOLOGACION_APROBADA', evidencia: 'HOM-BNA-2026-001' },
      evidencia: 'HOM-BNA-2026-001',
      flag: true,
      serializar: () => {
        throw new Error('el serializer público no debe usarse');
      },
      inspector: () => {
        throw new Error('el inspector público no debe usarse');
      },
    };
    const resultado = generarBna(conIntentoDeBypass);
    expect(resultado.estado).toBe('HOMOLOGACION_BNA_PENDIENTE');
    expect('bytes' in resultado).toBe(false);
    expect(vi.mocked(serializarBna)).not.toHaveBeenCalled();
    expect(vi.mocked(inspeccionarBna)).not.toHaveBeenCalled();
  });

  it('la cobertura del escenario es completa: el bloqueo es solo de autorización', () => {
    // Demuestra que la fachada no usa la compuerta para tapar una omisión: la cobertura
    // ya está verificada y aun así no se generan bytes.
    const resultado = coberturaPagosBna(conciliacionGoldenBna());
    expect(resultado.completa).toBe(true);
    expect(resultado.asignadas.cantidad).toBe(2);
    expect(resultado.convertidas.cantidad).toBe(2);
    expect(generarBna(entrada()).estado).toBe('HOMOLOGACION_BNA_PENDIENTE');
  });
});
