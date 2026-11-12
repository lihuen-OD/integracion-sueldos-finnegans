import { describe, expect, it } from 'vitest';
import {
  POLITICA_PATAGONIA_PRODUCTIVA,
  produccionPatagoniaHabilitada,
  type PagoPatagonia,
} from '../../../src/banks/patagonia-b2';
import {
  descripcionSinClasificar,
  type LecturaFinnegans,
  type PayrollLine,
} from '../../../src/domain/liquidacion';
import { parseImporte } from '../../../src/domain/money';
import { conFinnegans, nuevaCorrida, type EstadoCorrida } from '../../../src/run/corrida';
import {
  aplicarSeleccionesLiquidacionPatagoniaCorrida,
  politicaLiquidacionesDesdeSeleccionPatagonia,
  politicaPatagoniaDesdeSeleccionPatagonia,
  resolverSeleccionLiquidacionPatagonia,
  type SnapshotSeleccionLiquidacionPatagonia,
} from '../../../src/run/seleccionLiquidacionPatagonia';
import { pagoSintetico } from '../banks/patagonia-b2/auxiliares';

const HUELLA = 'huella-c5-a';
const PATAGONIA = 'BANCO PATAGONIA S.A.';
const BNA = 'BANCO DE LA NACION ARGENTINA';
const SIN_RESOLUCION = { estado: 'SIN_RESOLUCION' } as const;
const SIN_TIPO_LIQUIDACION = {
  estado: 'SIN_RESOLUCION',
  punto: 'PAT-7/P-09/P-10',
} as const;

interface SeleccionSintetica {
  readonly descripcionOriginal: string;
  readonly codigoTipoLiquidacion: string;
}

function dinero(valor: string) {
  const importe = parseImporte(valor);
  if (!importe.ok) throw new Error('importe sintético inválido');
  return importe.value;
}

function linea(
  descripcionOriginal: string,
  fila: number,
  bancoFinnegans: string | null,
): PayrollLine {
  return {
    ref: { archivo: 'FINNEGANS', hoja: 'Liquidacion sintetica', fila },
    cuilTexto: `CUIL-${String(fila)}`,
    cuil: null,
    legajo: `L-${String(fila)}`,
    apellido: `APELLIDO ${String(fila)}`,
    nombre: `NOMBRE ${String(fila)}`,
    bancoFinnegans,
    neto: dinero(`${String(fila)}.00`),
    componentes: {
      remunerativo: dinero(`${String(fila)}.00`),
      noRemunerativo: dinero('0'),
      descuento: dinero('0'),
    },
    descripcion: descripcionSinClasificar(descripcionOriginal),
    legajoApellidoNombre: `L-${String(fila)} - APELLIDO, NOMBRE`,
  };
}

function corrida(lineas: readonly PayrollLine[], huella = HUELLA): EstadoCorrida {
  const lectura: LecturaFinnegans = {
    hoja: 'Liquidacion sintetica',
    visibilidadHoja: 'visible',
    lineas,
    hallazgos: [],
  };
  return conFinnegans(nuevaCorrida(), lectura, huella);
}

function seleccion(descripcionOriginal: string, codigoTipoLiquidacion: string): SeleccionSintetica {
  return { descripcionOriginal, codigoTipoLiquidacion };
}

function aplicar(estado: EstadoCorrida, selecciones: readonly SeleccionSintetica[]): EstadoCorrida {
  const resultado = aplicarSeleccionesLiquidacionPatagoniaCorrida(
    estado,
    selecciones.map((item) => ({
      huellaFinnegans: estado.huellaFinnegans ?? HUELLA,
      descripcionOriginal: item.descripcionOriginal,
      destino: 'PATAGONIA_B2',
      codigoTipoLiquidacion: item.codigoTipoLiquidacion,
    })),
  );
  if (!resultado.ok) throw new Error('selección sintética inválida');
  return resultado.value.estado;
}

function snapshotDe(estado: EstadoCorrida): SnapshotSeleccionLiquidacionPatagonia {
  if (estado.seleccionLiquidacionPatagonia === null) throw new Error('snapshot esperado');
  return estado.seleccionLiquidacionPatagonia;
}

function lineasDe(estado: EstadoCorrida): readonly PayrollLine[] {
  if (estado.finnegans === null) throw new Error('Finnegans esperado');
  return estado.finnegans.lineas;
}

function pagoDe(lineaOriginal: PayrollLine, indice = 0): PagoPatagonia {
  return pagoSintetico(indice, {
    ref: lineaOriginal.ref,
    descripcion: lineaOriginal.descripcion,
  });
}

describe('resolverSeleccionLiquidacionPatagonia · C5-A', () => {
  it('resuelve igual en C4 y C5 con la misma referencia, descripción y destino', () => {
    const primera = linea('JULIO Agrario', 2, PATAGONIA);
    const segunda = linea('JULIO Agrario', 3, PATAGONIA);
    const estado = aplicar(corrida([primera, segunda]), [seleccion('JULIO Agrario', '002')]);
    const snapshot = snapshotDe(estado);
    const lineas = lineasDe(estado);
    const resolucion = resolverSeleccionLiquidacionPatagonia(snapshot, HUELLA, lineas);
    const c4 = politicaLiquidacionesDesdeSeleccionPatagonia(estado);
    const c5 = politicaPatagoniaDesdeSeleccionPatagonia(snapshot, HUELLA, lineas);

    expect(resolucion).not.toBeNull();
    expect(resolucion?.porRef.size).toBe(2);

    for (const cubierta of [primera, segunda]) {
      expect(c4.resolver(cubierta, 'PATAGONIA_B2')).toEqual({
        estado: 'SELECCION_EXPLICITA_VALIDADA',
      });
      expect(c5.tipoLiquidacion(pagoDe(cubierta))).toEqual({
        estado: 'RESUELTO',
        valor: '002',
      });
    }
    expect(c4.resolver(primera, 'PATAGONIA_B2').estado).not.toBe('MAPEO_APROBADO');
  });

  it('falla cerrado ante referencia, descripción, banco o huella distintos', () => {
    const original = linea('JULIO Agrario', 2, PATAGONIA);
    const estado = aplicar(corrida([original]), [seleccion('JULIO Agrario', '001')]);
    const snapshot = snapshotDe(estado);
    const lineas = lineasDe(estado);
    const c4 = politicaLiquidacionesDesdeSeleccionPatagonia(estado);
    const c5 = politicaPatagoniaDesdeSeleccionPatagonia(snapshot, HUELLA, lineas);

    const otraRef = linea('JULIO Agrario', 99, PATAGONIA);
    expect(c4.resolver(otraRef, 'PATAGONIA_B2')).toEqual(SIN_RESOLUCION);
    expect(c5.tipoLiquidacion(pagoDe(otraRef))).toEqual(SIN_TIPO_LIQUIDACION);

    const otraDescripcion = linea('julio Agrario', 2, PATAGONIA);
    expect(c4.resolver(otraDescripcion, 'PATAGONIA_B2')).toEqual(SIN_RESOLUCION);
    expect(
      c5.tipoLiquidacion(
        pagoSintetico(0, {
          ref: original.ref,
          descripcion: descripcionSinClasificar('julio Agrario'),
        }),
      ),
    ).toEqual(SIN_TIPO_LIQUIDACION);

    const bna = linea('JULIO Agrario', 3, BNA);
    expect(c4.resolver(bna, 'PATAGONIA_B2')).toEqual(SIN_RESOLUCION);
    expect(c4.resolver(bna, 'BNA_GT_HABERES')).toEqual(SIN_RESOLUCION);
    expect(c5.tipoLiquidacion(pagoDe(bna))).toEqual(SIN_TIPO_LIQUIDACION);

    expect(resolverSeleccionLiquidacionPatagonia(snapshot, 'otra-huella', lineas)).toBeNull();
    expect(
      politicaLiquidacionesDesdeSeleccionPatagonia({
        ...estado,
        huellaFinnegans: 'otra-huella',
      }).resolver(original, 'PATAGONIA_B2'),
    ).toEqual(SIN_RESOLUCION);
    expect(
      politicaPatagoniaDesdeSeleccionPatagonia(snapshot, 'otra-huella', lineas).tipoLiquidacion(
        pagoDe(original),
      ),
    ).toEqual(SIN_TIPO_LIQUIDACION);
  });

  it('un snapshot parcial válido resuelve solamente las filas cubiertas', () => {
    const sueldo = linea('SUELDO', 2, PATAGONIA);
    const sac = linea('S.A.C.', 3, PATAGONIA);
    const estado = aplicar(corrida([sueldo, sac]), [seleccion('SUELDO', '001')]);
    const snapshot = snapshotDe(estado);
    const lineas = lineasDe(estado);
    const c4 = politicaLiquidacionesDesdeSeleccionPatagonia(estado);
    const c5 = politicaPatagoniaDesdeSeleccionPatagonia(snapshot, HUELLA, lineas);

    expect(snapshot.pendientes.map((item) => item.descripcionOriginal)).toEqual(['S.A.C.']);
    expect(resolverSeleccionLiquidacionPatagonia(snapshot, HUELLA, lineas)?.porRef.size).toBe(1);
    expect(c4.resolver(sueldo, 'PATAGONIA_B2')).toEqual({
      estado: 'SELECCION_EXPLICITA_VALIDADA',
    });
    expect(c5.tipoLiquidacion(pagoDe(sueldo))).toEqual({
      estado: 'RESUELTO',
      valor: '001',
    });
    expect(c4.resolver(sac, 'PATAGONIA_B2')).toEqual(SIN_RESOLUCION);
    expect(c5.tipoLiquidacion(pagoDe(sac))).toEqual(SIN_TIPO_LIQUIDACION);
  });

  it('un snapshot inconsistente no resuelve ninguna fila', () => {
    const original = linea('JULIO Agrario', 2, PATAGONIA);
    const estado = aplicar(corrida([original]), [seleccion('JULIO Agrario', '003')]);
    const snapshot = snapshotDe(estado);
    const lineas = lineasDe(estado);
    const inconsistente: SnapshotSeleccionLiquidacionPatagonia = {
      ...snapshot,
      cantidadesAfectadas: snapshot.cantidadesAfectadas.map((cantidad) => ({
        ...cantidad,
        cantidadFilasPatagonia: cantidad.cantidadFilasPatagonia + 1,
      })),
    };

    expect(resolverSeleccionLiquidacionPatagonia(inconsistente, HUELLA, lineas)).toBeNull();
    expect(
      politicaLiquidacionesDesdeSeleccionPatagonia({
        ...estado,
        seleccionLiquidacionPatagonia: inconsistente,
      }).resolver(original, 'PATAGONIA_B2'),
    ).toEqual(SIN_RESOLUCION);
    expect(
      politicaPatagoniaDesdeSeleccionPatagonia(inconsistente, HUELLA, lineas).tipoLiquidacion(
        pagoDe(original),
      ),
    ).toEqual(SIN_TIPO_LIQUIDACION);
  });

  it('distingue espacios y mayúsculas en la descripción original', () => {
    const exacta = linea('JULIO Agrario', 2, PATAGONIA);
    const conEspacio = linea('JULIO Agrario ', 3, PATAGONIA);
    const otraMayuscula = linea('julio Agrario', 4, PATAGONIA);
    const estado = aplicar(corrida([exacta, conEspacio, otraMayuscula]), [
      seleccion('JULIO Agrario', '003'),
    ]);
    const snapshot = snapshotDe(estado);
    const lineas = lineasDe(estado);
    const c4 = politicaLiquidacionesDesdeSeleccionPatagonia(estado);
    const c5 = politicaPatagoniaDesdeSeleccionPatagonia(snapshot, HUELLA, lineas);

    expect(c4.resolver(exacta, 'PATAGONIA_B2')).toEqual({
      estado: 'SELECCION_EXPLICITA_VALIDADA',
    });
    expect(c5.tipoLiquidacion(pagoDe(exacta))).toEqual({ estado: 'RESUELTO', valor: '003' });
    for (const variante of [conEspacio, otraMayuscula]) {
      expect(c4.resolver(variante, 'PATAGONIA_B2')).toEqual(SIN_RESOLUCION);
      expect(c5.tipoLiquidacion(pagoDe(variante))).toEqual(SIN_TIPO_LIQUIDACION);
    }
  });

  it('no resuelve empleados BNA aunque compartan la descripción', () => {
    const patagonia = linea('JULIO Comercio', 2, PATAGONIA);
    const bna = linea('JULIO Comercio', 3, BNA);
    const estado = aplicar(corrida([patagonia, bna]), [seleccion('JULIO Comercio', '004')]);
    const snapshot = snapshotDe(estado);
    const lineas = lineasDe(estado);
    const c4 = politicaLiquidacionesDesdeSeleccionPatagonia(estado);
    const c5 = politicaPatagoniaDesdeSeleccionPatagonia(snapshot, HUELLA, lineas);

    expect(c4.resolver(patagonia, 'PATAGONIA_B2')).toEqual({
      estado: 'SELECCION_EXPLICITA_VALIDADA',
    });
    expect(c5.tipoLiquidacion(pagoDe(patagonia))).toEqual({
      estado: 'RESUELTO',
      valor: '004',
    });
    expect(c4.resolver(bna, 'PATAGONIA_B2')).toEqual(SIN_RESOLUCION);
    expect(c5.tipoLiquidacion(pagoDe(bna))).toEqual(SIN_TIPO_LIQUIDACION);
  });

  it('no infiere códigos desde el texto: usa solamente la selección validada', () => {
    const sueldo = linea('SUELDO', 2, PATAGONIA);
    const varios = linea('VARIOS', 3, PATAGONIA);
    const estado = aplicar(corrida([sueldo, varios]), [seleccion('SUELDO', '003')]);
    const snapshot = snapshotDe(estado);
    const lineas = lineasDe(estado);
    const c5 = politicaPatagoniaDesdeSeleccionPatagonia(snapshot, HUELLA, lineas);

    expect(c5.tipoLiquidacion(pagoDe(sueldo))).toEqual({ estado: 'RESUELTO', valor: '003' });
    expect(c5.tipoLiquidacion(pagoDe(varios))).toEqual(SIN_TIPO_LIQUIDACION);
  });

  it('no modifica las líneas originales ni el snapshot al resolver', () => {
    const original = linea('JULIO Agrario', 2, PATAGONIA);
    const estado = aplicar(corrida([original]), [seleccion('JULIO Agrario', '001')]);
    const snapshot = snapshotDe(estado);
    const lineas = lineasDe(estado);
    const copiaLinea = structuredClone(original);
    const copiaSnapshot = structuredClone(snapshot);

    resolverSeleccionLiquidacionPatagonia(snapshot, HUELLA, lineas);
    politicaLiquidacionesDesdeSeleccionPatagonia(estado).resolver(original, 'PATAGONIA_B2');
    politicaPatagoniaDesdeSeleccionPatagonia(snapshot, HUELLA, lineas).tipoLiquidacion(
      pagoDe(original),
    );

    expect(estado.finnegans?.lineas[0]).toBe(original);
    expect(original).toEqual(copiaLinea);
    expect(snapshot).toEqual(copiaSnapshot);
    expect(Object.keys(original)).not.toContain('codigoTipoLiquidacion');
  });

  it('sin snapshot o con huella interna distinta no resuelve', () => {
    const original = linea('JULIO Agrario', 2, PATAGONIA);
    const estado = aplicar(corrida([original]), [seleccion('JULIO Agrario', '001')]);
    const snapshot = snapshotDe(estado);
    const lineas = lineasDe(estado);
    const snapshotOtraHuella = { ...snapshot, huellaFinnegans: 'huella-interna-distinta' };

    expect(resolverSeleccionLiquidacionPatagonia(null, HUELLA, lineas)).toBeNull();
    expect(resolverSeleccionLiquidacionPatagonia(snapshotOtraHuella, HUELLA, lineas)).toBeNull();
    expect(
      politicaPatagoniaDesdeSeleccionPatagonia(null, HUELLA, lineas).tipoLiquidacion(
        pagoDe(original),
      ),
    ).toEqual(SIN_TIPO_LIQUIDACION);
    expect(
      politicaPatagoniaDesdeSeleccionPatagonia(snapshotOtraHuella, HUELLA, lineas).tipoLiquidacion(
        pagoDe(original),
      ),
    ).toEqual(SIN_TIPO_LIQUIDACION);
  });

  it('conserva la política productiva y la autorización productiva cerrada', () => {
    expect(POLITICA_PATAGONIA_PRODUCTIVA.tipoLiquidacion(pagoSintetico(0))).toEqual(
      SIN_TIPO_LIQUIDACION,
    );
    expect(produccionPatagoniaHabilitada()).toBe(false);
  });
});
