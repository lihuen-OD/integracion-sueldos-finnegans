// Ramas técnicas internas de la fachada Patagonia. La aptitud contractual y la política se
// sustituyen SOLO con `vi.mock`, exclusivamente bajo `tests/**`: la API pública de
// `src/run/generacionPatagonia.ts` no expone ningún argumento para hacerlo. Así se prueban
// serializer, inspector y clasificación de errores sin abrir un bypass productivo.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AptitudPatagonia,
  CodigoTipoLiquidacionPatagoniaProvisional,
  ErrorInspeccionPatagonia,
  PoliticaPatagonia,
} from '../../../src/banks/patagonia-b2';
import type { Centavos } from '../../../src/domain/money';
import type { ResultadoConciliacion } from '../../../src/reconciliation';
import {
  resolverSeleccionLiquidacionPatagonia,
  revisionSeleccionLiquidacionPatagonia,
  type SnapshotSeleccionLiquidacionPatagonia,
} from '../../../src/run/seleccionLiquidacionPatagonia';
import {
  evaluarAptitudTecnicaPatagonia,
  evaluarGeneracionPatagonia,
  generarPatagonia,
} from '../../../src/run/generacionPatagonia';
import {
  conciliacionGoldenPatagonia,
  parametrosGoldenPatagoniaAlfanumerica,
  perfilV3Golden,
} from '../../fixtures/synthetic/goldenPatagonia';

const estado = vi.hoisted(() => ({
  aptitud: null as AptitudPatagonia | null,
  politica: null as PoliticaPatagonia | null,
  produccionHabilitada: false,
  loteoInvalido: false,
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
    produccionPatagoniaHabilitada: () => estado.produccionHabilitada,
    POLITICA_PATAGONIA_PRODUCTIVA: politicaEfectiva,
    estrategiaLotesPatagonia: (pagos: Parameters<typeof actual.estrategiaLotesPatagonia>[0]) =>
      estado.loteoInvalido
        ? { ok: false as const, error: [{ codigo: 'CANTIDAD_LOTES_EXCEDIDA' as const }] }
        : actual.estrategiaLotesPatagonia(pagos),
    serializarPatagonia: vi.fn(actual.serializarPatagonia),
    inspeccionarPatagonia: vi.fn(actual.inspeccionarPatagonia),
  };
});

const { inspeccionarPatagonia, serializarPatagonia } =
  await import('../../../src/banks/patagonia-b2');

beforeEach(() => {
  estado.aptitud = null;
  estado.politica = null;
  estado.loteoInvalido = false;
  // Las ramas técnicas de este archivo simulan una autorización productiva
  // aprobada para poder ejercitar mapper, serializer e inspector. La compuerta
  // real se prueba en `autorizacion.test.ts` y en el caso dedicado de abajo.
  estado.produccionHabilitada = true;
  vi.mocked(serializarPatagonia).mockImplementation(patagoniaReal.serializarPatagonia);
  vi.mocked(inspeccionarPatagonia).mockImplementation(patagoniaReal.inspeccionarPatagonia);
});

function entrada(conciliacion: ResultadoConciliacion | null = conciliacionGoldenPatagonia()) {
  return {
    perfil: perfilV3Golden(),
    conciliacion,
    parametros: parametrosGoldenPatagoniaAlfanumerica(),
  };
}

/** Copia sintética de la conciliación golden con el legajo del primer pago cambiado. */
function conciliacionConLegajo(legajo: string | null): ResultadoConciliacion {
  const base = conciliacionGoldenPatagonia();
  return {
    ...base,
    filas: base.filas.map((fila, indice) =>
      indice === 0 ? { ...fila, linea: { ...fila.linea, legajo } } : fila,
    ),
  };
}

/** Copia sintética de la conciliación golden con el nombre del primer pago cambiado. */
function conciliacionConNombre(apellido: string, nombre: string): ResultadoConciliacion {
  const base = conciliacionGoldenPatagonia();
  return {
    ...base,
    filas: base.filas.map((fila, indice) =>
      indice === 0 ? { ...fila, linea: { ...fila.linea, apellido, nombre } } : fila,
    ),
  };
}

/** Copia sintética con dos filas asignadas que comparten la misma referencia A0. */
function conciliacionConRefDuplicada(): ResultadoConciliacion {
  const base = conciliacionGoldenPatagonia();
  const primera = base.filas[0];
  const segunda = base.filas[1];
  if (primera === undefined || segunda === undefined) {
    throw new Error('el golden debe tener al menos dos filas');
  }
  return {
    ...base,
    filas: [primera, { ...segunda, linea: { ...segunda.linea, ref: primera.linea.ref } }],
  };
}

/**
 * Construye una conciliación sintética con su revisión C5-A y el snapshot que la produjo.
 * Solo se usa para probar que la evaluación y la generación comparten la misma política;
 * no toca la compuerta real ni escribe archivos.
 */
function conciliacionConSeleccion(codigo: CodigoTipoLiquidacionPatagoniaProvisional): {
  readonly conciliacion: ResultadoConciliacion;
  readonly snapshot: SnapshotSeleccionLiquidacionPatagonia;
} {
  const huella = 'huella-f1-politica';
  const base = conciliacionGoldenPatagonia();
  const lineas = base.filas.map((fila) => fila.linea);
  const descripcion = lineas[0]?.descripcion.descripcionOriginal;
  if (descripcion === undefined) {
    throw new Error('el golden debe tener al menos una fila');
  }
  const aplicado = patagoniaReal.aplicarSeleccionesLiquidacionPatagonia(
    { huellaFinnegans: huella, lineas },
    [
      {
        huellaFinnegans: huella,
        destino: 'PATAGONIA_B2',
        descripcionOriginal: descripcion,
        codigoTipoLiquidacion: codigo,
      },
    ],
  );
  if (!aplicado.ok) {
    throw new Error(`selección sintética inválida: ${aplicado.error.map((e) => e.codigo).join()}`);
  }
  const snapshot: SnapshotSeleccionLiquidacionPatagonia = {
    huellaFinnegans: aplicado.value.huellaFinnegans,
    seleccionesValidadas: aplicado.value.seleccionesValidadas,
    cantidadesAfectadas: aplicado.value.cantidadesAfectadas,
    pendientes: aplicado.value.pendientes,
  };
  const resolucion = resolverSeleccionLiquidacionPatagonia(snapshot, huella, lineas);
  if (resolucion === null) {
    throw new Error('el snapshot sintético debe resolver');
  }
  return {
    conciliacion: {
      ...base,
      revisionSeleccionLiquidacionPatagonia: revisionSeleccionLiquidacionPatagonia(resolucion),
    },
    snapshot,
  };
}

function entradaConSeleccion(
  conciliacion: ResultadoConciliacion,
  snapshot: SnapshotSeleccionLiquidacionPatagonia,
) {
  return {
    ...entrada(conciliacion),
    seleccionLiquidacionPatagonia: snapshot,
    huellaFinnegans: snapshot.huellaFinnegans,
  };
}

describe('pipeline técnico de la fachada Patagonia con aptitud/política mockeadas', () => {
  it('sin autorización productiva no evalúa política ni serializa', () => {
    estado.produccionHabilitada = false;
    const evaluacion = evaluarGeneracionPatagonia(entrada());
    expect(evaluacion.estado).toBe('HOMOLOGACION_PATAGONIA_PENDIENTE');
    expect('bytes' in evaluacion).toBe(false);

    const resultado = generarPatagonia(entrada());
    expect(resultado.estado).toBe('HOMOLOGACION_PATAGONIA_PENDIENTE');
    expect('bytes' in resultado).toBe(false);
    expect(vi.mocked(serializarPatagonia)).not.toHaveBeenCalled();
    expect(vi.mocked(inspeccionarPatagonia)).not.toHaveBeenCalled();
  });

  it('la evaluación puede llegar a LISTO_TECNICAMENTE sin producir bytes', () => {
    const evaluacion = evaluarGeneracionPatagonia(entrada());
    expect(evaluacion.estado).toBe('LISTO_TECNICAMENTE');
    if (evaluacion.estado === 'LISTO_TECNICAMENTE') {
      expect(evaluacion.readiness.estado).toBe('LISTO_PARA_GENERAR');
      expect(evaluacion.pagos).toHaveLength(2);
      expect(evaluacion.aptitud.generadorHabilitado).toBe(true);
    }
  });

  it('la política productiva solo deja abierto PAT-7/P-09/P-10', () => {
    estado.politica = patagoniaReal.POLITICA_PATAGONIA_PRODUCTIVA;
    const evaluacion = evaluarGeneracionPatagonia(entrada());
    expect(evaluacion.estado).toBe('MAPEO_NO_RESUELTO');
    if (evaluacion.estado === 'MAPEO_NO_RESUELTO') {
      expect(evaluacion.motivo).toBe('POLITICA_SIN_RESOLUCION');
      expect(evaluacion.puntos).toEqual(['PAT-7/P-09/P-10']);
      expect(evaluacion.puntos).not.toContain('P-20');
      expect(evaluacion.puntos).not.toContain('PAT-4');
      expect(evaluacion.puntos).not.toContain('PAT-9/P-14');
      expect(evaluacion.puntos).not.toContain('PAT-15');
      expect(evaluacion.puntos).not.toContain('PAT-16');
      expect(evaluacion.requisitos.map((requisito) => requisito.punto)).toEqual(evaluacion.puntos);
      for (const requisito of evaluacion.requisitos) {
        expect(requisito.campo).not.toBe('');
        expect(requisito.requisito).not.toBe('');
        expect(requisito.responsables.length).toBeGreaterThan(0);
        expect(requisito.origenes.length).toBeGreaterThan(0);
      }
    }
    expect(vi.mocked(serializarPatagonia)).not.toHaveBeenCalled();
    expect('bytes' in evaluacion).toBe(false);
  });

  it('A0 bloquea referencias duplicadas antes de declarar aptitud, aunque la política esté resuelta', () => {
    const conciliacion = conciliacionConRefDuplicada();
    const evaluacion = evaluarAptitudTecnicaPatagonia(entrada(conciliacion));

    expect(evaluacion.estado).toBe('COBERTURA_PAGOS_INCOMPLETA');
    if (evaluacion.estado === 'COBERTURA_PAGOS_INCOMPLETA') {
      expect(evaluacion.motivo).toBe('INVARIANTES_PAGOS_PATAGONIA');
      expect(evaluacion.refsUnicas).toBe(false);
    }
    expect('bytes' in evaluacion).toBe(false);
    expect(vi.mocked(serializarPatagonia)).not.toHaveBeenCalled();
    expect(vi.mocked(inspeccionarPatagonia)).not.toHaveBeenCalled();
  });

  it('un loteo inválido impide declarar aptitud y no produce bytes', () => {
    estado.loteoInvalido = true;
    const evaluacion = evaluarAptitudTecnicaPatagonia(entrada());
    expect(evaluacion.estado).toBe('LOTEO_PATAGONIA_INVALIDO');
    if (evaluacion.estado === 'LOTEO_PATAGONIA_INVALIDO') {
      expect(evaluacion.motivo).toBe('LOTEO_PATAGONIA_INVALIDO');
      expect(evaluacion.errores).toEqual([{ codigo: 'CANTIDAD_LOTES_EXCEDIDA' }]);
      expect(evaluacion.pendienteHomologacion).toBe(true);
    }
    expect('bytes' in evaluacion).toBe(false);
    expect(vi.mocked(serializarPatagonia)).not.toHaveBeenCalled();
    expect(vi.mocked(inspeccionarPatagonia)).not.toHaveBeenCalled();
  });

  it('generarPatagonia devuelve LOTEO_PATAGONIA_INVALIDO por exceso de capacidad, sin bytes', () => {
    estado.loteoInvalido = true;
    const resultado = generarPatagonia(entrada());

    expect(resultado.estado).toBe('LOTEO_PATAGONIA_INVALIDO');
    if (resultado.estado === 'LOTEO_PATAGONIA_INVALIDO') {
      expect(resultado.motivo).toBe('LOTEO_PATAGONIA_INVALIDO');
      expect(resultado.errores).toEqual([{ codigo: 'CANTIDAD_LOTES_EXCEDIDA' }]);
    }
    expect(resultado.estado).not.toBe('MAPEO_NO_RESUELTO');
    expect('bytes' in resultado).toBe(false);
    expect(vi.mocked(serializarPatagonia)).not.toHaveBeenCalled();
    expect(vi.mocked(inspeccionarPatagonia)).not.toHaveBeenCalled();
  });

  it('A2.6: un nombre inválido impide APTO_TECNICAMENTE con código, campo y referencia', () => {
    const casos = [
      { apellido: '   ', nombre: '   ', codigo: 'NOMBRE_VACIO' },
      { apellido: 'Pérez@', nombre: 'Ana', codigo: 'NOMBRE_CARACTER_NO_RESPALDADO' },
      { apellido: 'A'.repeat(10), nombre: 'B'.repeat(10), codigo: 'NOMBRE_LONGITUD_EXCEDIDA' },
    ] as const;
    for (const caso of casos) {
      const conciliacion = conciliacionConNombre(caso.apellido, caso.nombre);
      const evaluacion = evaluarAptitudTecnicaPatagonia(entrada(conciliacion));

      expect(evaluacion.estado).toBe('NOMBRE_PATAGONIA_INVALIDO');
      if (evaluacion.estado === 'NOMBRE_PATAGONIA_INVALIDO') {
        expect(evaluacion.motivo).toBe('NOMBRE_PATAGONIA_INVALIDO');
        expect(evaluacion.errores).toEqual([
          {
            codigo: caso.codigo,
            campoId: 'r2_apellidoNombre',
            ref: conciliacion.filas[0]?.linea.ref,
          },
        ]);
        expect(evaluacion.errores[0]?.ref.fila).toBe(conciliacion.filas[0]?.linea.ref.fila);
        expect(evaluacion.pendienteHomologacion).toBe(true);
      }
      expect('bytes' in evaluacion).toBe(false);
      expect(vi.mocked(serializarPatagonia)).not.toHaveBeenCalled();
      expect(vi.mocked(inspeccionarPatagonia)).not.toHaveBeenCalled();
    }
  });

  it('A2.6: generarPatagonia no produce bytes con un nombre inválido', () => {
    const conciliacion = conciliacionConNombre('Pérez@', 'Ana');
    const resultado = generarPatagonia(entrada(conciliacion));

    expect(resultado.estado).toBe('NOMBRE_PATAGONIA_INVALIDO');
    if (resultado.estado === 'NOMBRE_PATAGONIA_INVALIDO') {
      expect(resultado.errores).toEqual([
        {
          codigo: 'NOMBRE_CARACTER_NO_RESPALDADO',
          campoId: 'r2_apellidoNombre',
          ref: conciliacion.filas[0]?.linea.ref,
        },
      ]);
    }
    expect('bytes' in resultado).toBe(false);
    expect(vi.mocked(serializarPatagonia)).not.toHaveBeenCalled();
    expect(vi.mocked(inspeccionarPatagonia)).not.toHaveBeenCalled();
  });

  it('A2.6: exactamente 20 caracteres se acepta y no declara truncamiento', () => {
    const conciliacion = conciliacionConNombre('A'.repeat(10), 'B'.repeat(9));
    const evaluacion = evaluarAptitudTecnicaPatagonia(entrada(conciliacion));

    expect(evaluacion.estado).toBe('APTO_TECNICAMENTE');
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
      expect(resultado.requisitos.map((requisito) => requisito.punto)).toEqual(['P-20']);
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
      expect(resultado.requisitos).toEqual([]);
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

  it('un upstream inconsistente con filas asignadas desaparecidas bloquea por cobertura', () => {
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
    expect(resultado.estado).toBe('COBERTURA_PAGOS_INCOMPLETA');
    if (resultado.estado === 'COBERTURA_PAGOS_INCOMPLETA') {
      expect(resultado.motivo).toBe('INVARIANTES_PAGOS_PATAGONIA');
      expect(resultado.asignadas.cantidad).toBe(0);
      expect(resultado.globalCoincide).toBe(false);
      expect(resultado.readinessCoincide).toBe(false);
      expect(resultado.completa).toBe(false);
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

  it('A1: distingue aptitud técnica de autorización productiva', () => {
    estado.produccionHabilitada = false;
    const evaluacion = evaluarAptitudTecnicaPatagonia(entrada());

    expect(evaluacion.estado).toBe('APTO_TECNICAMENTE');
    if (evaluacion.estado === 'APTO_TECNICAMENTE') {
      expect(evaluacion.aptoParaContinuar).toBe(true);
      expect(evaluacion.autorizadoParaGenerar).toBe(false);
      expect(evaluacion.motivoAutorizacion).toBe('HOMOLOGACION_PATAGONIA_PENDIENTE');
      expect(evaluacion.pagos).toHaveLength(2);
    }
    expect('bytes' in evaluacion).toBe(false);
    expect(vi.mocked(serializarPatagonia)).not.toHaveBeenCalled();
    expect(vi.mocked(inspeccionarPatagonia)).not.toHaveBeenCalled();
  });

  it('A1: con autorización simulada informa autorizado, sin generar bytes', () => {
    estado.produccionHabilitada = true;
    const evaluacion = evaluarAptitudTecnicaPatagonia(entrada());

    expect(evaluacion.estado).toBe('APTO_TECNICAMENTE');
    if (evaluacion.estado === 'APTO_TECNICAMENTE') {
      expect(evaluacion.autorizadoParaGenerar).toBe(true);
      expect(evaluacion.motivoAutorizacion).toBeNull();
    }
    expect('bytes' in evaluacion).toBe(false);
    expect(vi.mocked(serializarPatagonia)).not.toHaveBeenCalled();
  });

  it('A1: informa contrato pendiente antes de la autorización', () => {
    estado.aptitud = {
      bloqueos: [{ tipo: 'campo', registroId: 'NO_EXISTE', campoId: 'NO_EXISTE' }],
      interpretacionesByte: [],
      interpretacionesSinBytes: [],
      generadorHabilitado: false,
      homologacion: 'PENDIENTE_DE_HOMOLOGACION',
    };
    const evaluacion = evaluarAptitudTecnicaPatagonia(entrada());

    expect(evaluacion.estado).toBe('CONTRATO_PATAGONIA_BLOQUEADO');
    expect('bytes' in evaluacion).toBe(false);
    expect(vi.mocked(serializarPatagonia)).not.toHaveBeenCalled();
  });

  it('A2.4: un legajo presente inválido impide APTO_TECNICAMENTE sin simular política', () => {
    for (const legajo of ['ABCD', '', '12345678', '123456789']) {
      const conciliacion = conciliacionConLegajo(legajo);
      const evaluacion = evaluarAptitudTecnicaPatagonia(entrada(conciliacion));

      expect(evaluacion.estado).toBe('DATOS_PATAGONIA_INVALIDOS');
      if (evaluacion.estado === 'DATOS_PATAGONIA_INVALIDOS') {
        expect(evaluacion.motivo).toBe('DATOS_PATAGONIA_INVALIDOS');
        expect(evaluacion.errores).toEqual([
          {
            codigo: 'COMPROBANTE_INVALIDO',
            campoId: 'r2_numeroComprobante',
            ref: conciliacion.filas[0]?.linea.ref,
          },
        ]);
        expect(evaluacion.errores[0]?.ref.fila).toBe(conciliacion.filas[0]?.linea.ref.fila);
      }
      expect('bytes' in evaluacion).toBe(false);
      expect(vi.mocked(serializarPatagonia)).not.toHaveBeenCalled();
      expect(vi.mocked(inspeccionarPatagonia)).not.toHaveBeenCalled();
    }
  });

  it('A2.4: legajo 0007 válido y legajo null no bloquean la evaluación técnica', () => {
    for (const legajo of ['0007', null]) {
      const evaluacion = evaluarAptitudTecnicaPatagonia(entrada(conciliacionConLegajo(legajo)));
      expect(evaluacion.estado).toBe('APTO_TECNICAMENTE');
      expect('bytes' in evaluacion).toBe(false);
    }
    expect(vi.mocked(serializarPatagonia)).not.toHaveBeenCalled();
    expect(vi.mocked(inspeccionarPatagonia)).not.toHaveBeenCalled();
  });
});

describe('F1: la generación reutiliza la política efectiva de la evaluación', () => {
  it('serializa con la política C5-A que superó la evaluación, no con la productiva', () => {
    const { conciliacion, snapshot } = conciliacionConSeleccion('002');

    const evaluacion = evaluarGeneracionPatagonia(entradaConSeleccion(conciliacion, snapshot));
    expect(evaluacion.estado).toBe('LISTO_TECNICAMENTE');
    if (evaluacion.estado !== 'LISTO_TECNICAMENTE') return;

    const pago = evaluacion.pagos[0];
    if (pago === undefined) throw new Error('la evaluación debe tener al menos un pago');
    expect(evaluacion.politica.tipoLiquidacion(pago)).toEqual(patagoniaReal.resuelto('002'));

    const resultado = generarPatagonia(entradaConSeleccion(conciliacion, snapshot));
    expect(resultado.estado).toBe('GENERADO');
    if (resultado.estado === 'GENERADO') {
      expect(resultado.pendienteHomologacion).toBe(true);
    }

    expect(vi.mocked(serializarPatagonia)).toHaveBeenCalledTimes(1);
    const politicaSerializada = vi.mocked(serializarPatagonia).mock.calls[0]?.[3];
    if (politicaSerializada === undefined) {
      throw new Error('serializarPatagonia debe recibir la política efectiva');
    }
    expect(politicaSerializada).not.toBe(patagoniaReal.POLITICA_PATAGONIA_PRODUCTIVA);
    expect(politicaSerializada.tipoLiquidacion(pago)).toEqual(patagoniaReal.resuelto('002'));
    expect(patagoniaReal.POLITICA_PATAGONIA_PRODUCTIVA.tipoLiquidacion(pago)).toEqual(
      patagoniaReal.sinResolucion('PAT-7/P-09/P-10'),
    );
    // La compuerta real sigue cerrada: el mock solo ejercita la ruta interna.
    expect(patagoniaReal.produccionPatagoniaHabilitada()).toBe(false);
  });

  it('si la revisión de conciliación no coincide, no deriva política ni serializa', () => {
    estado.politica = patagoniaReal.POLITICA_PATAGONIA_PRODUCTIVA;
    const { conciliacion, snapshot } = conciliacionConSeleccion('002');
    const resultado = generarPatagonia(
      entradaConSeleccion(
        { ...conciliacion, revisionSeleccionLiquidacionPatagonia: 'revision-ajena' },
        snapshot,
      ),
    );

    expect(resultado.estado).toBe('MAPEO_NO_RESUELTO');
    if (resultado.estado === 'MAPEO_NO_RESUELTO') {
      expect(resultado.puntos).toContain('PAT-7/P-09/P-10');
    }
    expect('bytes' in resultado).toBe(false);
    expect(vi.mocked(serializarPatagonia)).not.toHaveBeenCalled();
    expect(vi.mocked(inspeccionarPatagonia)).not.toHaveBeenCalled();
  });

  it('sin autorización productiva no existe ruta de serialización', () => {
    estado.produccionHabilitada = false;
    const { conciliacion, snapshot } = conciliacionConSeleccion('002');
    const resultado = generarPatagonia(entradaConSeleccion(conciliacion, snapshot));

    expect(resultado.estado).toBe('HOMOLOGACION_PATAGONIA_PENDIENTE');
    expect('bytes' in resultado).toBe(false);
    expect(vi.mocked(serializarPatagonia)).not.toHaveBeenCalled();
    expect(patagoniaReal.produccionPatagoniaHabilitada()).toBe(false);
  });
});
