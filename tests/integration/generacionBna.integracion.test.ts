import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { AptitudBna, ParametrosEnvioBna, PoliticaBna } from '../../src/banks/bna';
import { inspeccionarBna, serializarBna, sinResolucion } from '../../src/banks/bna';
import { CATALOGO_BANCOS } from '../../src/domain/destino';
import type { Centavos } from '../../src/domain/money';
import type { CompanyProfile, CompanyProfileImportado } from '../../src/profile';
import type { ResultadoConciliacion } from '../../src/reconciliation';
import {
  evaluarGeneracionBna,
  generarBna,
  pagosBnaDesdeConciliacion,
  perfilBnaDesdePerfil,
  type EntradaGeneracionBna,
  type ResultadoGeneracionBna,
} from '../../src/run/generacionBna';
import {
  APTITUD_SINTETICA_GOLDEN,
  conciliacionGoldenBna,
  entradaGoldenBna,
  perfilV2Golden,
} from '../fixtures/synthetic/goldenBna';
import { BANCO_NACION, BANCO_PATAGONIA } from '../fixtures/synthetic/finnegansLike';
import {
  filaFinnegans,
  personas,
  registroBna,
  registroPatagonia,
} from '../fixtures/synthetic/escenarios';
import { createRandom } from '../fixtures/synthetic/identities';
import { perfilSintetico, politicaSintetica } from '../unit/banks/bna/auxiliares';
import { escenario, gente } from '../unit/reconciliation/helpers';

const PARAMETROS: ParametrosEnvioBna = {
  fechaCompensacion: '20261030',
  numeroEnvio: '1',
  infoCriterioEmpresa: 'PAGO DE HABERES',
  referenciaUnivoca: 'HABERES OCTUBRE',
  lineSeparator: '\n',
  trailingSeparator: false,
};

interface OpcionesEntrada {
  readonly perfil?: CompanyProfileImportado | null;
  readonly parametros?: ParametrosEnvioBna | null;
  readonly politica?: PoliticaBna;
  readonly aptitud?: AptitudBna;
  readonly serializar?: typeof serializarBna;
  readonly inspeccionar?: typeof inspeccionarBna;
}

function entradaBna(
  conciliacion: ResultadoConciliacion | null,
  opciones: OpcionesEntrada = {},
): EntradaGeneracionBna {
  return {
    perfil: opciones.perfil === undefined ? perfilV2Golden() : opciones.perfil,
    conciliacion,
    parametros: opciones.parametros === undefined ? PARAMETROS : opciones.parametros,
    ...(opciones.politica === undefined ? {} : { politica: opciones.politica }),
    ...(opciones.aptitud === undefined ? {} : { aptitud: opciones.aptitud }),
    ...(opciones.serializar === undefined ? {} : { serializar: opciones.serializar }),
    ...(opciones.inspeccionar === undefined ? {} : { inspeccionar: opciones.inspeccionar }),
  };
}

function escenarioBnaValido(cantidad = 1, semilla = 2026): ResultadoConciliacion {
  const random = createRandom(semilla);
  const lista = personas(cantidad, semilla);
  const filas = lista.map((persona) => filaFinnegans(persona));
  const registros = lista.map((persona) => registroBna(persona, random));
  return escenario(filas, registros);
}

function sinBytes(resultado: ResultadoGeneracionBna): boolean {
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

describe('perfil en la fachada BNA', () => {
  it('v1 sigue siendo válido históricamente pero BNA da CONFIGURACION_INCOMPLETA', () => {
    const resultado = generarBna(entradaBna(escenarioBnaValido(), { perfil: perfilV1() }));
    expect(resultado.estado).toBe('CONFIGURACION_INCOMPLETA');
    if (resultado.estado === 'CONFIGURACION_INCOMPLETA') {
      expect(resultado.motivos).toContain('PERFIL_V1');
      expect(resultado.perfilVersion).toBe('1');
    }
    expect(sinBytes(resultado)).toBe(true);
  });

  it('perfil ausente y parámetros ausentes no se completan por default', () => {
    const conciliacion = escenarioBnaValido();
    const sinPerfil = generarBna(entradaBna(conciliacion, { perfil: null }));
    expect(sinPerfil.estado).toBe('CONFIGURACION_INCOMPLETA');
    if (sinPerfil.estado === 'CONFIGURACION_INCOMPLETA') {
      expect(sinPerfil.motivos).toContain('PERFIL_AUSENTE');
    }

    const sinParametros = generarBna(entradaBna(conciliacion, { parametros: null }));
    expect(sinParametros.estado).toBe('CONFIGURACION_INCOMPLETA');
    if (sinParametros.estado === 'CONFIGURACION_INCOMPLETA') {
      expect(sinParametros.motivos).toContain('PARAMETROS_AUSENTES');
    }
    expect(sinBytes(sinPerfil)).toBe(true);
    expect(sinBytes(sinParametros)).toBe(true);
  });

  it('v2 válido llega a la evaluación BNA pero no resuelve BNA-1', () => {
    const serializarEspia = vi.fn<typeof serializarBna>();
    const resultado = generarBna(
      entradaBna(escenarioBnaValido(), {
        politica: politicaSintetica(),
        serializar: serializarEspia,
      }),
    );
    expect(resultado.estado).toBe('CONTRATO_BNA_BLOQUEADO');
    if (resultado.estado === 'CONTRATO_BNA_BLOQUEADO') {
      expect(resultado.referencias).toContain('BNA-1');
      expect(resultado.bloqueos).toEqual([
        { tipo: 'campo', registroId: 'BNA_R2', campoId: 'r2_tipoDocumento' },
      ]);
      expect(resultado.interpretacionesByte).toContain('BNA-2');
    }
    expect(serializarEspia).not.toHaveBeenCalled();
    expect(sinBytes(resultado)).toBe(true);
  });

  it('convierte solo los cuatro datos BNA del perfil v2', () => {
    const perfil = perfilV2Golden();
    const bna = perfilBnaDesdePerfil(perfil);
    expect(bna).toEqual({
      cuitEmpresa: perfil.cuitEmpresa,
      cbuEmpresa: perfil.bna.cbuEmpresa,
      codigoConvenio: perfil.bna.codigoConvenio,
      moneda: perfil.bna.moneda,
    });
    expect(Object.keys(bna).sort()).toEqual([
      'cbuEmpresa',
      'codigoConvenio',
      'cuitEmpresa',
      'moneda',
    ]);
  });
});

describe('conciliación en la fachada BNA', () => {
  it('sin conciliación no genera', () => {
    const resultado = generarBna(entradaBna(null));
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
      [filaFinnegans(p0), filaFinnegans(p1, { Banco: '' })],
      [registroBna(p0, random), registroBna(p1, random)],
    );
    const resultado = generarBna(entradaBna(conciliacion));
    expect(resultado.estado).toBe('CONCILIACION_NO_LISTA');
    if (resultado.estado === 'CONCILIACION_NO_LISTA') {
      expect(resultado.motivo).toBe('GLOBAL_PENDIENTE');
      expect(resultado.motivosGlobales).toContain('FILAS_PENDIENTES');
    }
    expect(sinBytes(resultado)).toBe(true);
  });

  it('pago sin destino no genera', () => {
    const random = createRandom(2026);
    const p0 = gente(1, 2026)(0);
    const conciliacion = escenario([filaFinnegans(p0, { Banco: '' })], [registroBna(p0, random)]);
    const resultado = generarBna(entradaBna(conciliacion));
    expect(resultado.estado).toBe('CONCILIACION_NO_LISTA');
    if (resultado.estado === 'CONCILIACION_NO_LISTA') {
      expect(resultado.motivo).toBe('GLOBAL_PENDIENTE');
    }
  });

  it('conciliación global bloqueada no genera', () => {
    const random = createRandom(2026);
    const p0 = gente(1, 2026)(0);
    const conciliacion = escenario([filaFinnegans(p0, { Neto: null })], [registroBna(p0, random)]);
    expect(conciliacion.global.estado).toBe('BLOQUEADA');
    const resultado = generarBna(entradaBna(conciliacion));
    expect(resultado.estado).toBe('CONCILIACION_NO_LISTA');
    if (resultado.estado === 'CONCILIACION_NO_LISTA') {
      expect(resultado.motivo).toBe('GLOBAL_BLOQUEADA');
      expect(resultado.motivosGlobales).toContain('IMPORTE_NO_CALCULABLE');
    }
    expect(sinBytes(resultado)).toBe(true);
  });

  it('banco sin registros con global cerrada da SIN_REGISTROS', () => {
    const random = createRandom(2026);
    const p0 = gente(1, 2026)(0);
    const conciliacion = escenario(
      [filaFinnegans(p0, { Banco: BANCO_PATAGONIA })],
      [registroPatagonia(p0, random)],
    );
    expect(conciliacion.global.estado).toBe('CERRADA');
    const resultado = generarBna(entradaBna(conciliacion));
    expect(resultado.estado).toBe('SIN_REGISTROS');
    if (resultado.estado === 'SIN_REGISTROS') {
      expect(resultado.motivo).toBe('BANCO_SIN_FILAS');
      expect(resultado.asignadas.cantidad).toBe(0);
    }
    expect(sinBytes(resultado)).toBe(true);
  });

  it('una incidencia exclusiva de Patagonia no bloquea BNA (D-032)', () => {
    const random = createRandom(2026);
    const p0 = gente(2, 2026)(0);
    const p1 = gente(2, 2026)(1);
    const conciliacion = escenario(
      [filaFinnegans(p0, { Banco: BANCO_NACION }), filaFinnegans(p1, { Banco: BANCO_PATAGONIA })],
      [registroBna(p0, random), registroPatagonia(p1, random, { PAT_TIPO_CUENTA: '9' })],
    );
    expect(conciliacion.global.estado).toBe('CERRADA');
    expect(
      conciliacion.incidencias.some(
        (incidencia) => incidencia.alcance === 'PATAGONIA_B2' && incidencia.nivel === 'BLOQUEANTE',
      ),
    ).toBe(true);
    const resultado = generarBna(
      entradaBna(conciliacion, {
        politica: politicaSintetica(),
        aptitud: APTITUD_SINTETICA_GOLDEN,
      }),
    );
    expect(resultado.estado).toBe('GENERADO');
    if (resultado.estado === 'GENERADO') {
      expect(resultado.totales.cantidad).toBe(1);
      expect(resultado.bytes.length).toBe(602);
    }
  });

  it('preserva orden, SourceRef y excluye Patagonia en PagoBna[]', () => {
    const conciliacion = conciliacionGoldenBna();
    const pagos = pagosBnaDesdeConciliacion(conciliacion);
    expect(pagos.map((pago) => pago.ref.fila)).toEqual([2, 3]);
    expect(pagos.every((pago) => pago.cbu.length === 22)).toBe(true);
    expect(pagos).toHaveLength(2);
  });

  it('la conversión descarta filas sin maestro, CBU inválido, neto no positivo o con bloqueo', () => {
    const p0 = gente(1, 2026)(0);
    const sinMaestro = escenario([filaFinnegans(p0)], []);
    expect(pagosBnaDesdeConciliacion(sinMaestro)).toHaveLength(0);

    const random = createRandom(2026);
    const cbuInvalido = escenario([filaFinnegans(p0)], [registroBna(p0, random, { CBU: '123' })]);
    expect(pagosBnaDesdeConciliacion(cbuInvalido)).toHaveLength(0);

    const netoNegativo = escenario(
      [filaFinnegans(p0, { Neto: '-100' })],
      [registroBna(p0, createRandom(2026))],
    );
    expect(pagosBnaDesdeConciliacion(netoNegativo)).toHaveLength(0);

    const netoCero = escenario(
      [filaFinnegans(p0, { Neto: '0' })],
      [registroBna(p0, createRandom(2026))],
    );
    expect(pagosBnaDesdeConciliacion(netoCero)).toHaveLength(0);

    const conBloqueo = escenario([filaFinnegans(p0)], [registroBna(p0, createRandom(2026))], {
      liquidaciones: null,
    });
    expect(pagosBnaDesdeConciliacion(conBloqueo)).toHaveLength(0);
  });

  it('un resultado upstream inconsistente sin pagos convertibles da SIN_REGISTROS', () => {
    const real = escenarioBnaValido();
    const inconsistente: ResultadoConciliacion = {
      ...real,
      filas: [],
      global: {
        ...real.global,
        bna: { cantidad: 1, importe: 100n as Centavos, filasSinImporte: 0 },
      },
    };
    const resultado = generarBna(
      entradaBna(inconsistente, {
        politica: politicaSintetica(),
        aptitud: APTITUD_SINTETICA_GOLDEN,
      }),
    );
    expect(resultado.estado).toBe('SIN_REGISTROS');
    if (resultado.estado === 'SIN_REGISTROS') {
      expect(resultado.motivo).toBe('SIN_PAGOS_CONVERTIBLES');
    }
    expect(sinBytes(resultado)).toBe(true);
  });

  it('bloqueantes BNA distintos de P-09/P-10 no generan', () => {
    const random = createRandom(2026);
    const p0 = gente(1, 2026)(0);
    const conciliacion = escenario([filaFinnegans(p0)], [registroBna(p0, random, { CBU: null })]);
    const resultado = generarBna(entradaBna(conciliacion, { politica: politicaSintetica() }));
    expect(resultado.estado).toBe('CONCILIACION_NO_LISTA');
    if (resultado.estado === 'CONCILIACION_NO_LISTA') {
      expect(resultado.motivo).toBe('BLOQUEANTES_BNA');
      expect(resultado.incidencias.map((incidencia) => incidencia.codigo)).toContain(
        'CBU_FALTANTE',
      );
    }
    expect(sinBytes(resultado)).toBe(true);
  });

  it('revisiones BNA sin resolver no generan', () => {
    const random = createRandom(2026);
    const p0 = gente(1, 2026)(0);
    const conciliacion = escenario(
      [filaFinnegans(p0)],
      [registroBna(p0, random, { LEGAJO: '999' })],
    );
    const resultado = generarBna(entradaBna(conciliacion, { politica: politicaSintetica() }));
    expect(resultado.estado).toBe('CONCILIACION_NO_LISTA');
    if (resultado.estado === 'CONCILIACION_NO_LISTA') {
      expect(resultado.motivo).toBe('REVISIONES_BNA');
      expect(resultado.incidencias.map((incidencia) => incidencia.codigo)).toContain(
        'LEGAJO_NO_COINCIDE',
      );
    }
  });
});

describe('decisiones abiertas y contrato BNA', () => {
  it('P-09/P-10 ya informados como LIQUIDACION_SIN_MAPEO se respetan', () => {
    const serializarEspia = vi.fn<typeof serializarBna>();
    const random = createRandom(2026);
    const p0 = gente(1, 2026)(0);
    const conciliacion = escenario([filaFinnegans(p0)], [registroBna(p0, random)], {
      liquidaciones: null,
    });
    const resultado = generarBna(entradaBna(conciliacion, { serializar: serializarEspia }));
    expect(resultado.estado).toBe('MAPEO_NO_RESUELTO');
    if (resultado.estado === 'MAPEO_NO_RESUELTO') {
      expect(resultado.motivo).toBe('LIQUIDACION_SIN_MAPEO');
      expect(resultado.incidencias.map((incidencia) => incidencia.codigo)).toEqual([
        'LIQUIDACION_SIN_MAPEO',
      ]);
    }
    expect(serializarEspia).not.toHaveBeenCalled();
    expect(sinBytes(resultado)).toBe(true);
  });

  it.each([
    ['BNA-2', { cbuCuenta: () => sinResolucion('BNA-2') }],
    ['BNA-6', { sucursalEmpresa: () => sinResolucion('BNA-6') }],
    ['BNA-11/P-17', { infoCriterio: () => sinResolucion('BNA-11/P-17') }],
  ] as const)('sin default para %s', (punto, cambios) => {
    const serializarEspia = vi.fn<typeof serializarBna>();
    const resultado = generarBna(
      entradaBna(escenarioBnaValido(), {
        politica: politicaSintetica(cambios),
        aptitud: APTITUD_SINTETICA_GOLDEN,
        serializar: serializarEspia,
      }),
    );
    expect(resultado.estado).toBe('MAPEO_NO_RESUELTO');
    if (resultado.estado === 'MAPEO_NO_RESUELTO') {
      expect(resultado.motivo).toBe('POLITICA_SIN_RESOLUCION');
      expect(resultado.puntos).toContain(punto);
    }
    expect(serializarEspia).not.toHaveBeenCalled();
  });

  it('remover BNA-1 en un test no habilita la política productiva', () => {
    const serializarEspia = vi.fn<typeof serializarBna>();
    const resultado = generarBna(
      entradaBna(escenarioBnaValido(), {
        aptitud: APTITUD_SINTETICA_GOLDEN,
        serializar: serializarEspia,
      }),
    );
    expect(resultado.estado).toBe('MAPEO_NO_RESUELTO');
    if (resultado.estado === 'MAPEO_NO_RESUELTO') {
      expect(resultado.motivo).toBe('POLITICA_SIN_RESOLUCION');
      expect(resultado.puntos).toEqual(['BNA-6', 'BNA-11/P-17', 'BNA-1', 'BNA-2', 'P-09/P-10']);
    }
    expect(serializarEspia).not.toHaveBeenCalled();
    expect(sinBytes(resultado)).toBe(true);
  });

  it('un bloqueo de separador no inventa referencias de issues BNA', () => {
    const resultado = generarBna(
      entradaBna(escenarioBnaValido(), {
        politica: politicaSintetica(),
        aptitud: {
          ...APTITUD_SINTETICA_GOLDEN,
          bloqueos: [
            { tipo: 'lineSeparator' },
            { tipo: 'campo', registroId: 'NO_EXISTE', campoId: 'NO_EXISTE' },
          ],
          generadorHabilitado: false,
        },
      }),
    );
    expect(resultado.estado).toBe('CONTRATO_BNA_BLOQUEADO');
    if (resultado.estado === 'CONTRATO_BNA_BLOQUEADO') {
      expect(resultado.referencias).toEqual([]);
      expect(resultado.bloqueos).toHaveLength(2);
    }
  });
});

describe('serialización e inspección', () => {
  it('la evaluación sintética llega a LISTO_TECNICAMENTE sin producir bytes', () => {
    const evaluacion = evaluarGeneracionBna(entradaGoldenBna());
    expect(evaluacion.estado).toBe('LISTO_TECNICAMENTE');
    if (evaluacion.estado === 'LISTO_TECNICAMENTE') {
      expect(evaluacion.readiness.estado).toBe('LISTO_PARA_GENERAR');
      expect(evaluacion.pagos).toHaveLength(2);
      expect(evaluacion.aptitud.generadorHabilitado).toBe(true);
    }
  });

  it('SERIALIZACION_FALLIDA no devuelve bytes ni inspecciona', () => {
    const inspeccionarEspia = vi.fn<typeof inspeccionarBna>();
    const resultado = generarBna(
      entradaBna(escenarioBnaValido(), {
        politica: politicaSintetica(),
        aptitud: APTITUD_SINTETICA_GOLDEN,
        serializar: () => ({
          ok: false,
          error: [
            {
              codigo: 'ERROR_SERIALIZACION',
              errores: [{ codigo: 'SPEC_INVALIDA' }],
            },
          ],
        }),
        inspeccionar: inspeccionarEspia,
      }),
    );
    expect(resultado.estado).toBe('SERIALIZACION_FALLIDA');
    expect(inspeccionarEspia).not.toHaveBeenCalled();
    expect(sinBytes(resultado)).toBe(true);
  });

  it('un error de política del serializer se clasifica como MAPEO_NO_RESUELTO', () => {
    const resultado = generarBna(
      entradaBna(escenarioBnaValido(), {
        politica: politicaSintetica(),
        aptitud: APTITUD_SINTETICA_GOLDEN,
        serializar: () => ({
          ok: false,
          error: [{ codigo: 'POLITICA_SIN_RESOLUCION', punto: 'BNA-2' }],
        }),
      }),
    );
    expect(resultado.estado).toBe('MAPEO_NO_RESUELTO');
    if (resultado.estado === 'MAPEO_NO_RESUELTO') {
      expect(resultado.puntos).toEqual(['BNA-2']);
    }
    expect(sinBytes(resultado)).toBe(true);
  });

  it('un error de política sin punto no inventa puntos', () => {
    const resultado = generarBna(
      entradaBna(escenarioBnaValido(), {
        politica: politicaSintetica(),
        aptitud: APTITUD_SINTETICA_GOLDEN,
        serializar: () => ({
          ok: false,
          error: [{ codigo: 'POLITICA_SIN_RESOLUCION' }],
        }),
      }),
    );
    expect(resultado.estado).toBe('MAPEO_NO_RESUELTO');
    if (resultado.estado === 'MAPEO_NO_RESUELTO') {
      expect(resultado.puntos).toEqual([]);
    }
    expect(sinBytes(resultado)).toBe(true);
  });

  it('INSPECCION_BNA_FALLIDA no devuelve archivo', () => {
    const resultado = generarBna(
      entradaBna(escenarioBnaValido(), {
        politica: politicaSintetica(),
        aptitud: APTITUD_SINTETICA_GOLDEN,
        inspeccionar: () => ({
          ok: false,
          error: [{ codigo: 'ARCHIVO_BNA_INVALIDO' }],
        }),
      }),
    );
    expect(resultado.estado).toBe('INSPECCION_BNA_FALLIDA');
    if (resultado.estado === 'INSPECCION_BNA_FALLIDA') {
      expect(resultado.errores).toEqual([{ codigo: 'ARCHIVO_BNA_INVALIDO' }]);
    }
    expect(sinBytes(resultado)).toBe(true);
  });

  it('el recorrido sintético completo genera bytes inspeccionados', () => {
    const resultado = generarBna(entradaGoldenBna());
    expect(resultado.estado).toBe('GENERADO');
    if (resultado.estado === 'GENERADO') {
      expect(resultado.totales.cantidad).toBe(2);
      expect(resultado.totales.totalImporte).toBe(84_000_050n);
      expect(resultado.separador).toBe('\n');
      expect(resultado.trailingSeparator).toBe(false);
      expect(resultado.inspeccion.cantidadCalculada).toBe(2);
      expect(resultado.pendienteHomologacion).toBe(true);
      expect(resultado.bytes).toBeInstanceOf(Uint8Array);
    }
  });
});

describe('golden técnico sintético BNA', () => {
  interface GoldenBna {
    readonly etiqueta: string;
    readonly descripcion: string;
    readonly politica: string;
    readonly lineSeparator: 'LF' | 'CRLF';
    readonly trailingSeparator: boolean;
    readonly cantidad: number;
    readonly totalImporteCentavos: string;
    readonly sha256: string;
    readonly bytesHex: string;
  }

  const golden = JSON.parse(
    readFileSync(
      new URL('../fixtures/synthetic/golden/bna-tecnico-sintetico.json', import.meta.url),
      'utf8',
    ),
  ) as GoldenBna;

  it('declara explícitamente que es técnico, sintético y no homologado', () => {
    expect(golden.etiqueta).toBe('GOLDEN TÉCNICO SINTÉTICO — NO HOMOLOGADO POR BANCO NACIÓN.');
    expect(golden.politica).toBe('SINTETICA_DE_TEST');
    expect(golden.lineSeparator).toBe('LF');
    expect(golden.trailingSeparator).toBe(false);
    expect(golden.cantidad).toBe(2);
    expect(golden.totalImporteCentavos).toBe('84000050');
    expect(golden.descripcion).toContain('No es un archivo aceptado por el banco');
  });

  it('compara byte a byte y verifica la huella SHA-256', () => {
    const resultado = generarBna(entradaGoldenBna());
    expect(resultado.estado).toBe('GENERADO');
    if (resultado.estado !== 'GENERADO') {
      return;
    }
    const esperado = new Uint8Array(
      golden.bytesHex.split(' ').map((byte) => Number.parseInt(byte, 16)),
    );
    expect(resultado.bytes.length).toBe(esperado.length);
    for (let indice = 0; indice < esperado.length; indice += 1) {
      expect(resultado.bytes[indice], `byte ${String(indice)}`).toBe(esperado[indice]);
    }
    const huella = createHash('sha256').update(resultado.bytes).digest('hex');
    expect(huella).toBe(golden.sha256);
    expect(resultado.totales.cantidad).toBe(golden.cantidad);
    expect(String(resultado.totales.totalImporte)).toBe(golden.totalImporteCentavos);
  });
});
