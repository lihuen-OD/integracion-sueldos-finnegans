import { describe, expect, it } from 'vitest';
import {
  aplicarSeleccionesIdentificadorHaberesBna,
  CATALOGO_IDENTIFICADORES_HABERES_BNA,
  identificarDescripcionesLiquidacionBna,
} from '../../../../src/banks/bna/seleccionIdentificadorHaberes';
import { POLITICA_BNA_PRODUCTIVA } from '../../../../src/banks/bna/politica';
import { produccionBnaHabilitada } from '../../../../src/banks/bna/autorizacion';
import { descripcionSinClasificar, type PayrollLine } from '../../../../src/domain/liquidacion';
import { parseImporte } from '../../../../src/domain/money';
import { pagoSintetico } from './auxiliares';

const HUELLA = 'huella-finnegans-bna-b1';
const BANCO_NACION = 'BANCO DE LA NACION ARGENTINA';
const BANCO_PATAGONIA = 'BANCO PATAGONIA S.A.';

function dinero(texto: string) {
  const resultado = parseImporte(texto);
  if (!resultado.ok) throw new Error('importe sintético inválido');
  return resultado.value;
}

function linea(
  descripcionOriginal: string,
  fila: number,
  bancoFinnegans: string | null = BANCO_NACION,
): PayrollLine {
  return {
    ref: { archivo: 'FINNEGANS', hoja: 'Liquidacion sintetica', fila },
    cuilTexto: `SINTETICO-${String(fila)}`,
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

function seleccion(
  descripcionOriginal: string,
  codigoIdentificadorHaberes = '0000',
  cambios: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    huellaFinnegans: HUELLA,
    descripcionOriginal,
    destino: 'BNA_GT_HABERES',
    codigoIdentificadorHaberes,
    ...cambios,
  };
}

describe('catálogo cerrado de identificadores de haberes BNA', () => {
  it('contiene únicamente 0000 y 0003 con descripción y consecuencia explícitas', () => {
    expect(CATALOGO_IDENTIFICADORES_HABERES_BNA).toEqual([
      {
        codigo: '0000',
        descripcion: 'HABERES ORDINARIOS',
        consecuencia: 'SE CONSIDERAN PARA EL COBRO DE CUOTAS DE PRESTAMOS',
        seleccionAutomatica: false,
      },
      {
        codigo: '0003',
        descripcion: 'HABERES EXTRAORDINARIOS',
        consecuencia: 'NO SE CONSIDERAN PARA EL COBRO DE CUOTAS DE PRESTAMOS',
        seleccionAutomatica: false,
      },
    ]);
  });

  it.each(['', '0001', '0002', '003', 'SAC'])('rechaza el código no documentado %j', (codigo) => {
    const resultado = aplicarSeleccionesIdentificadorHaberesBna(
      { huellaFinnegans: HUELLA, lineas: [linea('JULIO', 2)] },
      [seleccion('JULIO', codigo)],
    );
    expect(resultado.ok).toBe(false);
  });
});

describe('aplicarSeleccionesIdentificadorHaberesBna', () => {
  it('agrupa varios empleados BNA por la descripción exacta y conserva sus referencias', () => {
    const lineas = [
      linea('JULIO Agrario', 2),
      linea('JULIO Agrario', 3),
      linea('JULIO Agrario', 4, BANCO_PATAGONIA),
    ];
    expect(identificarDescripcionesLiquidacionBna(lineas)).toEqual([
      {
        descripcionOriginal: 'JULIO Agrario',
        cantidadFilasBna: 2,
        refs: [lineas[0]?.ref, lineas[1]?.ref],
      },
    ]);

    const resultado = aplicarSeleccionesIdentificadorHaberesBna(
      { huellaFinnegans: HUELLA, lineas },
      [seleccion('JULIO Agrario', '0000')],
    );
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) throw new Error('selección esperada');
    expect(resultado.value.cantidadesAfectadas[0]).toEqual({
      descripcionOriginal: 'JULIO Agrario',
      cantidadFilasBna: 2,
      refs: [lineas[0]?.ref, lineas[1]?.ref],
    });
    expect(resultado.value.seleccionesValidadas[0]?.codigoIdentificadorHaberes).toBe('0000');
  });

  it('acepta varias descripciones con códigos diferentes y nunca preselecciona', () => {
    const lineas = [linea('JULIO Agrario', 2), linea('SAC ESPECIAL', 3)];
    const sinSeleccion = aplicarSeleccionesIdentificadorHaberesBna(
      { huellaFinnegans: HUELLA, lineas },
      [],
    );
    expect(sinSeleccion.ok).toBe(true);
    if (!sinSeleccion.ok) throw new Error('resultado esperado');
    expect(sinSeleccion.value.seleccionesValidadas).toEqual([]);
    expect(sinSeleccion.value.pendientes.map((item) => item.descripcionOriginal)).toEqual([
      'JULIO Agrario',
      'SAC ESPECIAL',
    ]);

    const resultado = aplicarSeleccionesIdentificadorHaberesBna(
      { huellaFinnegans: HUELLA, lineas },
      [seleccion('JULIO Agrario', '0000'), seleccion('SAC ESPECIAL', '0003')],
    );
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) throw new Error('selección esperada');
    expect(
      resultado.value.seleccionesValidadas.map((item) => item.codigoIdentificadorHaberes),
    ).toEqual(['0000', '0003']);
    expect(resultado.value.pendientes).toEqual([]);
  });

  it('distingue mayúsculas, espacios y caracteres sin normalizar la descripción', () => {
    const lineas = [
      linea('JULIO Agrario', 2),
      linea('julio Agrario', 3),
      linea('JULIO Agrario ', 4),
      linea('JULIO-Agrario', 5),
    ];
    const resultado = aplicarSeleccionesIdentificadorHaberesBna(
      { huellaFinnegans: HUELLA, lineas },
      [seleccion('JULIO Agrario ', '0003')],
    );
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) throw new Error('selección esperada');
    expect(resultado.value.cantidadesAfectadas[0]?.refs).toEqual([lineas[2]?.ref]);
    expect(resultado.value.pendientes.map((item) => item.descripcionOriginal)).toEqual([
      'JULIO Agrario',
      'julio Agrario',
      'JULIO-Agrario',
    ]);
  });

  it('no infiere AGRARIO, COMERCIO, DIRECTIVOS, SAC ni LIQ FINAL', () => {
    const descripciones = ['AGRARIO', 'COMERCIO', 'DIRECTIVOS', 'SAC', 'LIQ FINAL'];
    const resultado = aplicarSeleccionesIdentificadorHaberesBna(
      { huellaFinnegans: HUELLA, lineas: descripciones.map((texto, i) => linea(texto, i + 2)) },
      [],
    );
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) throw new Error('resultado esperado');
    expect(resultado.value.seleccionesValidadas).toEqual([]);
    expect(resultado.value.pendientes.map((item) => item.descripcionOriginal)).toEqual(
      descripciones,
    );
  });

  it('excluye Patagonia y rechaza usar una descripción que solo tiene filas Patagonia', () => {
    const patagonia = linea('JULIO Compartida', 2, BANCO_PATAGONIA);
    const bna = linea('AGOSTO BNA', 3);
    const resultado = aplicarSeleccionesIdentificadorHaberesBna(
      { huellaFinnegans: HUELLA, lineas: [patagonia, bna] },
      [seleccion('JULIO Compartida')],
    );
    expect(resultado).toEqual({
      ok: false,
      error: [
        {
          codigo: 'DESCRIPCION_SIN_FILAS_BNA',
          indiceSeleccion: 0,
          descripcionOriginal: 'JULIO Compartida',
        },
      ],
    });
  });

  it('rechaza referencias BNA duplicadas y selecciones duplicadas o contradictorias', () => {
    const original = linea('JULIO', 2);
    const duplicada = { ...linea('AGOSTO', 3), ref: original.ref };
    expect(
      aplicarSeleccionesIdentificadorHaberesBna(
        { huellaFinnegans: HUELLA, lineas: [original, duplicada] },
        [],
      ),
    ).toEqual({
      ok: false,
      error: [{ codigo: 'REFERENCIA_DUPLICADA_CORRIDA', ref: original.ref }],
    });

    const resultado = aplicarSeleccionesIdentificadorHaberesBna(
      { huellaFinnegans: HUELLA, lineas: [original] },
      [seleccion('JULIO', '0000'), seleccion('JULIO', '0003')],
    );
    expect(resultado).toMatchObject({
      ok: false,
      error: [{ codigo: 'SELECCION_CONTRADICTORIA', indicesSeleccion: [0, 1] }],
    });
  });

  it('exige huella, destino BNA, tipos válidos y catálogo cerrado', () => {
    const corrida = { huellaFinnegans: HUELLA, lineas: [linea('JULIO', 2)] };
    expect(
      aplicarSeleccionesIdentificadorHaberesBna(
        { huellaFinnegans: ' ', lineas: corrida.lineas },
        [],
      ),
    ).toEqual({ ok: false, error: [{ codigo: 'HUELLA_CORRIDA_INVALIDA' }] });
    expect(aplicarSeleccionesIdentificadorHaberesBna(corrida, null)).toEqual({
      ok: false,
      error: [{ codigo: 'ENTRADA_NO_ES_LISTA' }],
    });
    expect(aplicarSeleccionesIdentificadorHaberesBna(corrida, [42])).toEqual({
      ok: false,
      error: [{ codigo: 'SELECCION_NO_ES_OBJETO', indiceSeleccion: 0 }],
    });
    expect(aplicarSeleccionesIdentificadorHaberesBna(corrida, [{}])).toEqual({
      ok: false,
      error: [
        { codigo: 'TIPO_INVALIDO', indiceSeleccion: 0, campo: 'huellaFinnegans' },
        { codigo: 'TIPO_INVALIDO', indiceSeleccion: 0, campo: 'descripcionOriginal' },
        { codigo: 'TIPO_INVALIDO', indiceSeleccion: 0, campo: 'destino' },
        { codigo: 'TIPO_INVALIDO', indiceSeleccion: 0, campo: 'codigoIdentificadorHaberes' },
      ],
    });
    expect(
      aplicarSeleccionesIdentificadorHaberesBna(corrida, [
        seleccion('JULIO', '0000', { destino: 'BANCO_INVENTADO' }),
      ]),
    ).toEqual({
      ok: false,
      error: [{ codigo: 'DESTINO_INVALIDO', indiceSeleccion: 0 }],
    });
    expect(
      aplicarSeleccionesIdentificadorHaberesBna(corrida, [
        seleccion('JULIO', '0000', { destino: 'PATAGONIA_B2' }),
      ]),
    ).toEqual({
      ok: false,
      error: [{ codigo: 'DESTINO_NO_ADMITIDO', indiceSeleccion: 0, destino: 'PATAGONIA_B2' }],
    });
    expect(
      aplicarSeleccionesIdentificadorHaberesBna(corrida, [
        seleccion('JULIO', '0000', { huellaFinnegans: 'otra-huella' }),
      ]),
    ).toEqual({
      ok: false,
      error: [{ codigo: 'SELECCION_DESVINCULADA', indiceSeleccion: 0 }],
    });
    expect(
      aplicarSeleccionesIdentificadorHaberesBna(corrida, [seleccion('AGOSTO', '0000')]),
    ).toEqual({
      ok: false,
      error: [
        {
          codigo: 'SELECCION_DESCONOCIDA',
          indiceSeleccion: 0,
          descripcionOriginal: 'AGOSTO',
        },
      ],
    });
    expect(
      aplicarSeleccionesIdentificadorHaberesBna(corrida, [
        seleccion('JULIO', '0000'),
        seleccion('JULIO', '0000'),
      ]),
    ).toMatchObject({
      ok: false,
      error: [{ codigo: 'SELECCION_DUPLICADA', indicesSeleccion: [0, 1] }],
    });
  });

  it('no modifica política productiva ni compuerta BNA', () => {
    expect(POLITICA_BNA_PRODUCTIVA.identificadorPrestamo(pagoSintetico(1))).toEqual({
      estado: 'SIN_RESOLUCION',
      punto: 'P-09/P-10',
    });
    expect(produccionBnaHabilitada()).toBe(false);
  });
});
