import { describe, expect, it } from 'vitest';
import {
  aplicarClasificacionesExplicitas,
  type ClasificacionExplicita,
} from '../../src/domain/clasificacion';
import { descripcionSinClasificar, type PayrollLine } from '../../src/domain/liquidacion';
import { parseImporte } from '../../src/domain/money';

function importe(texto: string) {
  const resultado = parseImporte(texto);
  if (!resultado.ok) throw new Error('Importe sintetico invalido');
  return resultado.value;
}

function linea(
  descripcionOriginal: string,
  fila: number,
  bancoFinnegans = 'BANCO SINTETICO',
): PayrollLine {
  const filaTexto = String(fila);
  return {
    ref: { archivo: 'FINNEGANS', hoja: 'Liquidacion', fila },
    cuilTexto: `CUIL-${filaTexto}`,
    cuil: null,
    legajo: `00${filaTexto}`,
    apellido: `Apellido ${filaTexto}`,
    nombre: `Nombre ${filaTexto}`,
    bancoFinnegans,
    neto: importe(`${filaTexto}.25`),
    componentes: {
      remunerativo: importe(`${filaTexto}.50`),
      noRemunerativo: importe('0'),
      descuento: importe('0.25'),
    },
    descripcion: descripcionSinClasificar(descripcionOriginal),
    legajoApellidoNombre: `00${filaTexto} Apellido ${filaTexto} Nombre ${filaTexto}`,
  };
}

function seleccion(
  descripcionOriginal: string,
  periodo = '2026-07',
  tipoLiquidacionNormalizado = 'HABERES',
): ClasificacionExplicita {
  return { descripcionOriginal, periodo, tipoLiquidacionNormalizado };
}

describe('aplicarClasificacionesExplicitas', () => {
  it('clasifica descripciones repetidas y cuenta las lineas afectadas', () => {
    const originales = [linea('JULIO Agrario', 1), linea('JULIO Agrario', 2), linea('Otra', 3)];
    const resultado = aplicarClasificacionesExplicitas(originales, [
      seleccion('JULIO Agrario', '2026-07', 'AGRARIO'),
    ]);

    expect(resultado).toMatchObject({
      ok: true,
      value: {
        cantidadesAfectadas: [{ descripcionOriginal: 'JULIO Agrario', cantidadLineas: 2 }],
      },
    });
    if (!resultado.ok) throw new Error('Resultado inesperado');
    expect(resultado.value.lineas.map((item) => item.descripcion.clasificacion)).toEqual([
      { estado: 'CLASIFICADA', periodo: '2026-07', tipoLiquidacionNormalizado: 'AGRARIO' },
      { estado: 'CLASIFICADA', periodo: '2026-07', tipoLiquidacionNormalizado: 'AGRARIO' },
      { estado: 'REGLA_PENDIENTE' },
    ]);
  });

  it('exige coincidencia exacta, incluidas mayusculas y espacios', () => {
    const originales = [linea('JULIO Agrario', 1), linea('JULIO Agrario ', 2)];
    const mayusculas = aplicarClasificacionesExplicitas(originales, [seleccion('julio Agrario')]);
    const espacios = aplicarClasificacionesExplicitas(originales, [seleccion('JULIO Agrario ')]);

    expect(mayusculas).toEqual({
      ok: false,
      error: [
        {
          codigo: 'SELECCION_DESCONOCIDA',
          indiceSeleccion: 0,
          descripcionOriginal: 'julio Agrario',
        },
      ],
    });
    expect(espacios.ok).toBe(true);
    if (!espacios.ok) throw new Error('Resultado inesperado');
    expect(espacios.value.lineas[0]?.descripcion.clasificacion.estado).toBe('REGLA_PENDIENTE');
    expect(espacios.value.lineas[1]?.descripcion.clasificacion.estado).toBe('CLASIFICADA');
  });

  it('permite que dos descripciones diferentes compartan categoria interna', () => {
    const resultado = aplicarClasificacionesExplicitas(
      [linea('Julio', 1), linea('Agosto', 2)],
      [seleccion('Julio', '2026-07', 'MENSUAL'), seleccion('Agosto', '2026-08', 'MENSUAL')],
    );

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) throw new Error('Resultado inesperado');
    expect(resultado.value.cantidadesAfectadas).toEqual([
      { descripcionOriginal: 'Julio', cantidadLineas: 1 },
      { descripcionOriginal: 'Agosto', cantidadLineas: 1 },
    ]);
  });

  it('rechaza campos vacios o compuestos solo por espacios', () => {
    const resultado = aplicarClasificacionesExplicitas(
      [linea('Julio', 1)],
      [seleccion('', ' ', '\t')],
    );

    expect(resultado).toEqual({
      ok: false,
      error: [
        { codigo: 'CAMPO_VACIO', indiceSeleccion: 0, campo: 'descripcionOriginal' },
        { codigo: 'CAMPO_VACIO', indiceSeleccion: 0, campo: 'periodo' },
        { codigo: 'CAMPO_VACIO', indiceSeleccion: 0, campo: 'tipoLiquidacionNormalizado' },
      ],
    });
  });

  it('distingue selecciones duplicadas de contradictorias y no devuelve parciales', () => {
    const originales = [linea('Julio', 1), linea('Agosto', 2)];
    const resultado = aplicarClasificacionesExplicitas(originales, [
      seleccion('Julio'),
      seleccion('Julio'),
      seleccion('Agosto', '2026-08', 'MENSUAL'),
      seleccion('Agosto', '2026-08', 'BONO'),
    ]);

    expect(resultado).toEqual({
      ok: false,
      error: [
        {
          codigo: 'SELECCION_DUPLICADA',
          descripcionOriginal: 'Julio',
          indicesSeleccion: [0, 1],
        },
        {
          codigo: 'SELECCION_CONTRADICTORIA',
          descripcionOriginal: 'Agosto',
          indicesSeleccion: [2, 3],
        },
      ],
    });
    expect('value' in resultado).toBe(false);
  });

  it('preserva las entradas y todos los datos ajenos a la clasificacion', () => {
    const original = linea('Julio', 7, 'BANCO ORIGINAL');
    const snapshot = {
      ...original,
      ref: { ...original.ref },
      componentes: { ...original.componentes },
      descripcion: {
        ...original.descripcion,
        clasificacion: { ...original.descripcion.clasificacion },
      },
    };
    Object.freeze(original);
    Object.freeze(original.descripcion);
    Object.freeze(original.descripcion.clasificacion);

    const resultado = aplicarClasificacionesExplicitas([original], [seleccion('Julio')]);

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) throw new Error('Resultado inesperado');
    expect(original).toEqual(snapshot);
    const clasificada = resultado.value.lineas[0];
    expect(clasificada).not.toBe(original);
    expect(clasificada).toMatchObject({
      ref: original.ref,
      cuilTexto: original.cuilTexto,
      legajo: original.legajo,
      bancoFinnegans: 'BANCO ORIGINAL',
      neto: original.neto,
      componentes: original.componentes,
      legajoApellidoNombre: original.legajoApellidoNombre,
    });
  });

  it('corrige o retira selecciones al recalcular sin estado previo', () => {
    const originales = [linea('Julio', 1)];
    const primera = aplicarClasificacionesExplicitas(originales, [
      seleccion('Julio', '2026-07', 'A'),
    ]);
    const corregida = aplicarClasificacionesExplicitas(originales, [
      seleccion('Julio', '2026-08', 'B'),
    ]);
    const retirada = aplicarClasificacionesExplicitas(originales, []);

    expect(primera.ok && primera.value.lineas[0]?.descripcion.clasificacion).toEqual({
      estado: 'CLASIFICADA',
      periodo: '2026-07',
      tipoLiquidacionNormalizado: 'A',
    });
    expect(corregida.ok && corregida.value.lineas[0]?.descripcion.clasificacion).toEqual({
      estado: 'CLASIFICADA',
      periodo: '2026-08',
      tipoLiquidacionNormalizado: 'B',
    });
    expect(retirada.ok && retirada.value.lineas[0]?.descripcion.clasificacion).toEqual({
      estado: 'REGLA_PENDIENTE',
    });
  });

  it('no aplica una seleccion a otra corrida', () => {
    const corridaA = aplicarClasificacionesExplicitas([linea('Julio', 1)], [seleccion('Julio')]);
    const corridaB = aplicarClasificacionesExplicitas([linea('Agosto', 2)], [seleccion('Julio')]);

    expect(corridaA.ok).toBe(true);
    expect(corridaB).toEqual({
      ok: false,
      error: [
        {
          codigo: 'SELECCION_DESCONOCIDA',
          indiceSeleccion: 0,
          descripcionOriginal: 'Julio',
        },
      ],
    });
  });
});
