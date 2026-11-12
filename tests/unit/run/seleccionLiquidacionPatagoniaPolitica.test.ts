import { describe, expect, it } from 'vitest';
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
} from '../../../src/run/seleccionLiquidacionPatagonia';

const HUELLA = 'huella-politica-c4-a2';
const PATAGONIA = 'BANCO PATAGONIA S.A.';
const BNA = 'BANCO DE LA NACION ARGENTINA';

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
  descripcionOriginal: string,
  codigoTipoLiquidacion = '001',
) {
  const resultado = aplicarSeleccionesLiquidacionPatagoniaCorrida(estado, [
    {
      huellaFinnegans: HUELLA,
      descripcionOriginal,
      destino: 'PATAGONIA_B2',
      codigoTipoLiquidacion,
    },
  ]);
  if (!resultado.ok) throw new Error('selección sintética inválida');
  return resultado.value.estado;
}

describe('politicaLiquidacionesDesdeSeleccionPatagonia · cobertura C4-A2', () => {
  it('resuelve solo Patagonia con descripción exacta y SourceRef cubierta', () => {
    const cubierta = linea('JULIO Agrario', 2, PATAGONIA);
    const mismoTextoBna = linea('JULIO Agrario', 3, BNA);
    const otraMayuscula = linea('julio Agrario', 4, PATAGONIA);
    const otroEspacio = linea('JULIO Agrario ', 5, PATAGONIA);
    const estado = aplicar(
      corrida([cubierta, mismoTextoBna, otraMayuscula, otroEspacio]),
      'JULIO Agrario',
    );
    const politica = politicaLiquidacionesDesdeSeleccionPatagonia(estado);

    expect(politica.resolver(cubierta, 'PATAGONIA_B2')).toEqual({
      estado: 'SELECCION_EXPLICITA_VALIDADA',
    });
    expect(politica.resolver(mismoTextoBna, 'BNA_GT_HABERES')).toEqual({
      estado: 'SIN_RESOLUCION',
    });
    expect(politica.resolver(otraMayuscula, 'PATAGONIA_B2')).toEqual({
      estado: 'SIN_RESOLUCION',
    });
    expect(politica.resolver(otroEspacio, 'PATAGONIA_B2')).toEqual({
      estado: 'SIN_RESOLUCION',
    });
    expect(
      politica.resolver({ ...cubierta, ref: { ...cubierta.ref, fila: 99 } }, 'PATAGONIA_B2'),
    ).toEqual({ estado: 'SIN_RESOLUCION' });
  });

  it('no cubre una fila originalmente sin banco aunque luego se destine a Patagonia', () => {
    const cubierta = linea('JULIO Comercio', 2, PATAGONIA);
    const bancoVacio = linea('JULIO Comercio', 3, '');
    const politica = politicaLiquidacionesDesdeSeleccionPatagonia(
      aplicar(corrida([cubierta, bancoVacio]), 'JULIO Comercio'),
    );
    expect(politica.resolver(bancoVacio, 'PATAGONIA_B2')).toEqual({
      estado: 'SIN_RESOLUCION',
    });
  });

  it('falla cerrado sin snapshot, con huella distinta o ante cualquier incoherencia', () => {
    const cubierta = linea('JULIO Directivos', 2, PATAGONIA);
    const base = corrida([cubierta]);
    expect(
      politicaLiquidacionesDesdeSeleccionPatagonia(base).resolver(cubierta, 'PATAGONIA_B2'),
    ).toEqual({
      estado: 'SIN_RESOLUCION',
    });

    const aplicada = aplicar(base, 'JULIO Directivos');
    const otraHuella = { ...aplicada, huellaFinnegans: 'otra-huella' };
    expect(
      politicaLiquidacionesDesdeSeleccionPatagonia(otraHuella).resolver(cubierta, 'PATAGONIA_B2'),
    ).toEqual({ estado: 'SIN_RESOLUCION' });

    const snapshot = aplicada.seleccionLiquidacionPatagonia;
    if (snapshot === null) throw new Error('snapshot esperado');
    const inconsistente = {
      ...aplicada,
      seleccionLiquidacionPatagonia: {
        ...snapshot,
        cantidadesAfectadas: snapshot.cantidadesAfectadas.map((cantidad) => ({
          ...cantidad,
          cantidadFilasPatagonia: cantidad.cantidadFilasPatagonia + 1,
        })),
      },
    };
    expect(
      politicaLiquidacionesDesdeSeleccionPatagonia(inconsistente).resolver(
        cubierta,
        'PATAGONIA_B2',
      ),
    ).toEqual({ estado: 'SIN_RESOLUCION' });
  });

  it('recalcula correcciones y retiros sin inferir códigos desde el texto', () => {
    const original = linea('AGRARIO COMERCIO DIRECTIVOS LIQ FINAL', 2, PATAGONIA);
    const base = corrida([original]);
    const sueldo = aplicar(base, original.descripcion.descripcionOriginal, '001');
    const sac = aplicar(base, original.descripcion.descripcionOriginal, '002');
    expect(
      politicaLiquidacionesDesdeSeleccionPatagonia(sueldo).resolver(original, 'PATAGONIA_B2'),
    ).toEqual({ estado: 'SELECCION_EXPLICITA_VALIDADA' });
    expect(
      politicaLiquidacionesDesdeSeleccionPatagonia(sac).resolver(original, 'PATAGONIA_B2'),
    ).toEqual({ estado: 'SELECCION_EXPLICITA_VALIDADA' });

    const retirada = aplicarSeleccionesLiquidacionPatagoniaCorrida(sac, []);
    if (!retirada.ok) throw new Error('retiro esperado');
    expect(
      politicaLiquidacionesDesdeSeleccionPatagonia(retirada.value.estado).resolver(
        original,
        'PATAGONIA_B2',
      ),
    ).toEqual({ estado: 'SIN_RESOLUCION' });
    expect(original).toBe(base.finnegans?.lineas[0]);
  });
});
