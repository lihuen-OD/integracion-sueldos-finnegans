import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ParametrosEnvioBna } from '../../src/banks/bna';
import { inspeccionarBna, serializarBna } from '../../src/banks/bna';
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
  conciliacionGoldenBna,
  pagosGoldenBna,
  parametrosGoldenBna,
  perfilBnaGolden,
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
}

/**
 * Entrada construida SOLO con las tres propiedades públicas. La fachada no acepta
 * política, aptitud, serializer ni inspector: las pruebas técnicas de esas capas se
 * hacen componiendo la API pública de BNA, nunca inyectando dependencias en `run`.
 */
function entradaBna(
  conciliacion: ResultadoConciliacion | null,
  opciones: OpcionesEntrada = {},
): EntradaGeneracionBna {
  return {
    perfil: opciones.perfil === undefined ? perfilV2Golden() : opciones.perfil,
    conciliacion,
    parametros: opciones.parametros === undefined ? PARAMETROS : opciones.parametros,
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

// Contrato de tipos: la entrada pública no puede volver a exponer bypasses de test.
// Si alguna de estas claves reaparece, `false` no es asignable a `true` y falla el typecheck.
type ClavesProhibidasGeneracionBna = 'aptitud' | 'politica' | 'serializar' | 'inspeccionar';
type BypassesEnEntrada = Extract<keyof EntradaGeneracionBna, ClavesProhibidasGeneracionBna>;
const ENTRADA_SIN_BYPASSES: BypassesEnEntrada extends never ? true : false = true;

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

  it('la API pública solo acepta perfil, conciliación y parámetros', () => {
    const entrada: EntradaGeneracionBna = {
      perfil: perfilV2Golden(),
      conciliacion: escenarioBnaValido(),
      parametros: PARAMETROS,
    };
    expect(Object.keys(entrada).sort()).toEqual(['conciliacion', 'parametros', 'perfil']);
    expect(ENTRADA_SIN_BYPASSES).toBe(true);
  });

  it('v2 válido + conciliación BNA válida + parámetros completos queda bloqueado por BNA-1', () => {
    const resultado = generarBna({
      perfil: perfilV2Golden(),
      conciliacion: escenarioBnaValido(),
      parametros: PARAMETROS,
    });
    expect(resultado.estado).toBe('CONTRATO_BNA_BLOQUEADO');
    if (resultado.estado === 'CONTRATO_BNA_BLOQUEADO') {
      expect(resultado.referencias).toContain('BNA-1');
      expect(resultado.bloqueos).toEqual([
        { tipo: 'campo', registroId: 'BNA_R2', campoId: 'r2_tipoDocumento' },
      ]);
      expect(resultado.interpretacionesByte).toContain('BNA-2');
    }
    expect(sinBytes(resultado)).toBe(true);

    const evaluacion = evaluarGeneracionBna({
      perfil: perfilV2Golden(),
      conciliacion: escenarioBnaValido(),
      parametros: PARAMETROS,
    });
    expect(evaluacion.estado).toBe('CONTRATO_BNA_BLOQUEADO');
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

    // La compuerta BNA no se contamina con la incidencia Patagonia: el pipeline
    // técnico BNA se compone directamente con política sintética, sin fachada productiva.
    const pagos = pagosBnaDesdeConciliacion(conciliacion);
    expect(pagos).toHaveLength(1);
    const archivo = serializarBna(perfilBnaGolden(), PARAMETROS, pagos, politicaSintetica());
    expect(archivo.ok).toBe(true);
    if (!archivo.ok) {
      return;
    }
    const inspeccion = inspeccionarBna(archivo.value.bytes, PARAMETROS);
    expect(inspeccion.ok).toBe(true);
    expect(archivo.value.totales.cantidad).toBe(1);
    expect(archivo.value.bytes.length).toBe(602);

    // La fachada productiva sigue bloqueada por BNA-1, no por Patagonia.
    const resultado = generarBna(entradaBna(conciliacion));
    expect(resultado.estado).toBe('CONTRATO_BNA_BLOQUEADO');
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

  it('una incidencia global que requiere revisión también impide el pago', () => {
    const base = conciliacionGoldenBna();
    const [primera, ...resto] = base.filas;
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
    const conciliacion: ResultadoConciliacion = {
      ...base,
      filas: [{ ...primera, incidencias: [...primera.incidencias, incidencia] }, ...resto],
    };
    expect(pagosBnaDesdeConciliacion(conciliacion)).toHaveLength(1);
  });

  it('bloqueantes BNA distintos de P-09/P-10 no generan', () => {
    const random = createRandom(2026);
    const p0 = gente(1, 2026)(0);
    const conciliacion = escenario([filaFinnegans(p0)], [registroBna(p0, random, { CBU: null })]);
    const resultado = generarBna(entradaBna(conciliacion));
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
    const resultado = generarBna(entradaBna(conciliacion));
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
    const random = createRandom(2026);
    const p0 = gente(1, 2026)(0);
    const conciliacion = escenario([filaFinnegans(p0)], [registroBna(p0, random)], {
      liquidaciones: null,
    });
    const resultado = generarBna(entradaBna(conciliacion));
    expect(resultado.estado).toBe('MAPEO_NO_RESUELTO');
    if (resultado.estado === 'MAPEO_NO_RESUELTO') {
      expect(resultado.motivo).toBe('LIQUIDACION_SIN_MAPEO');
      expect(resultado.incidencias.map((incidencia) => incidencia.codigo)).toEqual([
        'LIQUIDACION_SIN_MAPEO',
      ]);
    }
    expect(sinBytes(resultado)).toBe(true);
  });

  it('la aptitud contractual no se puede sustituir desde la API pública', () => {
    // Un objeto con propiedades extra no forma parte del contrato: aunque se construya
    // en runtime, la fachada ignora cualquier intento de inyectar aptitud o política.
    const conIntentoDeBypass = {
      perfil: perfilV2Golden(),
      conciliacion: escenarioBnaValido(),
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
    } as unknown as EntradaGeneracionBna;
    const resultado = generarBna(conIntentoDeBypass);
    expect(resultado.estado).toBe('CONTRATO_BNA_BLOQUEADO');
    expect(sinBytes(resultado)).toBe(true);
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

  /**
   * El golden NO atraviesa la fachada productiva. Compone las capas técnicas con la
   * política sintética confinada a tests: `pagos` y `perfil` salen de las funciones puras
   * de mapeo, y luego se llaman `serializarBna` e `inspeccionarBna` directamente.
   */
  function generarGoldenTecnico() {
    const parametros = parametrosGoldenBna();
    const archivo = serializarBna(
      perfilBnaGolden(),
      parametros,
      pagosGoldenBna(),
      politicaSintetica(),
    );
    if (!archivo.ok) {
      throw new Error('golden técnico: serialización fallida');
    }
    const inspeccion = inspeccionarBna(archivo.value.bytes, parametros);
    if (!inspeccion.ok) {
      throw new Error('golden técnico: inspección fallida');
    }
    return { archivo: archivo.value, inspeccion: inspeccion.value, parametros };
  }

  it('declara explícitamente que es técnico, sintético y no homologado', () => {
    expect(golden.etiqueta).toBe('GOLDEN TÉCNICO SINTÉTICO — NO HOMOLOGADO POR BANCO NACIÓN.');
    expect(golden.politica).toBe('SINTETICA_DE_TEST');
    expect(golden.lineSeparator).toBe('LF');
    expect(golden.trailingSeparator).toBe(false);
    expect(golden.cantidad).toBe(2);
    expect(golden.totalImporteCentavos).toBe('84000050');
    expect(golden.descripcion).toContain('No es un archivo aceptado por el banco');
  });

  it('el pipeline técnico sintético genera bytes inspeccionados', () => {
    const { archivo, inspeccion, parametros } = generarGoldenTecnico();
    expect(archivo.totales.cantidad).toBe(2);
    expect(archivo.totales.totalImporte).toBe(84_000_050n as Centavos);
    expect(parametros.lineSeparator).toBe('\n');
    expect(parametros.trailingSeparator).toBe(false);
    expect(inspeccion.cantidadCalculada).toBe(2);
    expect(archivo.bytes).toBeInstanceOf(Uint8Array);
  });

  it('compara byte a byte y verifica la huella SHA-256', () => {
    const { archivo } = generarGoldenTecnico();
    const esperado = new Uint8Array(
      golden.bytesHex.split(' ').map((byte) => Number.parseInt(byte, 16)),
    );
    expect(archivo.bytes.length).toBe(esperado.length);
    for (let indice = 0; indice < esperado.length; indice += 1) {
      expect(archivo.bytes[indice], `byte ${String(indice)}`).toBe(esperado[indice]);
    }
    const huella = createHash('sha256').update(archivo.bytes).digest('hex');
    expect(huella).toBe(golden.sha256);
    expect(archivo.totales.cantidad).toBe(golden.cantidad);
    expect(String(archivo.totales.totalImporte)).toBe(golden.totalImporteCentavos);
  });
});
