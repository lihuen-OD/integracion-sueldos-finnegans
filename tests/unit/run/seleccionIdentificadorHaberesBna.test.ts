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
  invalidarSeleccionIdentificadorHaberesBnaCorrida,
  resolverSeleccionIdentificadorHaberesBna,
  revisionSeleccionIdentificadorHaberesBna,
  seleccionarIdentificadoresHaberesBnaCorrida,
  type SnapshotSeleccionIdentificadorHaberesBna,
} from '../../../src/run/seleccionIdentificadorHaberesBna';

const HUELLA = 'huella-bna-b1-corrida';
const BNA = 'BANCO DE LA NACION ARGENTINA';
const PATAGONIA = 'BANCO PATAGONIA S.A.';

function dinero(texto: string) {
  const resultado = parseImporte(texto);
  if (!resultado.ok) throw new Error('importe sintético inválido');
  return resultado.value;
}

function linea(descripcionOriginal: string, fila: number, bancoFinnegans = BNA): PayrollLine {
  return {
    ref: { archivo: 'FINNEGANS', hoja: 'Liquidacion sintetica', fila },
    cuilTexto: `SINTETICO-${String(fila)}`,
    cuil: null,
    legajo: `L-${String(fila)}`,
    apellido: 'APELLIDO',
    nombre: 'NOMBRE',
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

function aplicar(estado: EstadoCorrida, descripcionOriginal: string, codigo = '0000') {
  const resultado = aplicarSeleccionesIdentificadorHaberesBnaCorrida(estado, [
    {
      huellaFinnegans: estado.huellaFinnegans,
      descripcionOriginal,
      destino: 'BNA_GT_HABERES',
      codigoIdentificadorHaberes: codigo,
    },
  ]);
  if (!resultado.ok) throw new Error('selección sintética inválida');
  return resultado.value.estado;
}

function snapshotDe(estado: EstadoCorrida): SnapshotSeleccionIdentificadorHaberesBna {
  const snapshot = estado.seleccionIdentificadorHaberesBna;
  if (snapshot === null) throw new Error('snapshot esperado');
  return snapshot;
}

function lineasDe(estado: EstadoCorrida): readonly PayrollLine[] {
  if (estado.finnegans === null) throw new Error('Finnegans esperado');
  return estado.finnegans.lineas;
}

describe('snapshot BNA B1 ligado a la corrida', () => {
  it('registra todas las referencias BNA de una descripción y deja las demás pendientes', () => {
    const primera = linea('JULIO', 2);
    const segunda = linea('JULIO', 3);
    const pendiente = linea('AGOSTO', 4);
    const patagonia = linea('JULIO', 5, PATAGONIA);
    const estado = aplicar(corrida([primera, segunda, pendiente, patagonia]), 'JULIO');
    const snapshot = snapshotDe(estado);
    const resolucion = resolverSeleccionIdentificadorHaberesBna(snapshot, HUELLA, lineasDe(estado));

    expect(snapshot.cantidadesAfectadas[0]?.refs).toEqual([primera.ref, segunda.ref]);
    expect(snapshot.pendientes).toEqual([
      { descripcionOriginal: 'AGOSTO', cantidadFilasBna: 1, refs: [pendiente.ref] },
    ]);
    expect(resolucion?.porRef.size).toBe(2);
    expect(resolucion?.porRef.get('FINNEGANS:Liquidacion sintetica:2:')).toMatchObject({
      descripcionOriginal: 'JULIO',
      destino: 'BNA_GT_HABERES',
      codigoIdentificadorHaberes: '0000',
    });
  });

  it('una nueva importación invalida el snapshot incluso con la misma huella', () => {
    const original = linea('JULIO', 2);
    const estado = aplicar(corrida([original]), 'JULIO');
    const lectura = estado.finnegans;
    if (lectura === null) throw new Error('Finnegans esperado');
    const reimportado = conFinnegans(estado, lectura, HUELLA);
    expect(estado.seleccionIdentificadorHaberesBna).not.toBeNull();
    expect(reimportado.seleccionIdentificadorHaberesBna).toBeNull();
  });

  it('modificar el borrador invalida y reaplicar reemplaza por completo la decisión', () => {
    const base = corrida([linea('JULIO', 2)]);
    const ordinario = aplicar(base, 'JULIO', '0000');
    const invalidado = invalidarSeleccionIdentificadorHaberesBnaCorrida(ordinario);
    expect(invalidado.seleccionIdentificadorHaberesBna).toBeNull();
    expect(ordinario.seleccionIdentificadorHaberesBna).not.toBeNull();

    const extraordinario = aplicar(invalidado, 'JULIO', '0003');
    expect(
      extraordinario.seleccionIdentificadorHaberesBna?.seleccionesValidadas[0]
        ?.codigoIdentificadorHaberes,
    ).toBe('0003');
  });

  it('falla cerrado ante huella, referencia inesperada, duplicada o descripción incoherente', () => {
    const original = linea('JULIO', 2);
    const estado = aplicar(corrida([original]), 'JULIO');
    const snapshot = snapshotDe(estado);
    const lineas = lineasDe(estado);

    expect(resolverSeleccionIdentificadorHaberesBna(snapshot, 'otra-huella', lineas)).toBeNull();
    expect(
      resolverSeleccionIdentificadorHaberesBna(snapshot, HUELLA, [
        { ...original, ref: { ...original.ref, fila: 99 } },
      ]),
    ).toBeNull();
    expect(
      resolverSeleccionIdentificadorHaberesBna(snapshot, HUELLA, [original, { ...original }]),
    ).toBeNull();
    expect(
      resolverSeleccionIdentificadorHaberesBna(snapshot, HUELLA, [
        { ...original, descripcion: descripcionSinClasificar('julio') },
      ]),
    ).toBeNull();
  });

  it('rechaza un snapshot incompleto o inconsistente sin producir resolución parcial', () => {
    const original = linea('JULIO', 2);
    const estado = aplicar(corrida([original]), 'JULIO');
    const snapshot = snapshotDe(estado);
    const inconsistente: SnapshotSeleccionIdentificadorHaberesBna = {
      ...snapshot,
      cantidadesAfectadas: snapshot.cantidadesAfectadas.map((cantidad) => ({
        ...cantidad,
        cantidadFilasBna: cantidad.cantidadFilasBna + 1,
      })),
    };
    const incompleto: SnapshotSeleccionIdentificadorHaberesBna = {
      ...snapshot,
      cantidadesAfectadas: [],
    };
    expect(resolverSeleccionIdentificadorHaberesBna(inconsistente, HUELLA, [original])).toBeNull();
    expect(resolverSeleccionIdentificadorHaberesBna(incompleto, HUELLA, [original])).toBeNull();
  });

  it('prepara una revisión determinista que cambia con huella, código o cobertura', () => {
    const base = corrida([linea('JULIO', 2), linea('JULIO', 3)]);
    const ordinario = aplicar(base, 'JULIO', '0000');
    const extraordinario = aplicar(base, 'JULIO', '0003');
    const resolucionOrdinaria = resolverSeleccionIdentificadorHaberesBna(
      snapshotDe(ordinario),
      HUELLA,
      lineasDe(ordinario),
    );
    const resolucionExtraordinaria = resolverSeleccionIdentificadorHaberesBna(
      snapshotDe(extraordinario),
      HUELLA,
      lineasDe(extraordinario),
    );
    if (resolucionOrdinaria === null || resolucionExtraordinaria === null) {
      throw new Error('resoluciones esperadas');
    }
    const primera = revisionSeleccionIdentificadorHaberesBna(resolucionOrdinaria);
    expect(revisionSeleccionIdentificadorHaberesBna(resolucionOrdinaria)).toBe(primera);
    expect(revisionSeleccionIdentificadorHaberesBna(resolucionExtraordinaria)).not.toBe(primera);
    expect(primera).toMatch(/^[0-9a-f]{16}$/);
  });

  it('sin selección aplicada solo prepara pendientes y no crea snapshot', () => {
    const estado = corrida([linea('JULIO', 2)]);
    const preparacion = seleccionarIdentificadoresHaberesBnaCorrida(estado, []);
    expect(preparacion.ok).toBe(true);
    if (!preparacion.ok) throw new Error('preparación esperada');
    expect(preparacion.value.pendientes).toHaveLength(1);
    expect(estado.seleccionIdentificadorHaberesBna).toBeNull();
  });
});
