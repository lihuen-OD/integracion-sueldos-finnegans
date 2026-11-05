// C5-B: la evaluación técnica Patagonia consume la resolución C5-A de la misma corrida.
// La conciliación conserva la revisión exacta de las selecciones que aplicó; si luego
// cambian, la evaluación la rechaza aunque la huella del archivo y las líneas coincidan.
// Solo se prueba la fachada pública con datos 100 % sintéticos; no se generan bytes ni se
// toca la compuerta productiva, el mapper, la spec, el fixed-width ni los goldens.
import { describe, expect, it } from 'vitest';
import type { CodigoTipoLiquidacionPatagoniaProvisional } from '../../../src/banks/patagonia-b2';
import { produccionPatagoniaHabilitada } from '../../../src/banks/patagonia-b2';
import type { LecturaFinnegans } from '../../../src/domain/liquidacion';
import type { ResultadoConciliacion } from '../../../src/reconciliation';
import { conFinnegans, nuevaCorrida, type EstadoCorrida } from '../../../src/run/corrida';
import {
  evaluarAptitudTecnicaPatagonia,
  evaluarGeneracionPatagonia,
  generarPatagonia,
  pagosPatagoniaDesdeConciliacion,
  type EntradaGeneracionPatagonia,
} from '../../../src/run/generacionPatagonia';
import {
  aplicarSeleccionesLiquidacionPatagoniaCorrida,
  invalidarSeleccionLiquidacionPatagoniaCorrida,
  politicaLiquidacionesDesdeSeleccionPatagonia,
  politicaPatagoniaDesdeSeleccionPatagonia,
  revisionSeleccionLiquidacionPatagonia,
  resolverSeleccionLiquidacionPatagonia,
  type SnapshotSeleccionLiquidacionPatagonia,
} from '../../../src/run/seleccionLiquidacionPatagonia';
import { createRandom } from '../../fixtures/synthetic/identities';
import { BANCO_NACION, BANCO_PATAGONIA } from '../../fixtures/synthetic/finnegansLike';
import {
  filaFinnegans,
  personas,
  registroBna,
  registroPatagonia,
  type FilaFinnegans,
  type RegistroMaestro,
} from '../../fixtures/synthetic/escenarios';
import {
  conciliacionGoldenPatagonia,
  parametrosGoldenPatagonia,
  parametrosGoldenPatagoniaAlfanumerica,
  perfilV3Golden,
} from '../../fixtures/synthetic/goldenPatagonia';
import { escenario } from '../reconciliation/helpers';
import { pagoSintetico } from '../banks/patagonia-b2/auxiliares';

const HUELLA = 'huella-c5-b';
const HUELLA_MAESTRO = 'huella-maestro-c5-b';

interface SeleccionSintetica {
  readonly descripcionOriginal: string;
  readonly codigoTipoLiquidacion: CodigoTipoLiquidacionPatagoniaProvisional;
}

interface ConciliacionConSnapshot {
  readonly conciliacion: ResultadoConciliacion;
  readonly estado: EstadoCorrida;
}

/**
 * Reconstruye la lectura Finnegans exacta que produjo la conciliación, aplica C2 y vuelve
 * a conciliar con la misma política que usaría la UI. Así el resultado conserva la revisión
 * de las selecciones que realmente utilizó, no solo la huella del archivo.
 */
function conciliarConSeleccion(
  filas: readonly FilaFinnegans[],
  registros: readonly RegistroMaestro[],
  selecciones: readonly SeleccionSintetica[],
): ConciliacionConSnapshot {
  const huellas = { finnegans: HUELLA, maestro: HUELLA_MAESTRO };
  const base = escenario(filas, registros, { huellas });
  const lectura: LecturaFinnegans = {
    hoja: 'Liquidacion sintetica',
    visibilidadHoja: 'visible',
    lineas: base.filas.map((fila) => fila.linea),
    hallazgos: [],
  };
  const aplicado = aplicarSeleccionesLiquidacionPatagoniaCorrida(
    conFinnegans(nuevaCorrida(), lectura, HUELLA),
    selecciones.map((seleccion) => ({
      huellaFinnegans: HUELLA,
      destino: 'PATAGONIA_B2',
      ...seleccion,
    })),
  );
  if (!aplicado.ok) {
    throw new Error(`selección sintética inválida: ${aplicado.error.map((e) => e.codigo).join()}`);
  }
  const estado = aplicado.value.estado;
  const conciliacion = escenario(filas, registros, {
    huellas,
    liquidaciones: politicaLiquidacionesDesdeSeleccionPatagonia(estado),
  });
  return { conciliacion, estado };
}

function goldenConSeleccion(selecciones: readonly SeleccionSintetica[]): ConciliacionConSnapshot {
  const random = createRandom(2026);
  const lista = personas(2, 2026);
  const filas = lista.map((persona) => filaFinnegans(persona, { Banco: BANCO_PATAGONIA }));
  const registros = lista.map((persona) => registroPatagonia(persona, random));
  return conciliarConSeleccion(filas, registros, selecciones);
}

function descripcionesConSeleccion(
  descripciones: readonly string[],
  selecciones: readonly SeleccionSintetica[],
): ConciliacionConSnapshot {
  const random = createRandom(2026);
  const lista = personas(descripciones.length, 2026);
  const filas = lista.map((persona, indice) =>
    filaFinnegans(persona, {
      Banco: BANCO_PATAGONIA,
      Descripcion: descripciones[indice] ?? 'JULIO Agrario',
    }),
  );
  const registros = lista.map((persona) => registroPatagonia(persona, random));
  return conciliarConSeleccion(filas, registros, selecciones);
}

function mixtaConSeleccion(selecciones: readonly SeleccionSintetica[]): ConciliacionConSnapshot {
  const random = createRandom(2026);
  const [patagonia, bna] = personas(2, 2026);
  if (patagonia === undefined || bna === undefined) throw new Error('personas insuficientes');
  return conciliarConSeleccion(
    [
      filaFinnegans(patagonia, { Banco: BANCO_PATAGONIA, Descripcion: 'JULIO Agrario' }),
      filaFinnegans(bna, { Banco: BANCO_NACION, Descripcion: 'JULIO Agrario' }),
    ],
    [registroPatagonia(patagonia, random), registroBna(bna, random)],
    selecciones,
  );
}

function snapshotDe(estado: EstadoCorrida): SnapshotSeleccionLiquidacionPatagonia {
  if (estado.seleccionLiquidacionPatagonia === null) {
    throw new Error('el estado sintético debe tener snapshot');
  }
  return estado.seleccionLiquidacionPatagonia;
}

function descripcionDe(conciliacion: ResultadoConciliacion, indice = 0): string {
  const fila = conciliacion.filas[indice];
  if (fila === undefined) throw new Error('fila sintética inexistente');
  return fila.linea.descripcion.descripcionOriginal;
}

function entrada(
  conciliacion: ResultadoConciliacion,
  opciones: {
    readonly snapshot?: SnapshotSeleccionLiquidacionPatagonia | null;
    readonly huella?: string | null;
    readonly parametros?: EntradaGeneracionPatagonia['parametros'];
  } = {},
): EntradaGeneracionPatagonia {
  return {
    perfil: perfilV3Golden(),
    conciliacion,
    parametros:
      opciones.parametros === undefined
        ? parametrosGoldenPatagoniaAlfanumerica()
        : opciones.parametros,
    ...(opciones.snapshot === undefined
      ? {}
      : { seleccionLiquidacionPatagonia: opciones.snapshot }),
    ...(opciones.huella === undefined ? {} : { huellaFinnegans: opciones.huella }),
  };
}

function reemplazarSeleccion(
  estado: EstadoCorrida,
  descripcionOriginal: string,
  codigoTipoLiquidacion: CodigoTipoLiquidacionPatagoniaProvisional,
): EstadoCorrida {
  const aplicado = aplicarSeleccionesLiquidacionPatagoniaCorrida(estado, [
    {
      huellaFinnegans: HUELLA,
      destino: 'PATAGONIA_B2',
      descripcionOriginal,
      codigoTipoLiquidacion,
    },
  ]);
  if (!aplicado.ok) {
    throw new Error(`selección sintética inválida: ${aplicado.error.map((e) => e.codigo).join()}`);
  }
  return aplicado.value.estado;
}

describe('evaluación técnica Patagonia con snapshot C5-A (C5-B)', () => {
  it('conciliación y snapshot de las mismas decisiones permiten APTO_TECNICAMENTE sin autorización', () => {
    const descripcion = descripcionDe(conciliacionGoldenPatagonia());
    const { conciliacion, estado } = goldenConSeleccion([
      { descripcionOriginal: descripcion, codigoTipoLiquidacion: '001' },
    ]);

    expect(conciliacion.revisionSeleccionLiquidacionPatagonia).toEqual(expect.any(String));

    const resultado = evaluarAptitudTecnicaPatagonia(
      entrada(conciliacion, {
        snapshot: snapshotDe(estado),
        huella: HUELLA,
      }),
    );

    expect(resultado.estado).toBe('APTO_TECNICAMENTE');
    if (resultado.estado === 'APTO_TECNICAMENTE') {
      expect(resultado.aptoParaContinuar).toBe(true);
      expect(resultado.autorizadoParaGenerar).toBe(false);
      expect(resultado.motivoAutorizacion).toBe('HOMOLOGACION_PATAGONIA_PENDIENTE');
      // La política derivada no reordena, no cambia referencias ni importes.
      expect(resultado.pagos).toEqual(pagosPatagoniaDesdeConciliacion(conciliacion));
      expect(resultado.pagos.map((pago) => pago.ref)).toEqual(
        conciliacion.filas.map((fila) => fila.linea.ref),
      );
      expect(resultado.pagos.map((pago) => pago.neto)).toEqual(
        conciliacion.filas.map((fila) => fila.linea.neto),
      );
    }
    expect('bytes' in resultado).toBe(false);
    expect(produccionPatagoniaHabilitada()).toBe(false);
  });

  it('sin snapshot conserva MAPEO_NO_RESUELTO por PAT-7/P-09/P-10', () => {
    const resultado = evaluarAptitudTecnicaPatagonia(entrada(conciliacionGoldenPatagonia()));

    expect(resultado.estado).toBe('MAPEO_NO_RESUELTO');
    if (resultado.estado === 'MAPEO_NO_RESUELTO') {
      expect(resultado.motivo).toBe('POLITICA_SIN_RESOLUCION');
      expect(resultado.puntos).toEqual(['PAT-7/P-09/P-10']);
    }
    expect('bytes' in resultado).toBe(false);
  });

  it('un snapshot parcial resuelve solo las filas cubiertas y bloquea las demás', () => {
    const { conciliacion, estado } = descripcionesConSeleccion(
      ['SUELDO', 'S.A.C.'],
      [{ descripcionOriginal: 'SUELDO', codigoTipoLiquidacion: '001' }],
    );
    const resultado = evaluarAptitudTecnicaPatagonia(
      entrada(conciliacion, { snapshot: snapshotDe(estado), huella: HUELLA }),
    );

    // La fila no seleccionada queda SIN_RESOLUCION ya en la conciliación, así que la
    // readiness la informa como liquidación sin mapeo antes de evaluar la política.
    expect(resultado.estado).toBe('MAPEO_NO_RESUELTO');
    if (resultado.estado === 'MAPEO_NO_RESUELTO') {
      expect(resultado.motivo).toBe('LIQUIDACION_SIN_MAPEO');
      expect(resultado.puntos).toEqual([]);
      expect(
        resultado.incidencias.every((incidencia) => incidencia.codigo === 'LIQUIDACION_SIN_MAPEO'),
      ).toBe(true);
      expect(resultado.incidencias.length).toBeGreaterThan(0);
    }
    expect('bytes' in resultado).toBe(false);
  });

  it('un snapshot inconsistente no resuelve ninguna fila', () => {
    const descripcion = descripcionDe(conciliacionGoldenPatagonia());
    const { conciliacion, estado } = goldenConSeleccion([
      { descripcionOriginal: descripcion, codigoTipoLiquidacion: '001' },
    ]);
    const snapshot = snapshotDe(estado);
    const inconsistente: SnapshotSeleccionLiquidacionPatagonia = {
      ...snapshot,
      cantidadesAfectadas: snapshot.cantidadesAfectadas.map((cantidad) => ({
        ...cantidad,
        cantidadFilasPatagonia: cantidad.cantidadFilasPatagonia + 1,
      })),
    };

    const resultado = evaluarAptitudTecnicaPatagonia(
      entrada(conciliacion, { snapshot: inconsistente, huella: HUELLA }),
    );
    expect(resultado.estado).toBe('MAPEO_NO_RESUELTO');
    if (resultado.estado === 'MAPEO_NO_RESUELTO') {
      expect(resultado.puntos).toEqual(['PAT-7/P-09/P-10']);
    }
  });

  it('una huella vigente distinta falla cerrada', () => {
    const descripcion = descripcionDe(conciliacionGoldenPatagonia());
    const { conciliacion, estado } = goldenConSeleccion([
      { descripcionOriginal: descripcion, codigoTipoLiquidacion: '002' },
    ]);
    const resultado = evaluarAptitudTecnicaPatagonia(
      entrada(conciliacion, {
        snapshot: snapshotDe(estado),
        huella: 'huella-de-otra-corrida',
      }),
    );

    expect(resultado.estado).toBe('MAPEO_NO_RESUELTO');
    if (resultado.estado === 'MAPEO_NO_RESUELTO') {
      expect(resultado.puntos).toEqual(['PAT-7/P-09/P-10']);
    }
  });

  it('una huella ausente con snapshot presente también falla cerrada', () => {
    const descripcion = descripcionDe(conciliacionGoldenPatagonia());
    const { conciliacion, estado } = goldenConSeleccion([
      { descripcionOriginal: descripcion, codigoTipoLiquidacion: '002' },
    ]);
    const resultado = evaluarAptitudTecnicaPatagonia(
      entrada(conciliacion, { snapshot: snapshotDe(estado) }),
    );

    expect(resultado.estado).toBe('MAPEO_NO_RESUELTO');
  });

  it('una referencia alterada en el snapshot no resuelve', () => {
    const { conciliacion, estado } = descripcionesConSeleccion(
      ['SUELDO', 'VARIOS'],
      [
        { descripcionOriginal: 'SUELDO', codigoTipoLiquidacion: '001' },
        { descripcionOriginal: 'VARIOS', codigoTipoLiquidacion: '002' },
      ],
    );
    const snapshot = snapshotDe(estado);
    const primeraCantidad = snapshot.cantidadesAfectadas[0];
    if (primeraCantidad === undefined) throw new Error('snapshot sin cantidades');
    const referenciaAjena = conciliacion.filas[1]?.linea.ref;
    if (referenciaAjena === undefined) throw new Error('fila sintética inexistente');
    const alterado: SnapshotSeleccionLiquidacionPatagonia = {
      ...snapshot,
      cantidadesAfectadas: [
        { ...primeraCantidad, refs: [referenciaAjena] },
        ...snapshot.cantidadesAfectadas.slice(1),
      ],
    };

    const resultado = evaluarAptitudTecnicaPatagonia(
      entrada(conciliacion, { snapshot: alterado, huella: HUELLA }),
    );
    expect(resultado.estado).toBe('MAPEO_NO_RESUELTO');
    if (resultado.estado === 'MAPEO_NO_RESUELTO') {
      expect(resultado.puntos).toEqual(['PAT-7/P-09/P-10']);
    }
  });

  it('una descripción alterada en el snapshot no resuelve', () => {
    const { conciliacion, estado } = descripcionesConSeleccion(
      ['SUELDO', 'VARIOS'],
      [
        { descripcionOriginal: 'SUELDO', codigoTipoLiquidacion: '001' },
        { descripcionOriginal: 'VARIOS', codigoTipoLiquidacion: '002' },
      ],
    );
    const snapshot = snapshotDe(estado);
    const seleccion = snapshot.seleccionesValidadas[0];
    if (seleccion === undefined) throw new Error('snapshot sin selecciones');
    const alterado: SnapshotSeleccionLiquidacionPatagonia = {
      ...snapshot,
      seleccionesValidadas: [{ ...seleccion, descripcionOriginal: 'OTRA' }],
    };

    const resultado = evaluarAptitudTecnicaPatagonia(
      entrada(conciliacion, { snapshot: alterado, huella: HUELLA }),
    );
    expect(resultado.estado).toBe('MAPEO_NO_RESUELTO');
    if (resultado.estado === 'MAPEO_NO_RESUELTO') {
      expect(resultado.puntos).toEqual(['PAT-7/P-09/P-10']);
    }
  });

  it('un concepto cambiado después de conciliar bloquea aunque huella y líneas coincidan', () => {
    const descripcion = descripcionDe(conciliacionGoldenPatagonia());
    const { conciliacion, estado } = goldenConSeleccion([
      { descripcionOriginal: descripcion, codigoTipoLiquidacion: '001' },
    ]);
    const estadoNuevo = reemplazarSeleccion(estado, descripcion, '002');

    // La evidencia que NO alcanza para detectar el cambio: misma huella y mismas líneas.
    expect(estadoNuevo.huellaFinnegans).toBe(estado.huellaFinnegans);
    expect(estadoNuevo.finnegans?.lineas.map((linea) => linea.ref)).toEqual(
      estado.finnegans?.lineas.map((linea) => linea.ref),
    );
    expect(estadoNuevo.finnegans?.lineas.map((linea) => linea.descripcion)).toEqual(
      estado.finnegans?.lineas.map((linea) => linea.descripcion),
    );

    const resolucionNueva = resolverSeleccionLiquidacionPatagonia(
      snapshotDe(estadoNuevo),
      HUELLA,
      estadoNuevo.finnegans?.lineas ?? [],
    );
    if (resolucionNueva === null) throw new Error('la selección nueva debe ser válida');
    expect(revisionSeleccionLiquidacionPatagonia(resolucionNueva)).not.toBe(
      conciliacion.revisionSeleccionLiquidacionPatagonia,
    );

    const resultado = evaluarAptitudTecnicaPatagonia(
      entrada(conciliacion, { snapshot: snapshotDe(estadoNuevo), huella: HUELLA }),
    );
    expect(resultado.estado).toBe('MAPEO_NO_RESUELTO');
    if (resultado.estado === 'MAPEO_NO_RESUELTO') {
      expect(resultado.puntos).toEqual(['PAT-7/P-09/P-10']);
    }
  });

  it('una selección retirada después de conciliar bloquea la evaluación', () => {
    const descripcion = descripcionDe(conciliacionGoldenPatagonia());
    const { conciliacion, estado } = goldenConSeleccion([
      { descripcionOriginal: descripcion, codigoTipoLiquidacion: '001' },
    ]);
    const sinSeleccion = invalidarSeleccionLiquidacionPatagoniaCorrida(estado);

    expect(sinSeleccion.seleccionLiquidacionPatagonia).toBeNull();
    expect(sinSeleccion.huellaFinnegans).toBe(estado.huellaFinnegans);

    const resultado = evaluarAptitudTecnicaPatagonia(
      entrada(conciliacion, {
        snapshot: sinSeleccion.seleccionLiquidacionPatagonia,
        huella: HUELLA,
      }),
    );
    expect(resultado.estado).toBe('MAPEO_NO_RESUELTO');
    if (resultado.estado === 'MAPEO_NO_RESUELTO') {
      expect(resultado.puntos).toEqual(['PAT-7/P-09/P-10']);
    }
  });

  it('una conciliación sin revisión de selecciones falla cerrada aunque el snapshot sea válido', () => {
    const descripcion = descripcionDe(conciliacionGoldenPatagonia());
    const { estado } = goldenConSeleccion([
      { descripcionOriginal: descripcion, codigoTipoLiquidacion: '001' },
    ]);
    // Conciliación con la política genérica de test: no conserva revisión Patagonia.
    const sinRevision = conciliacionGoldenPatagonia();
    expect(sinRevision.revisionSeleccionLiquidacionPatagonia ?? null).toBeNull();

    const resultado = evaluarAptitudTecnicaPatagonia(
      entrada(sinRevision, { snapshot: snapshotDe(estado), huella: HUELLA }),
    );
    expect(resultado.estado).toBe('MAPEO_NO_RESUELTO');
    if (resultado.estado === 'MAPEO_NO_RESUELTO') {
      expect(resultado.puntos).toEqual(['PAT-7/P-09/P-10']);
    }
  });

  it('los empleados BNA con la misma descripción no reciben códigos Patagonia', () => {
    const { conciliacion, estado } = mixtaConSeleccion([
      { descripcionOriginal: 'JULIO Agrario', codigoTipoLiquidacion: '003' },
    ]);
    const referenciaPatagonia = conciliacion.filas[0]?.linea.ref;
    const referenciaBna = conciliacion.filas[1]?.linea.ref;
    if (referenciaPatagonia === undefined || referenciaBna === undefined) {
      throw new Error('filas sintéticas insuficientes');
    }
    const snapshot = snapshotDe(estado);

    const resultado = evaluarAptitudTecnicaPatagonia(
      entrada(conciliacion, { snapshot, huella: HUELLA }),
    );
    expect(resultado.estado).toBe('APTO_TECNICAMENTE');
    if (resultado.estado === 'APTO_TECNICAMENTE') {
      expect(resultado.pagos).toHaveLength(1);
      expect(resultado.pagos[0]?.ref).toEqual(referenciaPatagonia);
      expect(resultado.pagos.some((pago) => pago.ref === referenciaBna)).toBe(false);
    }

    // La política derivada tampoco resuelve un pago BNA si se consultara con su línea.
    const lineaBna = conciliacion.filas[1]?.linea;
    if (lineaBna === undefined) throw new Error('fila BNA inexistente');
    const politica = politicaPatagoniaDesdeSeleccionPatagonia(
      snapshot,
      HUELLA,
      conciliacion.filas.map((fila) => fila.linea),
    );
    expect(
      politica.tipoLiquidacion(
        pagoSintetico(0, {
          ref: lineaBna.ref,
          descripcion: lineaBna.descripcion,
        }),
      ),
    ).toEqual({ estado: 'SIN_RESOLUCION', punto: 'PAT-7/P-09/P-10' });
  });

  it('conserva la precedencia de configuración, PAT-2 y contrato sobre el snapshot', () => {
    const descripcion = descripcionDe(conciliacionGoldenPatagonia());
    const { conciliacion, estado } = goldenConSeleccion([
      { descripcionOriginal: descripcion, codigoTipoLiquidacion: '001' },
    ]);
    const snapshot = snapshotDe(estado);

    const sinPerfil = evaluarAptitudTecnicaPatagonia({
      ...entrada(conciliacion, { snapshot, huella: HUELLA }),
      perfil: null,
    });
    expect(sinPerfil.estado).toBe('CONFIGURACION_INCOMPLETA');

    const pat2Numerica = evaluarAptitudTecnicaPatagonia(
      entrada(conciliacion, {
        snapshot,
        huella: HUELLA,
        parametros: parametrosGoldenPatagonia(),
      }),
    );
    expect(pat2Numerica.estado).toBe('HIPOTESIS_PAT2_NO_CONFIRMADA');

    const sinConciliacion = evaluarAptitudTecnicaPatagonia(
      entrada(conciliacion, { snapshot, huella: HUELLA, parametros: null }),
    );
    expect(sinConciliacion.estado).toBe('CONFIGURACION_INCOMPLETA');
  });

  it('la generación productiva sigue bloqueada y sin bytes con snapshot válido', () => {
    const descripcion = descripcionDe(conciliacionGoldenPatagonia());
    const { conciliacion, estado } = goldenConSeleccion([
      { descripcionOriginal: descripcion, codigoTipoLiquidacion: '001' },
    ]);
    const conSnapshot = entrada(conciliacion, {
      snapshot: snapshotDe(estado),
      huella: HUELLA,
    });

    const evaluacion = evaluarGeneracionPatagonia(conSnapshot);
    expect(evaluacion.estado).toBe('HOMOLOGACION_PATAGONIA_PENDIENTE');
    expect('bytes' in evaluacion).toBe(false);

    const generacion = generarPatagonia(conSnapshot);
    expect(generacion.estado).toBe('HOMOLOGACION_PATAGONIA_PENDIENTE');
    expect('bytes' in generacion).toBe(false);
  });

  it('no modifica la conciliación, las líneas ni el snapshot', () => {
    const descripcion = descripcionDe(conciliacionGoldenPatagonia());
    const { conciliacion, estado } = goldenConSeleccion([
      { descripcionOriginal: descripcion, codigoTipoLiquidacion: '001' },
    ]);
    const snapshot = snapshotDe(estado);
    const copiaConciliacion = structuredClone(conciliacion);
    const copiaSnapshot = structuredClone(snapshot);

    evaluarAptitudTecnicaPatagonia(entrada(conciliacion, { snapshot, huella: HUELLA }));

    expect(conciliacion).toEqual(copiaConciliacion);
    expect(snapshot).toEqual(copiaSnapshot);
    expect(conciliacion.filas.map((fila) => fila.linea.descripcion)).toEqual(
      copiaConciliacion.filas.map((fila) => fila.linea.descripcion),
    );
  });
});
