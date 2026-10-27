// Fachada productiva Patagonia B.2 (CP-F6-C). La API pública solo acepta perfil,
// conciliación y parámetros: usa siempre la política y la aptitud productivas. Con PAT-1
// y PAT-2 BLOQUEADAS, la compuerta contractual impide generar bytes reales.
import { describe, expect, it } from 'vitest';
import type { ParametrosEnvioPatagonia } from '../../src/banks/patagonia-b2';
import { CATALOGO_BANCOS } from '../../src/domain/destino';
import type { CompanyProfile, CompanyProfileImportado } from '../../src/profile';
import type { ResultadoConciliacion } from '../../src/reconciliation';
import {
  evaluarGeneracionPatagonia,
  generarPatagonia,
  pagosPatagoniaDesdeConciliacion,
  perfilPatagoniaDesdePerfil,
  type EntradaGeneracionPatagonia,
  type ResultadoGeneracionPatagonia,
} from '../../src/run/generacionPatagonia';
import {
  conciliacionGoldenPatagonia,
  parametrosGoldenPatagonia,
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

const PARAMETROS = parametrosGoldenPatagonia();

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

function sinBytes(resultado: ResultadoGeneracionPatagonia): boolean {
  return !('bytes' in resultado);
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
  'aptitud' | 'politica' | 'serializar' | 'inspeccionar' | 'spec' | 'mapper';
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

  it('con configuración y datos válidos queda bloqueada por PAT-1/PAT-2 antes de generar', () => {
    const conciliacion = escenarioPatagoniaValido();
    const resultado = generarPatagonia(entradaPatagonia(conciliacion));
    expect(resultado.estado).toBe('CONTRATO_PATAGONIA_BLOQUEADO');
    if (resultado.estado === 'CONTRATO_PATAGONIA_BLOQUEADO') {
      expect(resultado.referencias).toContain('PAT-1');
      expect(resultado.referencias).toContain('PAT-2');
      expect(resultado.bloqueos).toHaveLength(2);
      expect(resultado.interpretacionesByte).toContain('PAT-4');
      expect(resultado.pendienteHomologacion).toBe(true);
    }
    expect(sinBytes(resultado)).toBe(true);
    expect('bytes' in resultado).toBe(false);

    const evaluacion = evaluarGeneracionPatagonia(entradaPatagonia(conciliacion));
    expect(evaluacion.estado).toBe('CONTRATO_PATAGONIA_BLOQUEADO');
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
    } as unknown as EntradaGeneracionPatagonia;
    const resultado = generarPatagonia(conIntentoDeBypass);
    expect(resultado.estado).toBe('CONTRATO_PATAGONIA_BLOQUEADO');
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
