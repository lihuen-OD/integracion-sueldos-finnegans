import { describe, expect, it } from 'vitest';
import { descripcionSinClasificar, type PayrollLine } from '../../../../src/domain/liquidacion';
import { parseImporte } from '../../../../src/domain/money';
import { SIN_MAPEOS_APROBADOS } from '../../../../src/reconciliation/tipos';
import {
  aplicarSeleccionesLiquidacionPatagonia,
  CATALOGO_TIPOS_LIQUIDACION_PATAGONIA,
  ESTADO_DOCUMENTAL_TIPO_LIQUIDACION_PATAGONIA,
  ISSUES_PATAGONIA,
  produccionPatagoniaHabilitada,
} from '../../../../src/banks/patagonia-b2';

const HUELLA = 'huella-finnegans-corrida-a';
const BANCO_PATAGONIA = 'BANCO PATAGONIA S.A.';
const BANCO_NACION = 'BANCO DE LA NACION ARGENTINA';

function importe(texto: string) {
  const resultado = parseImporte(texto);
  if (!resultado.ok) throw new Error('Importe sintético inválido');
  return resultado.value;
}

function linea(
  descripcionOriginal: string,
  fila: number,
  bancoFinnegans: string | null = BANCO_PATAGONIA,
): PayrollLine {
  return {
    ref: { archivo: 'FINNEGANS', hoja: 'Liquidacion sintetica', fila },
    cuilTexto: `CUIL-SINTETICO-${String(fila)}`,
    cuil: null,
    legajo: `L-${String(fila)}`,
    apellido: `APELLIDO ${String(fila)}`,
    nombre: `NOMBRE ${String(fila)}`,
    bancoFinnegans,
    neto: importe(`${String(fila)}.25`),
    componentes: {
      remunerativo: importe(`${String(fila)}.50`),
      noRemunerativo: importe('0'),
      descuento: importe('0.25'),
    },
    descripcion: descripcionSinClasificar(descripcionOriginal),
    legajoApellidoNombre: `L-${String(fila)} - APELLIDO ${String(fila)}, NOMBRE ${String(fila)}`,
  };
}

function seleccion(
  descripcionOriginal: string,
  codigoTipoLiquidacion = '001',
  cambios: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    huellaFinnegans: HUELLA,
    descripcionOriginal,
    destino: 'PATAGONIA_B2',
    codigoTipoLiquidacion,
    ...cambios,
  };
}

describe('catálogo provisional de tipos de liquidación Patagonia', () => {
  it('contiene exactamente PAT-DR Anexo III y explicita su estado no confirmado', () => {
    expect(
      CATALOGO_TIPOS_LIQUIDACION_PATAGONIA.map((entrada) => [entrada.codigo, entrada.concepto]),
    ).toEqual([
      ['001', 'SUELDO'],
      ['002', 'S.A.C.'],
      ['003', 'VARIOS'],
      ['004', 'HONORARIOS'],
      ['006', 'HABERES JUBILATORIOS'],
      ['007', 'RENTA VITALICIA'],
      ['009', 'ULTIMA ACREDITACION AUTOMATICA'],
    ]);
    for (const entrada of CATALOGO_TIPOS_LIQUIDACION_PATAGONIA) {
      expect(entrada).toMatchObject({
        estadoDocumental: ESTADO_DOCUMENTAL_TIPO_LIQUIDACION_PATAGONIA,
        fuente: 'PAT-DR_ANEXO_III',
        confirmadoPorRespuestaEscrita: false,
        homologado: false,
      });
    }
    expect(
      CATALOGO_TIPOS_LIQUIDACION_PATAGONIA.filter((entrada) =>
        ['006', '007'].includes(entrada.codigo),
      ).map((entrada) => entrada.advertencia),
    ).toEqual(['PAT_XL_OMITE_006_007', 'PAT_XL_OMITE_006_007']);
  });

  it.each(['005', '000', '999', '01', 'ABC'])(
    'rechaza el código fuera de catálogo %s',
    (codigo) => {
      const resultado = aplicarSeleccionesLiquidacionPatagonia(
        { huellaFinnegans: HUELLA, lineas: [linea('JULIO', 1)] },
        [seleccion('JULIO', codigo)],
      );
      expect(resultado).toEqual({
        ok: false,
        error: [
          { codigo: 'CODIGO_FUERA_CATALOGO', indiceSeleccion: 0, codigoTipoLiquidacion: codigo },
        ],
      });
    },
  );
});

describe('aplicarSeleccionesLiquidacionPatagonia', () => {
  it('usa coincidencia exacta de descripción, incluidas mayúsculas y espacios', () => {
    const lineas = [
      linea('JULIO Agrario', 1),
      linea('julio Agrario', 2),
      linea('JULIO Agrario ', 3),
    ];
    const resultado = aplicarSeleccionesLiquidacionPatagonia({ huellaFinnegans: HUELLA, lineas }, [
      seleccion('JULIO Agrario '),
    ]);
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) throw new Error('Resultado esperado');
    expect(resultado.value.cantidadesAfectadas).toEqual([
      {
        descripcionOriginal: 'JULIO Agrario ',
        cantidadFilasPatagonia: 1,
        refs: [lineas[2]?.ref],
      },
    ]);
    expect(resultado.value.pendientes.map((item) => item.descripcionOriginal)).toEqual([
      'JULIO Agrario',
      'julio Agrario',
    ]);

    expect(
      aplicarSeleccionesLiquidacionPatagonia({ huellaFinnegans: HUELLA, lineas }, [
        seleccion('Julio Agrario'),
      ]),
    ).toEqual({
      ok: false,
      error: [
        {
          codigo: 'SELECCION_DESCONOCIDA',
          indiceSeleccion: 0,
          descripcionOriginal: 'Julio Agrario',
        },
      ],
    });
  });

  it('acepta dos descripciones con el mismo código provisional', () => {
    const resultado = aplicarSeleccionesLiquidacionPatagonia(
      { huellaFinnegans: HUELLA, lineas: [linea('JULIO Agrario', 1), linea('JULIO Comercio', 2)] },
      [seleccion('JULIO Agrario', '001'), seleccion('JULIO Comercio', '001')],
    );
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) throw new Error('Resultado esperado');
    expect(resultado.value.seleccionesValidadas.map((item) => item.codigoTipoLiquidacion)).toEqual([
      '001',
      '001',
    ]);
    expect(resultado.value.cantidadesAfectadas.map((item) => item.cantidadFilasPatagonia)).toEqual([
      1, 1,
    ]);
  });

  it('en una corrida mixta cuenta solo Patagonia y rechaza seleccionar una descripción solo BNA', () => {
    const lineas = [
      linea('JULIO Agrario', 1, BANCO_PATAGONIA),
      linea('JULIO Comercio', 2, BANCO_NACION),
    ];
    const valido = aplicarSeleccionesLiquidacionPatagonia({ huellaFinnegans: HUELLA, lineas }, [
      seleccion('JULIO Agrario'),
    ]);
    expect(valido.ok).toBe(true);
    if (!valido.ok) throw new Error('Resultado esperado');
    expect(valido.value.cantidadesAfectadas[0]?.refs).toEqual([lineas[0]?.ref]);

    expect(
      aplicarSeleccionesLiquidacionPatagonia({ huellaFinnegans: HUELLA, lineas }, [
        seleccion('JULIO Comercio'),
      ]),
    ).toEqual({
      ok: false,
      error: [
        {
          codigo: 'DESCRIPCION_SIN_FILAS_PATAGONIA',
          indiceSeleccion: 0,
          descripcionOriginal: 'JULIO Comercio',
        },
      ],
    });
  });

  it('para una descripción compartida por bancos afecta únicamente sus filas Patagonia', () => {
    const lineas = [
      linea('JULIO Compartida', 1, BANCO_NACION),
      linea('JULIO Compartida', 2, BANCO_PATAGONIA),
      linea('JULIO Compartida', 3, BANCO_NACION),
    ];
    const resultado = aplicarSeleccionesLiquidacionPatagonia({ huellaFinnegans: HUELLA, lineas }, [
      seleccion('JULIO Compartida', '003'),
    ]);
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) throw new Error('Resultado esperado');
    expect(resultado.value.cantidadesAfectadas).toEqual([
      {
        descripcionOriginal: 'JULIO Compartida',
        cantidadFilasPatagonia: 1,
        refs: [lineas[1]?.ref],
      },
    ]);
  });

  it('rechaza entradas mal formadas, otro destino y una corrida sin huella', () => {
    const corrida = { huellaFinnegans: HUELLA, lineas: [linea('JULIO', 1)] };
    expect(aplicarSeleccionesLiquidacionPatagonia(corrida, null)).toEqual({
      ok: false,
      error: [{ codigo: 'ENTRADA_NO_ES_LISTA' }],
    });
    expect(aplicarSeleccionesLiquidacionPatagonia(corrida, [null])).toEqual({
      ok: false,
      error: [{ codigo: 'SELECCION_NO_ES_OBJETO', indiceSeleccion: 0 }],
    });
    expect(
      aplicarSeleccionesLiquidacionPatagonia(corrida, [
        seleccion('JULIO', '001', { codigoTipoLiquidacion: 1 }),
      ]),
    ).toEqual({
      ok: false,
      error: [{ codigo: 'TIPO_INVALIDO', indiceSeleccion: 0, campo: 'codigoTipoLiquidacion' }],
    });
    expect(aplicarSeleccionesLiquidacionPatagonia(corrida, [seleccion(' ', '001')])).toEqual({
      ok: false,
      error: [{ codigo: 'CAMPO_VACIO', indiceSeleccion: 0, campo: 'descripcionOriginal' }],
    });
    expect(
      aplicarSeleccionesLiquidacionPatagonia(corrida, [
        seleccion('JULIO', '001', { destino: 'BNA_GT_HABERES' }),
      ]),
    ).toEqual({
      ok: false,
      error: [{ codigo: 'DESTINO_NO_ADMITIDO', indiceSeleccion: 0, destino: 'BNA_GT_HABERES' }],
    });
    expect(
      aplicarSeleccionesLiquidacionPatagonia({ huellaFinnegans: ' ', lineas: corrida.lineas }, []),
    ).toEqual({ ok: false, error: [{ codigo: 'HUELLA_CORRIDA_INVALIDA' }] });
  });

  it('rechaza selecciones duplicadas y contradictorias sin resultado parcial', () => {
    const corrida = {
      huellaFinnegans: HUELLA,
      lineas: [linea('JULIO', 1), linea('AGOSTO', 2)],
    };
    const resultado = aplicarSeleccionesLiquidacionPatagonia(corrida, [
      seleccion('JULIO', '001'),
      seleccion('JULIO', '001'),
      seleccion('AGOSTO', '001'),
      seleccion('AGOSTO', '002'),
    ]);
    expect(resultado).toEqual({
      ok: false,
      error: [
        {
          codigo: 'SELECCION_DUPLICADA',
          descripcionOriginal: 'JULIO',
          destino: 'PATAGONIA_B2',
          indicesSeleccion: [0, 1],
        },
        {
          codigo: 'SELECCION_CONTRADICTORIA',
          descripcionOriginal: 'AGOSTO',
          destino: 'PATAGONIA_B2',
          indicesSeleccion: [2, 3],
        },
      ],
    });
    expect('value' in resultado).toBe(false);
  });

  it('rechaza descripciones desconocidas, destinos inválidos y selecciones desvinculadas', () => {
    const corrida = { huellaFinnegans: HUELLA, lineas: [linea('JULIO', 1)] };
    expect(aplicarSeleccionesLiquidacionPatagonia(corrida, [seleccion('AGOSTO')])).toMatchObject({
      ok: false,
      error: [{ codigo: 'SELECCION_DESCONOCIDA' }],
    });
    expect(
      aplicarSeleccionesLiquidacionPatagonia(corrida, [
        seleccion('JULIO', '001', { destino: 'OTRO' }),
      ]),
    ).toEqual({
      ok: false,
      error: [{ codigo: 'DESTINO_INVALIDO', indiceSeleccion: 0 }],
    });
    expect(
      aplicarSeleccionesLiquidacionPatagonia(corrida, [
        seleccion('JULIO', '001', { huellaFinnegans: 'huella-otra-corrida' }),
      ]),
    ).toEqual({
      ok: false,
      error: [{ codigo: 'SELECCION_DESVINCULADA', indiceSeleccion: 0 }],
    });
  });

  it('deja explícitamente pendientes las descripciones no seleccionadas', () => {
    const lineas = [linea('JULIO', 1), linea('JULIO', 2), linea('AGOSTO', 3)];
    const resultado = aplicarSeleccionesLiquidacionPatagonia({ huellaFinnegans: HUELLA, lineas }, [
      seleccion('JULIO'),
    ]);
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) throw new Error('Resultado esperado');
    expect(resultado.value.pendientes).toEqual([
      {
        descripcionOriginal: 'AGOSTO',
        cantidadFilasPatagonia: 1,
        refs: [lineas[2]?.ref],
      },
    ]);
  });

  it('permite corregir y retirar recalculando desde las mismas entradas originales', () => {
    const lineas = [linea('JULIO', 1)];
    const corrida = { huellaFinnegans: HUELLA, lineas };
    const inicial = aplicarSeleccionesLiquidacionPatagonia(corrida, [seleccion('JULIO', '001')]);
    const corregida = aplicarSeleccionesLiquidacionPatagonia(corrida, [seleccion('JULIO', '002')]);
    const retirada = aplicarSeleccionesLiquidacionPatagonia(corrida, []);
    expect(inicial.ok && inicial.value.seleccionesValidadas[0]?.codigoTipoLiquidacion).toBe('001');
    expect(corregida.ok && corregida.value.seleccionesValidadas[0]?.codigoTipoLiquidacion).toBe(
      '002',
    );
    expect(retirada.ok).toBe(true);
    if (!retirada.ok) throw new Error('Resultado esperado');
    expect(retirada.value.seleccionesValidadas).toEqual([]);
    expect(retirada.value.pendientes).toEqual([
      { descripcionOriginal: 'JULIO', cantidadFilasPatagonia: 1, refs: [lineas[0]?.ref] },
    ]);
  });

  it('preserva profundamente líneas, importes, referencias, banco, clasificación y orden', () => {
    const lineas = [linea('JULIO', 1), linea('AGOSTO', 2)];
    const corrida = { huellaFinnegans: HUELLA, lineas };
    const antes = structuredClone(corrida);
    const resultado = aplicarSeleccionesLiquidacionPatagonia(corrida, [seleccion('AGOSTO', '009')]);
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) throw new Error('Resultado esperado');
    expect(corrida).toEqual(antes);
    expect(resultado.value.lineas).toBe(lineas);
    expect(resultado.value.lineas).toEqual(antes.lineas);
    expect(resultado.value.lineas.map((item) => item.ref.fila)).toEqual([1, 2]);
  });

  it('no infiere códigos desde la clasificación interna ni desde su texto', () => {
    const agrario: PayrollLine = {
      ...linea('JULIO Agrario', 1),
      descripcion: {
        descripcionOriginal: 'JULIO Agrario',
        clasificacion: {
          estado: 'CLASIFICADA',
          periodo: '2026-07',
          tipoLiquidacionNormalizado: 'AGRARIO',
        },
      },
    };
    const resultado = aplicarSeleccionesLiquidacionPatagonia(
      { huellaFinnegans: HUELLA, lineas: [agrario] },
      [],
    );
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) throw new Error('Resultado esperado');
    expect(resultado.value.seleccionesValidadas).toEqual([]);
    expect(resultado.value.pendientes[0]?.descripcionOriginal).toBe('JULIO Agrario');
  });

  it('no altera los bloqueos de conciliación, PAT-7 ni la compuerta productiva', () => {
    const item = linea('JULIO', 1);
    expect(SIN_MAPEOS_APROBADOS.tieneMapeoAprobado(item.descripcion, 'PATAGONIA_B2')).toBe(false);
    expect(ISSUES_PATAGONIA['PAT-7'].estado).toBe('INTERPRETACION_PENDIENTE');
    expect(produccionPatagoniaHabilitada()).toBe(false);
  });
});
