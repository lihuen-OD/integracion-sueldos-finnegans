// Cobertura y conservación de pagos BNA. La aptitud contractual, la política y la
// compuerta se sustituyen SOLO con `vi.mock` bajo `tests/**` para poder aislar las
// invariantes de cobertura; la API pública no expone esos argumentos. La compuerta se
// abre en el mock únicamente para comprobar que, aun con todo resuelto, una omisión,
// duplicación, referencia inesperada o diferencia de importe impide generar.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AptitudBna, PagoBna, PoliticaBna } from '../../../src/banks/bna';
import type { Centavos } from '../../../src/domain/money';
import type {
  FilaConciliada,
  IncidenciaConciliada,
  ResultadoConciliacion,
} from '../../../src/reconciliation';
import {
  coberturaPagosBna,
  evaluarGeneracionBna,
  generarBna,
  pagosBnaDesdeConciliacion,
} from '../../../src/run/generacionBna';
import {
  conciliacionGoldenBna,
  parametrosGoldenBna,
  perfilV2Golden,
} from '../../fixtures/synthetic/goldenBna';
import { escenario } from '../reconciliation/helpers';
import { filaFinnegans, personas, registroBna } from '../../fixtures/synthetic/escenarios';
import { createRandom } from '../../fixtures/synthetic/identities';
import { evidenciaSeleccionBnaSintetica } from '../../fixtures/synthetic/seleccionBna';

const estado = vi.hoisted(() => ({ produccionHabilitada: true }));

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
    aptitudBna: () => habilitada,
    produccionBnaHabilitada: () => estado.produccionHabilitada,
    POLITICA_BNA_PRODUCTIVA: politica,
    serializarBna: vi.fn(actual.serializarBna),
    inspeccionarBna: vi.fn(actual.inspeccionarBna),
  };
});

const { inspeccionarBna, serializarBna } = await import('../../../src/banks/bna');

beforeEach(() => {
  estado.produccionHabilitada = true;
  vi.mocked(serializarBna).mockClear();
  vi.mocked(inspeccionarBna).mockClear();
});

function entrada(
  conciliacion: ResultadoConciliacion = conciliacionGoldenBna(),
  fuenteEvidencia: ResultadoConciliacion = conciliacion,
) {
  const evidencia = evidenciaSeleccionBnaSintetica(fuenteEvidencia);
  const revision = evidencia.conciliacion.revisionSeleccionIdentificadorHaberesBna;
  if (revision === null || revision === undefined) throw new Error('revisión BNA esperada');
  return {
    perfil: perfilV2Golden(),
    conciliacion: {
      ...conciliacion,
      revisionSeleccionIdentificadorHaberesBna: revision,
    },
    parametros: parametrosGoldenBna(),
    seleccionIdentificadorHaberesBna: evidencia.seleccionIdentificadorHaberesBna,
    huellaFinnegans: evidencia.huellaFinnegans,
  };
}

function conFilas(
  conciliacion: ResultadoConciliacion,
  transformar: (fila: FilaConciliada, indice: number) => FilaConciliada,
): ResultadoConciliacion {
  return { ...conciliacion, filas: conciliacion.filas.map(transformar) };
}

describe('cobertura integral de pagos BNA', () => {
  it('un escenario completo verifica cantidades e importes y no produce bytes en la evaluación', () => {
    const conciliacion = conciliacionGoldenBna();
    const reporte = coberturaPagosBna(conciliacion);
    expect(reporte.completa).toBe(true);
    expect(reporte.asignadas.cantidad).toBe(2);
    expect(reporte.convertidas.cantidad).toBe(2);
    expect(reporte.asignadas.importe).toBe(conciliacion.global.bna.importe);
    expect(reporte.convertidas.importe).toBe(conciliacion.global.bna.importe);
    expect(typeof reporte.convertidas.importe).toBe('bigint');
    expect(reporte.noConvertibles).toHaveLength(0);
    expect(reporte.refsUnicas).toBe(true);
    expect(reporte.ordenPreservado).toBe(true);
    expect(reporte.datosCoinciden).toBe(true);

    const evaluacion = evaluarGeneracionBna(entrada(conciliacion));
    expect(evaluacion.estado).toBe('LISTO_TECNICAMENTE');
    if (evaluacion.estado === 'LISTO_TECNICAMENTE') {
      expect(evaluacion.cobertura.completa).toBe(true);
      expect(evaluacion.pagos).toHaveLength(2);
    }
    expect('bytes' in evaluacion).toBe(false);
  });

  it('detecta una omisión y la informa con su motivo, sin generar', () => {
    const conciliacion = conFilas(conciliacionGoldenBna(), (fila, indice) =>
      indice === 0 ? { ...fila, registro: null } : fila,
    );
    const resultado = generarBna(entrada(conciliacion));
    expect(resultado.estado).toBe('COBERTURA_PAGOS_INCOMPLETA');
    if (resultado.estado === 'COBERTURA_PAGOS_INCOMPLETA') {
      expect(resultado.motivo).toBe('FILAS_BNA_NO_CONVERTIBLES');
      expect(resultado.completa).toBe(false);
      expect(resultado.noConvertibles).toHaveLength(1);
      expect(resultado.noConvertibles[0]?.motivo).toBe('SIN_MAESTRO');
      // La asignación sigue coincidiendo con `global.bna`: lo detectado es la fila que
      // no llegó a pago, no un total global alterado.
      expect(resultado.globalCoincide).toBe(true);
    }
    expect(vi.mocked(serializarBna)).not.toHaveBeenCalled();
    expect('bytes' in resultado).toBe(false);
  });

  it('detecta una duplicación de fila asignada', () => {
    const real = conciliacionGoldenBna();
    const [primera] = real.filas;
    if (primera === undefined) {
      throw new Error('escenario sin filas');
    }
    const duplicada: ResultadoConciliacion = { ...real, filas: [...real.filas, primera] };
    const resultado = generarBna(entrada(duplicada, real));
    expect(resultado.estado).toBe('COBERTURA_PAGOS_INCOMPLETA');
    if (resultado.estado === 'COBERTURA_PAGOS_INCOMPLETA') {
      expect(resultado.motivo).toBe('INVARIANTES_PAGOS_BNA');
      expect(resultado.refsUnicas).toBe(false);
      expect(resultado.globalCoincide).toBe(false);
    }
    expect(vi.mocked(serializarBna)).not.toHaveBeenCalled();
    expect('bytes' in resultado).toBe(false);
  });

  it('detecta una diferencia de importe en centavos, sin punto flotante', () => {
    const conciliacion = conFilas(conciliacionGoldenBna(), (fila, indice) => {
      if (indice !== 0 || fila.linea.neto === null) {
        return fila;
      }
      return {
        ...fila,
        linea: { ...fila.linea, neto: (fila.linea.neto + 100n) as Centavos },
      };
    });
    const resultado = generarBna(entrada(conciliacion));
    expect(resultado.estado).toBe('COBERTURA_PAGOS_INCOMPLETA');
    if (resultado.estado === 'COBERTURA_PAGOS_INCOMPLETA') {
      expect(resultado.motivo).toBe('INVARIANTES_PAGOS_BNA');
      expect(resultado.totalesCoinciden).toBe(true);
      expect(resultado.globalCoincide).toBe(false);
      expect(resultado.readinessCoincide).toBe(false);
    }
    expect('bytes' in resultado).toBe(false);
  });

  it('detecta un conjunto esperado inflado respecto de las filas asignadas', () => {
    const real = conciliacionGoldenBna();
    const reporte = coberturaPagosBna(real, {
      cantidad: 3,
      importe: real.global.bna.importe,
      filasSinImporte: 0,
    });
    expect(reporte.completa).toBe(false);
    expect(reporte.readinessCoincide).toBe(false);
    expect(reporte.asignadas.cantidad).toBe(2);
  });

  it('detecta un reordenamiento de los pagos a auditar', () => {
    const real = conciliacionGoldenBna();
    const pagos = pagosBnaDesdeConciliacion(real);
    const [p0, p1] = pagos;
    if (p0 === undefined || p1 === undefined) {
      throw new Error('escenario sin pagos');
    }
    const reordenados = [p1, p0];
    const reporte = coberturaPagosBna(real, real.global.bna, reordenados);
    expect(reporte.ordenPreservado).toBe(false);
    expect(reporte.completa).toBe(false);
  });

  it('detecta una referencia inesperada o duplicada en los pagos a auditar', () => {
    const real = conciliacionGoldenBna();
    const pagos = pagosBnaDesdeConciliacion(real);
    const [p0] = pagos;
    if (p0 === undefined) {
      throw new Error('escenario sin pagos');
    }
    const inesperada: PagoBna = { ...p0, ref: { ...p0.ref, fila: 9999 } };
    const reporte = coberturaPagosBna(real, real.global.bna, [...pagos, inesperada]);
    expect(reporte.refsUnicas).toBe(false);
    expect(reporte.completa).toBe(false);

    const duplicada = coberturaPagosBna(real, real.global.bna, [...pagos, p0]);
    expect(duplicada.refsUnicas).toBe(false);
    expect(duplicada.completa).toBe(false);
  });

  it('detecta dos importes intercambiados aunque la suma total sea idéntica', () => {
    const random = createRandom(2026);
    const gente = personas(2, 2026);
    const importes = ['100000.00', '200000.00'] as const;
    const filas = gente.map((persona, indice) => {
      const neto = importes[indice] ?? '100000.00';
      return filaFinnegans(persona, {
        Remunerativo: neto,
        'No remunerativo': '0',
        Descuento: '0',
        Contribucion: '0',
        Neto: neto,
      });
    });
    const registros = gente.map((persona) => registroBna(persona, random));
    const real = escenario(filas, registros);
    const [p0, p1] = pagosBnaDesdeConciliacion(real);
    if (p0 === undefined || p1 === undefined) {
      throw new Error('escenario sin pagos');
    }
    expect(p0.neto).not.toBe(p1.neto);
    const intercambiados: readonly PagoBna[] = [
      { ...p0, neto: p1.neto },
      { ...p1, neto: p0.neto },
    ];
    const reporte = coberturaPagosBna(real, real.global.bna, intercambiados);
    // Cantidad, suma total, global y readiness siguen cerrando: lo detectado es la
    // deriva de cada importe respecto de SU fila.
    expect(reporte.totalesCoinciden).toBe(true);
    expect(reporte.globalCoincide).toBe(true);
    expect(reporte.readinessCoincide).toBe(true);
    expect(reporte.datosCoinciden).toBe(false);
    expect(reporte.completa).toBe(false);
  });

  it('detecta un CBU sustituido por otro CBU válido', () => {
    const real = conciliacionGoldenBna();
    const [p0, p1] = pagosBnaDesdeConciliacion(real);
    if (p0 === undefined || p1 === undefined) {
      throw new Error('escenario sin pagos');
    }
    const reporte = coberturaPagosBna(real, real.global.bna, [{ ...p0, cbu: p1.cbu }, p1]);
    expect(reporte.totalesCoinciden).toBe(true);
    expect(reporte.datosCoinciden).toBe(false);
    expect(reporte.completa).toBe(false);
  });

  it('detecta un CUIL cambiado conservando la misma referencia', () => {
    const real = conciliacionGoldenBna();
    const [p0, p1] = pagosBnaDesdeConciliacion(real);
    if (p0 === undefined || p1 === undefined) {
      throw new Error('escenario sin pagos');
    }
    const reporte = coberturaPagosBna(real, real.global.bna, [{ ...p0, cuil: p1.cuil }, p1]);
    expect(reporte.totalesCoinciden).toBe(true);
    expect(reporte.datosCoinciden).toBe(false);
    expect(reporte.completa).toBe(false);
  });

  it('una lista con datos cruzados no es apta y la fachada no serializa ante cobertura incompleta', () => {
    const real = conciliacionGoldenBna();
    const [p0, p1] = pagosBnaDesdeConciliacion(real);
    if (p0 === undefined || p1 === undefined) {
      throw new Error('escenario sin pagos');
    }
    const conCbuAjeno = coberturaPagosBna(real, real.global.bna, [{ ...p0, cbu: p1.cbu }, p1]);
    expect(conCbuAjeno.completa).toBe(false);

    // La fachada solo serializa cuando `cobertura.completa` es true. Una omisión real
    // recorre el mismo camino de bloqueo y confirma que no se llama al serializador.
    const conOmision = conFilas(real, (fila, indice) =>
      indice === 0 ? { ...fila, registro: null } : fila,
    );
    const resultado = generarBna(entrada(conOmision));
    expect(resultado.estado).toBe('COBERTURA_PAGOS_INCOMPLETA');
    expect(resultado.estado === 'COBERTURA_PAGOS_INCOMPLETA' && resultado.completa).toBe(false);
    expect(vi.mocked(serializarBna)).not.toHaveBeenCalled();
    expect('bytes' in resultado).toBe(false);
  });

  it('respeta la exclusión NETO_CERO de la conciliación y no la trata como omisión', () => {
    const random = createRandom(2026);
    const gente = personas(3, 2026);
    const filas = gente.map((persona, indice) =>
      filaFinnegans(persona, indice === 2 ? { Neto: '0' } : {}),
    );
    const registros = gente.map((persona) => registroBna(persona, random));
    const conciliacion = escenario(filas, registros);

    const reporte = coberturaPagosBna(conciliacion);
    expect(reporte.completa).toBe(true);
    expect(reporte.asignadas.cantidad).toBe(2);
    expect(reporte.convertidas.cantidad).toBe(2);
    expect(reporte.noConvertibles).toHaveLength(0);
    expect(reporte.excluidas).toHaveLength(1);
    expect(reporte.excluidas[0]?.motivo).toBe('NETO_CERO');

    const evaluacion = evaluarGeneracionBna(entrada(conciliacion));
    expect(evaluacion.estado).toBe('LISTO_TECNICAMENTE');
    expect('bytes' in evaluacion).toBe(false);
  });
});

describe('ramas de clasificación de cobertura', () => {
  it('informa neto ausente y sin maestro sin perder la cantidad asignada', () => {
    const real = conciliacionGoldenBna();
    const filas = real.filas.map((fila, indice) => {
      if (indice === 0) {
        return { ...fila, linea: { ...fila.linea, neto: null } };
      }
      if (indice === 1) {
        return { ...fila, registro: null };
      }
      return fila;
    });
    const reporte = coberturaPagosBna({ ...real, filas });
    expect(reporte.noConvertibles.map((fila) => fila.motivo)).toEqual([
      'NETO_AUSENTE',
      'SIN_MAESTRO',
    ]);
    expect(reporte.asignadas.cantidad).toBe(2);
    expect(reporte.asignadas.filasSinImporte).toBe(1);
    expect(reporte.asignadas.importe).toBeNull();
    expect(reporte.completa).toBe(false);
  });

  it('informa CUIL inválido', () => {
    const real = conciliacionGoldenBna();
    const [primera] = real.filas;
    if (primera === undefined || primera.registro === null) {
      throw new Error('escenario inesperado');
    }
    const filas = [{ ...primera, registro: { ...primera.registro, cuil: null } }];
    const reporte = coberturaPagosBna({ ...real, filas });
    expect(reporte.noConvertibles[0]?.motivo).toBe('CUIL_INVALIDO');
    expect(reporte.completa).toBe(false);
  });

  it('ignora destinos distintos de BNA al construir el conjunto asignado', () => {
    const real = conciliacionGoldenBna();
    const [primera] = real.filas;
    if (primera === undefined) {
      throw new Error('escenario inesperado');
    }
    const filas = [
      {
        ...primera,
        estado: {
          estado: 'INCLUIDA' as const,
          destino: 'PATAGONIA_B2' as const,
          origen: 'BANCO_FINNEGANS' as const,
        },
      },
      ...real.filas.slice(1),
    ];
    const reporte = coberturaPagosBna({ ...real, filas });
    expect(reporte.asignadas.cantidad).toBe(1);
    expect(reporte.convertidas.cantidad).toBe(1);
  });

  it('clasifica incidencias bloqueantes y en revisión, globales y de BNA', () => {
    const casos = [
      ['GLOBAL', 'BLOQUEANTE', 'INCIDENCIA_GLOBAL_BLOQUEANTE'],
      ['BNA_GT_HABERES', 'BLOQUEANTE', 'INCIDENCIA_BNA_BLOQUEANTE'],
      ['GLOBAL', 'REQUIERE_REVISION', 'INCIDENCIA_GLOBAL_EN_REVISION'],
      ['BNA_GT_HABERES', 'REQUIERE_REVISION', 'INCIDENCIA_BNA_EN_REVISION'],
    ] as const;
    for (const [alcance, nivel, motivo] of casos) {
      const real = conciliacionGoldenBna();
      const [primera] = real.filas;
      if (primera === undefined) {
        throw new Error('escenario inesperado');
      }
      const incidencia: IncidenciaConciliada = {
        id: 'INC-SINTETICA',
        codigo: 'SIN_MAESTRO',
        nivel,
        alcance,
        refs: [primera.linea.ref],
        detalle: 'incidencia sintética de test',
      };
      const reporte = coberturaPagosBna({
        ...real,
        filas: [{ ...primera, incidencias: [incidencia] }],
      });
      expect(reporte.noConvertibles[0]?.motivo).toBe(motivo);
      expect(reporte.noConvertibles[0]?.incidenciaId).toBe('INC-SINTETICA');
      expect(reporte.completa).toBe(false);
    }
  });
});
