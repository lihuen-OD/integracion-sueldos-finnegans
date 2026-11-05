import { describe, expect, it } from 'vitest';
import {
  descripcionSinClasificar,
  type LecturaFinnegans,
  type PayrollLine,
} from '../../../src/domain/liquidacion';
import { parseImporte } from '../../../src/domain/money';
import { conFinnegans, nuevaCorrida, type EstadoCorrida } from '../../../src/run/corrida';
import {
  aplicarSeleccionesIdentificadorHaberesBnaCorrida,
  politicaBnaDesdeResolucionIdentificadorHaberesBna,
  politicaLiquidacionesDesdeSeleccionBna,
  resolverSeleccionIdentificadorHaberesBna,
  revisionSeleccionIdentificadorHaberesBna,
  type SnapshotSeleccionIdentificadorHaberesBna,
} from '../../../src/run/seleccionIdentificadorHaberesBna';
import { pagoSintetico } from '../banks/bna/auxiliares';

const HUELLA = 'huella-bna-b2';
const BNA = 'BANCO DE LA NACION ARGENTINA';

function dinero(texto: string) {
  const resultado = parseImporte(texto);
  if (!resultado.ok) throw new Error('importe sintético inválido');
  return resultado.value;
}

function linea(descripcionOriginal: string, fila: number): PayrollLine {
  return {
    ref: { archivo: 'FINNEGANS', hoja: 'Liquidacion sintetica', fila },
    cuilTexto: `SINTETICO-${String(fila)}`,
    cuil: null,
    legajo: `L-${String(fila)}`,
    apellido: 'APELLIDO',
    nombre: 'NOMBRE',
    bancoFinnegans: BNA,
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

function corrida(lineas: readonly PayrollLine[]): EstadoCorrida {
  const lectura: LecturaFinnegans = {
    hoja: 'Liquidacion sintetica',
    visibilidadHoja: 'visible',
    lineas,
    hallazgos: [],
  };
  return conFinnegans(nuevaCorrida(), lectura, HUELLA);
}

function aplicar(
  estado: EstadoCorrida,
  selecciones: readonly {
    readonly descripcionOriginal: string;
    readonly codigoIdentificadorHaberes: '0000' | '0003';
  }[],
): EstadoCorrida {
  const resultado = aplicarSeleccionesIdentificadorHaberesBnaCorrida(
    estado,
    selecciones.map((seleccion) => ({
      huellaFinnegans: HUELLA,
      destino: 'BNA_GT_HABERES',
      ...seleccion,
    })),
  );
  if (!resultado.ok) throw new Error('selección sintética inválida');
  return resultado.value.estado;
}

function snapshotDe(estado: EstadoCorrida): SnapshotSeleccionIdentificadorHaberesBna {
  const snapshot = estado.seleccionIdentificadorHaberesBna;
  if (snapshot === null) throw new Error('snapshot esperado');
  return snapshot;
}

function resolucionDe(estado: EstadoCorrida) {
  const lineas = estado.finnegans?.lineas ?? [];
  return resolverSeleccionIdentificadorHaberesBna(
    estado.seleccionIdentificadorHaberesBna,
    estado.huellaFinnegans ?? '',
    lineas,
  );
}

describe('BNA-B2 · políticas derivadas de la selección B1', () => {
  it('resuelve dos empleados de una misma descripción con el mismo código', () => {
    const primera = linea('JULIO Agrario', 2);
    const segunda = linea('JULIO Agrario', 3);
    const estado = aplicar(corrida([primera, segunda]), [
      { descripcionOriginal: 'JULIO Agrario', codigoIdentificadorHaberes: '0000' },
    ]);
    const resolucion = resolucionDe(estado);
    if (resolucion === null) throw new Error('resolución esperada');
    const conciliacion = politicaLiquidacionesDesdeSeleccionBna(estado);
    const bancaria = politicaBnaDesdeResolucionIdentificadorHaberesBna(resolucion);

    for (const cubierta of [primera, segunda]) {
      expect(conciliacion.resolver(cubierta, 'BNA_GT_HABERES')).toEqual({
        estado: 'SELECCION_EXPLICITA_VALIDADA',
      });
      expect(
        bancaria.identificadorPrestamo(
          pagoSintetico(0, {
            ref: cubierta.ref,
            descripcion: cubierta.descripcion,
          }),
        ),
      ).toEqual({ estado: 'RESUELTO', valor: '0000' });
    }
    expect(conciliacion.revisionSeleccionIdentificadorHaberesBna).toBe(
      revisionSeleccionIdentificadorHaberesBna(resolucion),
    );
  });

  it('mantiene códigos diferentes para descripciones exactas distintas', () => {
    const ordinaria = linea('JULIO', 2);
    const extraordinaria = linea('SAC ESPECIAL', 3);
    const estado = aplicar(corrida([ordinaria, extraordinaria]), [
      { descripcionOriginal: 'JULIO', codigoIdentificadorHaberes: '0000' },
      { descripcionOriginal: 'SAC ESPECIAL', codigoIdentificadorHaberes: '0003' },
    ]);
    const resolucion = resolucionDe(estado);
    if (resolucion === null) throw new Error('resolución esperada');
    const politica = politicaBnaDesdeResolucionIdentificadorHaberesBna(resolucion);

    expect(
      politica.identificadorPrestamo(
        pagoSintetico(1, { ref: ordinaria.ref, descripcion: ordinaria.descripcion }),
      ),
    ).toEqual({ estado: 'RESUELTO', valor: '0000' });
    expect(
      politica.identificadorPrestamo(
        pagoSintetico(2, { ref: extraordinaria.ref, descripcion: extraordinaria.descripcion }),
      ),
    ).toEqual({ estado: 'RESUELTO', valor: '0003' });
  });

  it('rechaza por completo ausencia y selección parcial', () => {
    const sueldo = linea('SUELDO', 2);
    const sac = linea('SAC', 3);
    const sinSeleccion = corrida([sueldo, sac]);
    const parcial = aplicar(sinSeleccion, [
      { descripcionOriginal: 'SUELDO', codigoIdentificadorHaberes: '0000' },
    ]);

    for (const estado of [sinSeleccion, parcial]) {
      const politica = politicaLiquidacionesDesdeSeleccionBna(estado);
      expect(politica.revisionSeleccionIdentificadorHaberesBna).toBeUndefined();
      expect(politica.resolver(sueldo, 'BNA_GT_HABERES')).toEqual({
        estado: 'SIN_RESOLUCION',
      });
      expect(politica.resolver(sac, 'BNA_GT_HABERES')).toEqual({ estado: 'SIN_RESOLUCION' });
    }
    const resolucionParcial = resolucionDe(parcial);
    expect(resolucionParcial?.pendientes).toHaveLength(1);
    expect(
      politicaBnaDesdeResolucionIdentificadorHaberesBna(resolucionParcial).identificadorPrestamo(
        pagoSintetico(1, { ref: sueldo.ref, descripcion: sueldo.descripcion }),
      ),
    ).toEqual({ estado: 'SIN_RESOLUCION', punto: 'P-09/P-10' });
  });

  it('un snapshot manipulado o una descripción distinta falla cerrado', () => {
    const original = linea('JULIO', 2);
    const estado = aplicar(corrida([original]), [
      { descripcionOriginal: 'JULIO', codigoIdentificadorHaberes: '0000' },
    ]);
    const snapshot = snapshotDe(estado);
    const manipulado: SnapshotSeleccionIdentificadorHaberesBna = {
      ...snapshot,
      cantidadesAfectadas: snapshot.cantidadesAfectadas.map((cantidad) => ({
        ...cantidad,
        cantidadFilasBna: cantidad.cantidadFilasBna + 1,
      })),
    };
    const conSnapshotManipulado = { ...estado, seleccionIdentificadorHaberesBna: manipulado };
    expect(
      politicaLiquidacionesDesdeSeleccionBna(conSnapshotManipulado).resolver(
        original,
        'BNA_GT_HABERES',
      ),
    ).toEqual({ estado: 'SIN_RESOLUCION' });
    const resolucion = resolucionDe(estado);
    if (resolucion === null) throw new Error('resolución esperada');
    expect(
      politicaBnaDesdeResolucionIdentificadorHaberesBna(resolucion).identificadorPrestamo(
        pagoSintetico(1, {
          ref: original.ref,
          descripcion: descripcionSinClasificar('julio'),
        }),
      ),
    ).toEqual({ estado: 'SIN_RESOLUCION', punto: 'P-09/P-10' });
  });
});
