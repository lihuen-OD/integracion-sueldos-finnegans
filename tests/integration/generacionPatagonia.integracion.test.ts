// Fachada productiva Patagonia B.2 (CP-F6-C). La API pública solo acepta perfil,
// conciliación y parámetros: usa siempre la política y la aptitud productivas. PAT-1
// quedó confirmada para ESPACIOS y PAT-2 para ALFANUMERICA; aun así la compuerta de
// autorización impide generar bytes reales.
import { describe, expect, it } from 'vitest';
import type { ParametrosEnvioPatagonia } from '../../src/banks/patagonia-b2';
import { CATALOGO_BANCOS } from '../../src/domain/destino';
import type { DatosPatagonia } from '../../src/domain/maestro';
import type { CompanyProfile, CompanyProfileImportado } from '../../src/profile';
import type { ResultadoConciliacion } from '../../src/reconciliation';
import {
  coberturaPagosPatagonia,
  evaluarAptitudTecnicaPatagonia,
  evaluarGeneracionPatagonia,
  generarPatagonia,
  pagosPatagoniaDesdeConciliacion,
  perfilPatagoniaDesdePerfil,
  type EntradaGeneracionPatagonia,
} from '../../src/run/generacionPatagonia';
import {
  conciliacionGoldenPatagonia,
  parametrosGoldenPatagonia,
  parametrosGoldenPatagoniaAlfanumerica,
  perfilV3Golden,
} from '../fixtures/synthetic/goldenPatagonia';
import { BANCO_NACION, BANCO_PATAGONIA } from '../fixtures/synthetic/finnegansLike';
import {
  filaFinnegans,
  personas,
  registroBna,
  registroPatagonia,
  type RegistroMaestro,
} from '../fixtures/synthetic/escenarios';
import { createRandom } from '../fixtures/synthetic/identities';
import { perfilSintetico, politicaSintetica } from '../unit/banks/bna/auxiliares';
import { escenario, gente } from '../unit/reconciliation/helpers';

const PARAMETROS = parametrosGoldenPatagoniaAlfanumerica();

interface OpcionesEntrada {
  readonly perfil?: CompanyProfileImportado | null;
  readonly parametros?: ParametrosEnvioPatagonia | null;
}

/**
 * Entrada construida SOLO con las tres propiedades públicas. La fachada no acepta
 * política, aptitud, serializer ni inspector: las pruebas de esas capas se hacen
 * componiendo la API pública de Patagonia, nunca inyectando dependencias en `run`.
 */
function entradaPatagonia(
  conciliacion: ResultadoConciliacion | null,
  opciones: OpcionesEntrada = {},
): EntradaGeneracionPatagonia {
  return {
    perfil: opciones.perfil === undefined ? perfilV3Golden() : opciones.perfil,
    conciliacion,
    parametros: opciones.parametros === undefined ? PARAMETROS : opciones.parametros,
  };
}

function escenarioPatagoniaValido(cantidad = 1, semilla = 2026): ResultadoConciliacion {
  const random = createRandom(semilla);
  const lista = personas(cantidad, semilla);
  const filas = lista.map((persona) => filaFinnegans(persona, { Banco: BANCO_PATAGONIA }));
  const registros = lista.map((persona) => registroPatagonia(persona, random));
  return escenario(filas, registros);
}

/**
 * Simula un upstream inconsistente: modifica los datos Patagonia de una fila sin agregar
 * incidencias. Así se prueba el control de cobertura como defensa independiente de readiness.
 */
function conDatosPatagonia(
  conciliacion: ResultadoConciliacion,
  indice: number,
  cambios: Partial<DatosPatagonia>,
): ResultadoConciliacion {
  const fila = conciliacion.filas[indice];
  if (fila === undefined || fila.registro === null) {
    throw new Error('la fila de prueba no tiene registro del maestro');
  }
  const filas = [...conciliacion.filas];
  filas[indice] = {
    ...fila,
    registro: {
      ...fila.registro,
      patagonia: { ...fila.registro.patagonia, ...cambios },
    },
  };
  return { ...conciliacion, filas };
}

function sinBytes(resultado: object): boolean {
  return !('bytes' in resultado);
}

/** Copia sintética con apellido y nombre del primer pago reemplazados. */
function conNombrePatagonia(
  conciliacion: ResultadoConciliacion,
  apellido: string,
  nombre: string,
): ResultadoConciliacion {
  return {
    ...conciliacion,
    filas: conciliacion.filas.map((fila, indice) =>
      indice === 0 ? { ...fila, linea: { ...fila.linea, apellido, nombre } } : fila,
    ),
  };
}

function perfilV1(): CompanyProfile {
  const base = perfilSintetico('4455');
  return {
    schemaVersion: '1',
    cuitEmpresa: base.cuitEmpresa,
    nombreEmpresa: 'EMPRESA SINTETICA DE PRUEBA',
    catalogoBancos: CATALOGO_BANCOS,
    mapeosLiquidacion: [],
  };
}

function perfilV2(): CompanyProfileImportado {
  const v3 = perfilV3Golden();
  return {
    schemaVersion: '2',
    cuitEmpresa: v3.cuitEmpresa,
    nombreEmpresa: v3.nombreEmpresa,
    catalogoBancos: v3.catalogoBancos,
    bna: v3.bna,
    mapeosLiquidacion: [],
  };
}

// Contrato de tipos: la entrada pública no puede volver a exponer bypasses de test.
type ClavesProhibidasGeneracionPatagonia =
  | 'aptitud'
  | 'politica'
  | 'serializar'
  | 'inspeccionar'
  | 'spec'
  | 'mapper'
  | 'autorizacion'
  | 'produccionHabilitada'
  | 'homologacion';
type BypassesEnEntrada = Extract<
  keyof EntradaGeneracionPatagonia,
  ClavesProhibidasGeneracionPatagonia
>;
const ENTRADA_SIN_BYPASSES: BypassesEnEntrada extends never ? true : false = true;

describe('perfil y entrada pública de la fachada Patagonia', () => {
  it('la API pública solo acepta perfil, conciliación y parámetros', () => {
    const entrada: EntradaGeneracionPatagonia = {
      perfil: perfilV3Golden(),
      conciliacion: escenarioPatagoniaValido(),
      parametros: PARAMETROS,
    };
    expect(Object.keys(entrada).sort()).toEqual(['conciliacion', 'parametros', 'perfil']);
    expect(ENTRADA_SIN_BYPASSES).toBe(true);
  });

  it('v1 y v2 no contienen la configuración Patagonia', () => {
    const v1 = generarPatagonia(
      entradaPatagonia(escenarioPatagoniaValido(), { perfil: perfilV1() }),
    );
    expect(v1.estado).toBe('CONFIGURACION_INCOMPLETA');
    if (v1.estado === 'CONFIGURACION_INCOMPLETA') {
      expect(v1.motivos).toContain('PERFIL_V1');
      expect(v1.perfilVersion).toBe('1');
    }

    const v2 = generarPatagonia(
      entradaPatagonia(escenarioPatagoniaValido(), { perfil: perfilV2() }),
    );
    expect(v2.estado).toBe('CONFIGURACION_INCOMPLETA');
    if (v2.estado === 'CONFIGURACION_INCOMPLETA') {
      expect(v2.motivos).toContain('PERFIL_V2');
      expect(v2.perfilVersion).toBe('2');
    }
    expect(sinBytes(v1)).toBe(true);
    expect(sinBytes(v2)).toBe(true);
  });

  it('perfil y parámetros ausentes no se completan por default', () => {
    const conciliacion = escenarioPatagoniaValido();
    const sinPerfil = generarPatagonia(entradaPatagonia(conciliacion, { perfil: null }));
    expect(sinPerfil.estado).toBe('CONFIGURACION_INCOMPLETA');
    if (sinPerfil.estado === 'CONFIGURACION_INCOMPLETA') {
      expect(sinPerfil.motivos).toContain('PERFIL_AUSENTE');
    }

    const sinParametros = generarPatagonia(entradaPatagonia(conciliacion, { parametros: null }));
    expect(sinParametros.estado).toBe('CONFIGURACION_INCOMPLETA');
    if (sinParametros.estado === 'CONFIGURACION_INCOMPLETA') {
      expect(sinParametros.motivos).toContain('PARAMETROS_AUSENTES');
      expect(sinParametros.perfilVersion).toBe('3');
    }
    expect(sinBytes(sinPerfil)).toBe(true);
    expect(sinBytes(sinParametros)).toBe(true);
  });

  it('solo copia numeroEmpresa del perfil v3', () => {
    const perfil = perfilV3Golden();
    const patagonia = perfilPatagoniaDesdePerfil(perfil);
    expect(patagonia).toEqual({ numeroEmpresa: perfil.patagonia.numeroEmpresa });
    expect(Object.keys(patagonia)).toEqual(['numeroEmpresa']);
    expect('bna' in patagonia).toBe(false);
    expect('cbuEmpresa' in patagonia).toBe(false);
  });
});

describe('conciliación y compuertas Patagonia', () => {
  it('sin conciliación no genera', () => {
    const resultado = generarPatagonia(entradaPatagonia(null));
    expect(resultado.estado).toBe('CONCILIACION_NO_LISTA');
    if (resultado.estado === 'CONCILIACION_NO_LISTA') {
      expect(resultado.motivo).toBe('SIN_CONCILIACION');
    }
    expect(sinBytes(resultado)).toBe(true);
  });

  it('conciliación global pendiente no genera', () => {
    const random = createRandom(2026);
    const p0 = gente(2, 2026)(0);
    const p1 = gente(2, 2026)(1);
    const conciliacion = escenario(
      [filaFinnegans(p0, { Banco: BANCO_PATAGONIA }), filaFinnegans(p1, { Banco: '' })],
      [registroPatagonia(p0, random), registroPatagonia(p1, random)],
    );
    const resultado = generarPatagonia(entradaPatagonia(conciliacion));
    expect(resultado.estado).toBe('CONCILIACION_NO_LISTA');
    if (resultado.estado === 'CONCILIACION_NO_LISTA') {
      expect(resultado.motivo).toBe('GLOBAL_PENDIENTE');
      expect(resultado.motivosGlobales).toContain('FILAS_PENDIENTES');
    }
    expect(sinBytes(resultado)).toBe(true);
  });

  it('conciliación global bloqueada no genera', () => {
    const random = createRandom(2026);
    const p0 = gente(1, 2026)(0);
    const conciliacion = escenario(
      [filaFinnegans(p0, { Banco: BANCO_PATAGONIA, Neto: null })],
      [registroPatagonia(p0, random)],
    );
    expect(conciliacion.global.estado).toBe('BLOQUEADA');
    const resultado = generarPatagonia(entradaPatagonia(conciliacion));
    expect(resultado.estado).toBe('CONCILIACION_NO_LISTA');
    if (resultado.estado === 'CONCILIACION_NO_LISTA') {
      expect(resultado.motivo).toBe('GLOBAL_BLOQUEADA');
      expect(resultado.motivosGlobales).toContain('IMPORTE_NO_CALCULABLE');
    }
    expect(sinBytes(resultado)).toBe(true);
  });

  it('banco sin filas Patagonia con global cerrada da SIN_REGISTROS', () => {
    const random = createRandom(2026);
    const p0 = gente(1, 2026)(0);
    const conciliacion = escenario(
      [filaFinnegans(p0, { Banco: BANCO_NACION })],
      [registroBna(p0, random)],
    );
    expect(conciliacion.global.estado).toBe('CERRADA');
    const resultado = generarPatagonia(entradaPatagonia(conciliacion));
    expect(resultado.estado).toBe('SIN_REGISTROS');
    if (resultado.estado === 'SIN_REGISTROS') {
      expect(resultado.motivo).toBe('BANCO_SIN_FILAS');
      expect(resultado.asignadas.cantidad).toBe(0);
    }
    expect(sinBytes(resultado)).toBe(true);
  });

  it('P-09/P-10 informados como LIQUIDACION_SIN_MAPEO se respetan', () => {
    const random = createRandom(2026);
    const p0 = gente(1, 2026)(0);
    const conciliacion = escenario(
      [filaFinnegans(p0, { Banco: BANCO_PATAGONIA })],
      [registroPatagonia(p0, random)],
      { liquidaciones: null },
    );
    const resultado = generarPatagonia(entradaPatagonia(conciliacion));
    expect(resultado.estado).toBe('MAPEO_NO_RESUELTO');
    if (resultado.estado === 'MAPEO_NO_RESUELTO') {
      expect(resultado.motivo).toBe('LIQUIDACION_SIN_MAPEO');
      expect(resultado.requisitos).toEqual([]);
      expect(resultado.incidencias.map((incidencia) => incidencia.codigo)).toEqual([
        'LIQUIDACION_SIN_MAPEO',
      ]);
    }
    expect(sinBytes(resultado)).toBe(true);
  });

  it('bloqueantes Patagonia distintos de P-09/P-10 no generan', () => {
    const random = createRandom(2026);
    const p0 = gente(1, 2026)(0);
    const conciliacion = escenario(
      [filaFinnegans(p0, { Banco: BANCO_PATAGONIA })],
      [registroPatagonia(p0, random, { PAT_TIPO_CUENTA: '9' })],
    );
    const resultado = generarPatagonia(entradaPatagonia(conciliacion));
    expect(resultado.estado).toBe('CONCILIACION_NO_LISTA');
    if (resultado.estado === 'CONCILIACION_NO_LISTA') {
      expect(resultado.motivo).toBe('BLOQUEANTES_PATAGONIA');
      expect(resultado.incidencias.map((incidencia) => incidencia.codigo)).toContain(
        'DATO_PATAGONIA_INVALIDO',
      );
    }
    expect(sinBytes(resultado)).toBe(true);
  });

  it('revisiones Patagonia sin resolver no generan', () => {
    const random = createRandom(2026);
    const p0 = gente(1, 2026)(0);
    const conciliacion = escenario(
      [filaFinnegans(p0, { Banco: BANCO_PATAGONIA })],
      [registroPatagonia(p0, random, { LEGAJO: '999' })],
    );
    const resultado = generarPatagonia(entradaPatagonia(conciliacion));
    expect(resultado.estado).toBe('CONCILIACION_NO_LISTA');
    if (resultado.estado === 'CONCILIACION_NO_LISTA') {
      expect(resultado.motivo).toBe('REVISIONES_PATAGONIA');
      expect(resultado.incidencias.map((incidencia) => incidencia.codigo)).toContain(
        'LEGAJO_NO_COINCIDE',
      );
    }
    expect(sinBytes(resultado)).toBe(true);
  });

  it('con PAT-1/PAT-2 confirmados la compuerta de autorización sigue cerrada', () => {
    const conciliacion = escenarioPatagoniaValido();
    const resultado = generarPatagonia(entradaPatagonia(conciliacion));
    expect(resultado.estado).toBe('HOMOLOGACION_PATAGONIA_PENDIENTE');
    if (resultado.estado === 'HOMOLOGACION_PATAGONIA_PENDIENTE') {
      expect(resultado.motivo).toBe('HOMOLOGACION_PATAGONIA_PENDIENTE');
      expect(resultado.pendienteHomologacion).toBe(true);
    }
    expect(sinBytes(resultado)).toBe(true);
    expect('bytes' in resultado).toBe(false);

    const evaluacion = evaluarGeneracionPatagonia(entradaPatagonia(conciliacion));
    expect(evaluacion.estado).toBe('HOMOLOGACION_PATAGONIA_PENDIENTE');
  });

  it('PAT-2 NUMERICA se rechaza explícitamente y no genera bytes', () => {
    const historica = parametrosGoldenPatagonia();
    const resultado = generarPatagonia(
      entradaPatagonia(escenarioPatagoniaValido(), { parametros: historica }),
    );
    expect(resultado.estado).toBe('HIPOTESIS_PAT2_NO_CONFIRMADA');
    if (resultado.estado === 'HIPOTESIS_PAT2_NO_CONFIRMADA') {
      expect(resultado.motivo).toBe('HIPOTESIS_PAT2_NO_CONFIRMADA');
      expect(resultado.hipotesis).toBe('NUMERICA');
      expect(resultado.hipotesisConfirmada).toBe('ALFANUMERICA');
    }
    expect(sinBytes(resultado)).toBe(true);

    const evaluacion = evaluarGeneracionPatagonia(
      entradaPatagonia(escenarioPatagoniaValido(), { parametros: historica }),
    );
    expect(evaluacion.estado).toBe('HIPOTESIS_PAT2_NO_CONFIRMADA');
  });

  it('no admite bypasses en runtime: propiedades extra no cambian la compuerta contractual', () => {
    const conIntentoDeBypass = {
      perfil: perfilV3Golden(),
      conciliacion: escenarioPatagoniaValido(),
      parametros: PARAMETROS,
      aptitud: {
        bloqueos: [],
        interpretacionesByte: [],
        interpretacionesSinBytes: [],
        generadorHabilitado: true,
        homologacion: 'PENDIENTE_DE_HOMOLOGACION',
      },
      politica: politicaSintetica(),
      serializar: () => {
        throw new Error('no debe usarse');
      },
      inspeccionar: () => {
        throw new Error('no debe usarse');
      },
      autorizacion: { estado: 'HOMOLOGACION_APROBADA', evidencia: 'HOM-PAT-2026-001' },
      produccionHabilitada: true,
      homologacion: 'HOMOLOGACION_APROBADA',
    } as unknown as EntradaGeneracionPatagonia;
    const resultado = generarPatagonia(conIntentoDeBypass);
    expect(resultado.estado).toBe('HOMOLOGACION_PATAGONIA_PENDIENTE');
    expect(sinBytes(resultado)).toBe(true);
  });
});

describe('conversión de pagos desde la conciliación', () => {
  it('preserva orden, SourceRef y solo usa datos Patagonia', () => {
    const conciliacion = conciliacionGoldenPatagonia();
    const pagos = pagosPatagoniaDesdeConciliacion(conciliacion);
    expect(pagos).toHaveLength(2);
    expect(pagos.map((pago) => pago.ref.fila)).toEqual([2, 3]);
    expect(pagos[0]?.provinciaDocumento).toBeNull();
    expect(pagos[0]?.tipoDocumento).toBe('001');
    expect(pagos[0]?.codigoBanco).toBe('034');
    expect(pagos[0]?.legajo).toBe('050');
  });

  it('la dependencia sale del maestro, sin default', () => {
    const random = createRandom(2026);
    const p0 = gente(1, 2026)(0);
    const conciliacion = escenario(
      [filaFinnegans(p0, { Banco: BANCO_PATAGONIA })],
      [registroPatagonia(p0, random, { PAT_CODIGO_DEPENDENCIA: 'DEP01' })],
    );
    const pagos = pagosPatagoniaDesdeConciliacion(conciliacion);
    expect(pagos).toHaveLength(1);
    expect(pagos[0]?.codigoDependencia).toBe('DEP01');
  });

  it('descarta filas sin maestro, sin neto positivo o con otra entidad', () => {
    const p0 = gente(1, 2026)(0);
    const sinMaestro = escenario([filaFinnegans(p0, { Banco: BANCO_PATAGONIA })], []);
    expect(pagosPatagoniaDesdeConciliacion(sinMaestro)).toHaveLength(0);

    const netoCero = escenario(
      [filaFinnegans(p0, { Banco: BANCO_PATAGONIA, Neto: '0' })],
      [registroPatagonia(p0, createRandom(2026))],
    );
    expect(pagosPatagoniaDesdeConciliacion(netoCero)).toHaveLength(0);

    const netoNegativo = escenario(
      [filaFinnegans(p0, { Banco: BANCO_PATAGONIA, Neto: '-1' })],
      [registroPatagonia(p0, createRandom(2026))],
    );
    expect(pagosPatagoniaDesdeConciliacion(netoNegativo)).toHaveLength(0);

    const bna = escenario(
      [filaFinnegans(p0, { Banco: BANCO_NACION })],
      [registroBna(p0, createRandom(2026))],
    );
    expect(pagosPatagoniaDesdeConciliacion(bna)).toHaveLength(0);
  });

  it('descarta una fila con bloqueo Patagonia o global no resuelto', () => {
    const p0 = gente(1, 2026)(0);
    const conBloqueo = escenario(
      [filaFinnegans(p0, { Banco: BANCO_PATAGONIA })],
      [registroPatagonia(p0, createRandom(2026), { PAT_TIPO_CUENTA: '9' })],
    );
    expect(pagosPatagoniaDesdeConciliacion(conBloqueo)).toHaveLength(0);

    const base = conciliacionGoldenPatagonia();
    const primera = base.filas[0];
    if (primera === undefined) {
      return;
    }
    const incidencia = {
      id: 'INC-SINTETICA-GLOBAL',
      codigo: 'LIQUIDACION_SIN_MAPEO' as const,
      nivel: 'REQUIERE_REVISION' as const,
      alcance: 'GLOBAL' as const,
      refs: [],
      detalle: 'incidencia sintetica de test',
    };
    const conRevision: ResultadoConciliacion = {
      ...base,
      filas: [
        { ...primera, incidencias: [...primera.incidencias, incidencia] },
        ...base.filas.slice(1),
      ],
    };
    expect(pagosPatagoniaDesdeConciliacion(conRevision)).toHaveLength(1);
    expect(pagosPatagoniaDesdeConciliacion(conRevision)[0]?.ref.fila).toBe(3);
  });

  it('informa provincia solo cuando el documento es 004 y no la inventa en otros casos', () => {
    const p0 = gente(1, 2026)(0);
    const conProvincia = escenario(
      [filaFinnegans(p0, { Banco: BANCO_PATAGONIA })],
      [
        registroPatagonia(p0, createRandom(2026), {
          PAT_TIPO_DOCUMENTO: '004',
          PAT_PROVINCIA_DOCUMENTO: '01',
        }),
      ],
    );
    const pagos = pagosPatagoniaDesdeConciliacion(conProvincia);
    expect(pagos).toHaveLength(1);
    expect(pagos[0]?.provinciaDocumento).toBe('01');

    const conProvinciaIndebida = escenario(
      [filaFinnegans(p0, { Banco: BANCO_PATAGONIA })],
      [
        registroPatagonia(p0, createRandom(2026), {
          PAT_TIPO_DOCUMENTO: '001',
          PAT_PROVINCIA_DOCUMENTO: '01',
        }),
      ],
    );
    expect(pagosPatagoniaDesdeConciliacion(conProvinciaIndebida)).toHaveLength(0);
  });

  it('descarta si falta un campo Patagonia obligatorio del maestro', () => {
    const p0 = gente(1, 2026)(0);
    const cambios: Partial<RegistroMaestro> = { PAT_CODIGO_SUCURSAL: null };
    const conciliacion = escenario(
      [filaFinnegans(p0, { Banco: BANCO_PATAGONIA })],
      [registroPatagonia(p0, createRandom(2026), cambios)],
    );
    expect(pagosPatagoniaDesdeConciliacion(conciliacion)).toHaveLength(0);
  });
});

describe('cobertura de pagos Patagonia (CP-F7-C2.4-A0)', () => {
  it('cuenta, refs e importes exactos coinciden con global.patagonia', () => {
    const cobertura = coberturaPagosPatagonia(conciliacionGoldenPatagonia());
    expect(cobertura.asignadas).toEqual({
      cantidad: 2,
      importe: 84_000_050n,
      filasSinImporte: 0,
    });
    expect(cobertura.convertidas).toEqual({
      cantidad: 2,
      importe: 84_000_050n,
      filasSinImporte: 0,
    });
    expect(cobertura.noConvertibles).toEqual([]);
    expect(cobertura.refsUnicas).toBe(true);
    expect(cobertura.totalesCoinciden).toBe(true);
    expect(cobertura.globalCoincide).toBe(true);
    expect(cobertura.readinessCoincide).toBe(true);
    expect(cobertura.completa).toBe(true);
  });

  it('respeta exclusiones legítimas: neto cero y otro banco no son omisiones', () => {
    const random = createRandom(2026);
    const p0 = gente(3, 2026)(0);
    const p1 = gente(3, 2026)(1);
    const p2 = gente(3, 2026)(2);
    const conciliacion = escenario(
      [
        filaFinnegans(p0, { Banco: BANCO_PATAGONIA }),
        filaFinnegans(p1, {
          Banco: BANCO_PATAGONIA,
          Remunerativo: '0',
          'No remunerativo': '0',
          Descuento: '0',
          Neto: '0',
        }),
        filaFinnegans(p2, { Banco: BANCO_NACION }),
      ],
      [registroPatagonia(p0, random), registroPatagonia(p1, random), registroBna(p2, random)],
    );

    expect(conciliacion.global.estado).toBe('CERRADA');
    const cobertura = coberturaPagosPatagonia(conciliacion);
    expect(cobertura.asignadas.cantidad).toBe(1);
    expect(cobertura.convertidas.cantidad).toBe(1);
    expect(cobertura.noConvertibles).toEqual([]);
    expect(cobertura.excluidas).toHaveLength(1);
    expect(cobertura.excluidas[0]).toMatchObject({ motivo: 'NETO_CERO' });
    expect(cobertura.completa).toBe(true);

    const resultado = generarPatagonia(entradaPatagonia(conciliacion));
    expect(resultado.estado).toBe('HOMOLOGACION_PATAGONIA_PENDIENTE');
    expect(sinBytes(resultado)).toBe(true);
  });

  it('un neto negativo no se convierte y readiness lo bloquea antes de generar', () => {
    const p0 = gente(1, 2026)(0);
    const conciliacion = escenario(
      [
        filaFinnegans(p0, {
          Banco: BANCO_PATAGONIA,
          Remunerativo: '0',
          'No remunerativo': '0',
          Descuento: '1',
          Neto: '-1',
        }),
      ],
      [registroPatagonia(p0, createRandom(2026))],
    );

    expect(pagosPatagoniaDesdeConciliacion(conciliacion)).toHaveLength(0);
    const cobertura = coberturaPagosPatagonia(conciliacion);
    expect(cobertura.convertidas.cantidad).toBe(0);
    expect(cobertura.noConvertibles).toEqual([
      expect.objectContaining({ motivo: 'NETO_NEGATIVO' }),
    ]);
    expect(cobertura.completa).toBe(false);

    const resultado = generarPatagonia(entradaPatagonia(conciliacion));
    expect(resultado.estado).toBe('CONCILIACION_NO_LISTA');
    if (resultado.estado === 'CONCILIACION_NO_LISTA') {
      expect(resultado.motivo).toBe('BLOQUEANTES_PATAGONIA');
    }
    expect(sinBytes(resultado)).toBe(true);
  });

  it('un campo Patagonia inválido queda informado con su campo y bloquea la generación', () => {
    const conciliacion = conDatosPatagonia(escenarioPatagoniaValido(), 0, {
      tipoCuenta: { estado: 'INVALIDO', texto: '9', motivo: 'FUERA_DE_CATALOGO' },
    });

    expect(pagosPatagoniaDesdeConciliacion(conciliacion)).toHaveLength(0);
    const cobertura = coberturaPagosPatagonia(conciliacion);
    expect(cobertura.noConvertibles).toEqual([
      expect.objectContaining({
        motivo: 'CAMPO_PATAGONIA_INVALIDO',
        campo: 'PAT_TIPO_CUENTA',
      }),
    ]);
    expect(cobertura.completa).toBe(false);

    const resultado = generarPatagonia(entradaPatagonia(conciliacion));
    expect(resultado.estado).toBe('COBERTURA_PAGOS_INCOMPLETA');
    if (resultado.estado === 'COBERTURA_PAGOS_INCOMPLETA') {
      expect(resultado.motivo).toBe('FILAS_PATAGONIA_NO_CONVERTIBLES');
      expect(resultado.noConvertibles).toHaveLength(1);
    }
    expect(sinBytes(resultado)).toBe(true);
  });

  it('una provincia incompatible no se descarta en silencio aunque no haya incidencia', () => {
    const conciliacion = conDatosPatagonia(escenarioPatagoniaValido(), 0, {
      provinciaDocumento: { estado: 'VALIDO', texto: '01', valor: '01' },
    });

    expect(pagosPatagoniaDesdeConciliacion(conciliacion)).toHaveLength(0);
    const cobertura = coberturaPagosPatagonia(conciliacion);
    expect(cobertura.noConvertibles).toEqual([
      expect.objectContaining({
        motivo: 'PROVINCIA_INCOMPATIBLE',
        campo: 'PAT_PROVINCIA_DOCUMENTO',
      }),
    ]);
    expect(cobertura.completa).toBe(false);

    const resultado = generarPatagonia(entradaPatagonia(conciliacion));
    expect(resultado.estado).toBe('COBERTURA_PAGOS_INCOMPLETA');
    if (resultado.estado === 'COBERTURA_PAGOS_INCOMPLETA') {
      expect(resultado.motivo).toBe('FILAS_PATAGONIA_NO_CONVERTIBLES');
      expect(resultado.convertidas.cantidad).toBe(0);
      expect(resultado.asignadas.cantidad).toBe(1);
    }
    expect(sinBytes(resultado)).toBe(true);
  });

  it('pagos parcialmente convertibles bloquean en vez de generar un subconjunto', () => {
    const conciliacion = conDatosPatagonia(escenarioPatagoniaValido(2, 2026), 1, {
      provinciaDocumento: { estado: 'VALIDO', texto: '01', valor: '01' },
    });

    const pagos = pagosPatagoniaDesdeConciliacion(conciliacion);
    expect(pagos).toHaveLength(1);
    expect(pagos[0]?.ref.fila).toBe(2);

    const cobertura = coberturaPagosPatagonia(conciliacion);
    expect(cobertura.asignadas.cantidad).toBe(2);
    expect(cobertura.convertidas.cantidad).toBe(1);
    expect(cobertura.noConvertibles).toHaveLength(1);
    expect(cobertura.noConvertibles[0]?.ref.fila).toBe(3);
    expect(cobertura.noConvertibles[0]?.motivo).toBe('PROVINCIA_INCOMPATIBLE');
    expect(cobertura.completa).toBe(false);

    const resultado = generarPatagonia(entradaPatagonia(conciliacion));
    expect(resultado.estado).toBe('COBERTURA_PAGOS_INCOMPLETA');
    if (resultado.estado === 'COBERTURA_PAGOS_INCOMPLETA') {
      expect(resultado.motivo).toBe('FILAS_PATAGONIA_NO_CONVERTIBLES');
      expect(resultado.asignadas.cantidad).toBe(2);
      expect(resultado.convertidas.cantidad).toBe(1);
      expect(resultado.noConvertibles).toHaveLength(1);
    }
    expect(sinBytes(resultado)).toBe(true);
  });

  it('refs duplicadas se detectan como invariante y bloquean la generación', () => {
    const base = conciliacionGoldenPatagonia();
    const primera = base.filas[0];
    const segunda = base.filas[1];
    if (primera === undefined || segunda === undefined) {
      return;
    }
    const duplicada: ResultadoConciliacion = {
      ...base,
      filas: [primera, { ...segunda, linea: { ...segunda.linea, ref: primera.linea.ref } }],
    };

    const cobertura = coberturaPagosPatagonia(duplicada);
    expect(cobertura.refsUnicas).toBe(false);
    expect(cobertura.totalesCoinciden).toBe(true);
    expect(cobertura.completa).toBe(false);

    const resultado = generarPatagonia(entradaPatagonia(duplicada));
    expect(resultado.estado).toBe('COBERTURA_PAGOS_INCOMPLETA');
    if (resultado.estado === 'COBERTURA_PAGOS_INCOMPLETA') {
      expect(resultado.motivo).toBe('INVARIANTES_PAGOS_PATAGONIA');
    }
    expect(sinBytes(resultado)).toBe(true);
  });
});

describe('evaluación técnica Patagonia (CP-F7-C2.4-A1)', () => {
  it('informa configuración incompleta sin bytes', () => {
    const resultado = evaluarAptitudTecnicaPatagonia(
      entradaPatagonia(null, { perfil: null, parametros: null }),
    );
    expect(resultado.estado).toBe('CONFIGURACION_INCOMPLETA');
    if (resultado.estado === 'CONFIGURACION_INCOMPLETA') {
      expect(resultado.motivos).toEqual(['PERFIL_AUSENTE', 'PARAMETROS_AUSENTES']);
      expect(resultado.perfilVersion).toBeNull();
    }
    expect(sinBytes(resultado)).toBe(true);
  });

  it('PAT-2 tiene precedencia sobre la ausencia de conciliación', () => {
    const resultado = evaluarAptitudTecnicaPatagonia(
      entradaPatagonia(null, { parametros: parametrosGoldenPatagonia() }),
    );
    expect(resultado.estado).toBe('HIPOTESIS_PAT2_NO_CONFIRMADA');
    if (resultado.estado === 'HIPOTESIS_PAT2_NO_CONFIRMADA') {
      expect(resultado.hipotesis).toBe('NUMERICA');
      expect(resultado.hipotesisConfirmada).toBe('ALFANUMERICA');
    }
    expect(sinBytes(resultado)).toBe(true);
  });

  it('informa conciliación ausente sin abrir la compuerta productiva', () => {
    const resultado = evaluarAptitudTecnicaPatagonia(entradaPatagonia(null));
    expect(resultado.estado).toBe('CONCILIACION_NO_LISTA');
    if (resultado.estado === 'CONCILIACION_NO_LISTA') {
      expect(resultado.motivo).toBe('SIN_CONCILIACION');
      expect(resultado.pendienteHomologacion).toBe(true);
    }
    expect(sinBytes(resultado)).toBe(true);
  });

  it('informa conciliación bloqueada por neto negativo', () => {
    const p0 = gente(1, 2026)(0);
    const conciliacion = escenario(
      [
        filaFinnegans(p0, {
          Banco: BANCO_PATAGONIA,
          Remunerativo: '0',
          'No remunerativo': '0',
          Descuento: '1',
          Neto: '-1',
        }),
      ],
      [registroPatagonia(p0, createRandom(2026))],
    );

    const resultado = evaluarAptitudTecnicaPatagonia(entradaPatagonia(conciliacion));
    expect(resultado.estado).toBe('CONCILIACION_NO_LISTA');
    if (resultado.estado === 'CONCILIACION_NO_LISTA') {
      expect(resultado.motivo).toBe('BLOQUEANTES_PATAGONIA');
    }
    expect(sinBytes(resultado)).toBe(true);
  });

  it('informa documento no confirmado y conserva sus referencias', () => {
    const conciliacion = conDatosPatagonia(escenarioPatagoniaValido(), 0, {
      tipoDocumento: { estado: 'VALIDO', texto: '002', valor: '002' },
    });
    const resultado = evaluarAptitudTecnicaPatagonia(entradaPatagonia(conciliacion));

    expect(resultado.estado).toBe('TIPO_DOCUMENTO_NO_CONFIRMADO');
    if (resultado.estado === 'TIPO_DOCUMENTO_NO_CONFIRMADO') {
      expect(resultado.tiposDocumento).toEqual(['002']);
      expect(resultado.refs).toEqual([conciliacion.filas[0]?.linea.ref]);
    }
    expect(sinBytes(resultado)).toBe(true);
  });

  it('A2.4: un legajo presente inválido bloquea como dato inválido, no como política pendiente', () => {
    const base = conciliacionGoldenPatagonia();
    const conciliacion: ResultadoConciliacion = {
      ...base,
      filas: base.filas.map((fila, indice) =>
        indice === 0 ? { ...fila, linea: { ...fila.linea, legajo: 'ABCD' } } : fila,
      ),
    };
    const resultado = evaluarAptitudTecnicaPatagonia(entradaPatagonia(conciliacion));

    expect(resultado.estado).toBe('DATOS_PATAGONIA_INVALIDOS');
    if (resultado.estado === 'DATOS_PATAGONIA_INVALIDOS') {
      expect(resultado.motivo).toBe('DATOS_PATAGONIA_INVALIDOS');
      expect(resultado.errores).toEqual([
        {
          codigo: 'COMPROBANTE_INVALIDO',
          campoId: 'r2_numeroComprobante',
          ref: conciliacion.filas[0]?.linea.ref,
        },
      ]);
    }
    expect(sinBytes(resultado)).toBe(true);
  });

  it('A2.6: un nombre inválido bloquea como estado tipado, con campo y referencia', () => {
    const conciliacion = conNombrePatagonia(conciliacionGoldenPatagonia(), 'Pérez@', 'Ana');
    const resultado = evaluarAptitudTecnicaPatagonia(entradaPatagonia(conciliacion));

    expect(resultado.estado).toBe('NOMBRE_PATAGONIA_INVALIDO');
    if (resultado.estado === 'NOMBRE_PATAGONIA_INVALIDO') {
      expect(resultado.motivo).toBe('NOMBRE_PATAGONIA_INVALIDO');
      expect(resultado.errores).toEqual([
        {
          codigo: 'NOMBRE_CARACTER_NO_RESPALDADO',
          campoId: 'r2_apellidoNombre',
          ref: conciliacion.filas[0]?.linea.ref,
        },
      ]);
      expect(resultado.pendienteHomologacion).toBe(true);
    }
    expect(sinBytes(resultado)).toBe(true);
  });

  it('A2.6: nombre normalizado y de 20 caracteres no bloquea; PAT-7 sigue pendiente', () => {
    const conciliacion = conNombrePatagonia(conciliacionGoldenPatagonia(), 'Muñoz', 'A'.repeat(14));
    const resultado = evaluarAptitudTecnicaPatagonia(entradaPatagonia(conciliacion));

    expect(resultado.estado).toBe('MAPEO_NO_RESUELTO');
    if (resultado.estado === 'MAPEO_NO_RESUELTO') {
      expect(resultado.puntos).toEqual(['PAT-7/P-09/P-10']);
    }
    expect(sinBytes(resultado)).toBe(true);
  });

  it('informa cobertura incompleta con referencia y motivo de cada fila', () => {
    const conciliacion = conDatosPatagonia(escenarioPatagoniaValido(2, 2026), 1, {
      provinciaDocumento: { estado: 'VALIDO', texto: '01', valor: '01' },
    });
    const resultado = evaluarAptitudTecnicaPatagonia(entradaPatagonia(conciliacion));

    expect(resultado.estado).toBe('COBERTURA_PAGOS_INCOMPLETA');
    if (resultado.estado === 'COBERTURA_PAGOS_INCOMPLETA') {
      expect(resultado.motivo).toBe('FILAS_PATAGONIA_NO_CONVERTIBLES');
      expect(resultado.asignadas.cantidad).toBe(2);
      expect(resultado.convertidas.cantidad).toBe(1);
      expect(resultado.noConvertibles).toEqual([
        expect.objectContaining({
          ref: conciliacion.filas[1]?.linea.ref,
          motivo: 'PROVINCIA_INCOMPATIBLE',
          campo: 'PAT_PROVINCIA_DOCUMENTO',
        }),
      ]);
    }
    expect(sinBytes(resultado)).toBe(true);
  });

  it('con política productiva real pendiente informa mapeo pendiente, no aptitud', () => {
    const resultado = evaluarAptitudTecnicaPatagonia(
      entradaPatagonia(conciliacionGoldenPatagonia()),
    );
    expect(resultado.estado).toBe('MAPEO_NO_RESUELTO');
    if (resultado.estado === 'MAPEO_NO_RESUELTO') {
      expect(resultado.motivo).toBe('POLITICA_SIN_RESOLUCION');
      expect(resultado.puntos).toEqual(['PAT-7/P-09/P-10']);
      expect(resultado.puntos).not.toContain('P-20');
      expect(resultado.puntos).not.toContain('PAT-4');
      expect(resultado.puntos).not.toContain('PAT-9/P-14');
      expect(resultado.puntos).not.toContain('PAT-15');
      expect(resultado.puntos).not.toContain('PAT-16');
      expect(resultado.requisitos.map((requisito) => requisito.punto)).toEqual(resultado.puntos);
      for (const requisito of resultado.requisitos) {
        expect(requisito.campo).not.toBe('');
        expect(requisito.requisito).not.toBe('');
        expect(requisito.responsables.length).toBeGreaterThan(0);
        expect(requisito.origenes.length).toBeGreaterThan(0);
      }
    }
    expect(sinBytes(resultado)).toBe(true);
  });

  it('una corrida válida no resulta apta mientras la política real tenga pendientes', () => {
    const conciliacion = conciliacionGoldenPatagonia();
    const resultado = evaluarAptitudTecnicaPatagonia(entradaPatagonia(conciliacion));

    expect(resultado.estado).not.toBe('APTO_TECNICAMENTE');
    expect(sinBytes(resultado)).toBe(true);

    const generacion = generarPatagonia(entradaPatagonia(conciliacion));
    expect(generacion.estado).toBe('HOMOLOGACION_PATAGONIA_PENDIENTE');
    expect(sinBytes(generacion)).toBe(true);
  });

  it('la evaluación técnica no cambia el bloqueo de la fachada productiva', () => {
    const conciliacion = conciliacionGoldenPatagonia();
    const evaluacion = evaluarGeneracionPatagonia(entradaPatagonia(conciliacion));
    expect(evaluacion.estado).toBe('HOMOLOGACION_PATAGONIA_PENDIENTE');
    expect(sinBytes(evaluacion)).toBe(true);

    const generacion = generarPatagonia(entradaPatagonia(conciliacion));
    expect(generacion.estado).toBe('HOMOLOGACION_PATAGONIA_PENDIENTE');
    expect(sinBytes(generacion)).toBe(true);
  });
});
