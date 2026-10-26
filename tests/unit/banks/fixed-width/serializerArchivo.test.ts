// Pruebas de serialización de ARCHIVO (T4-7, CP-F4-C): composición determinista según la
// estructura (D-070), separadores exactos (D-071) y errores acumulables con orden
// congelado (docs/02 §Errores). Fixtures exclusivamente sintéticas.
import { describe, expect, it } from 'vitest';
import {
  serializarArchivo,
  type EntradaRegistro,
} from '../../../../src/banks/fixed-width/serializerArchivo';
import { bytesDe, textoDe } from './auxiliares';
import { CABECERA, CIERRE, DETALLE, archivoSpec, estructuraInicial, en } from './archivoSpecs';

import { validarFileSpec } from '../../../../src/banks/fixed-width';
import type { FileSpec, RecordSpec, ValoresPorCampo } from '../../../../src/banks/fixed-width';

const H_OK: ValoresPorCampo = { dato: 'saludo', numH: '07' };
const D_OK: ValoresPorCampo = { ref: 'abc123', imp: '000021', glosa: 'x' };
const C_OK: ValoresPorCampo = { resumen: 'cierre1' };

function especifica(
  estructura = estructuraInicial(),
  separadorNL: '\r\n' | '\n' = '\n',
  trailing = true,
): FileSpec {
  const base: FileSpec = archivoSpec(estructura, separadorNL);
  return { ...base, trailingSeparator: { value: trailing, status: 'CONFIRMADA' } };
}

function entrada(recordId: string, valoresPorCampo: ValoresPorCampo): EntradaRegistro {
  return { recordId, valores: valoresPorCampo };
}

describe('serializarArchivo · caso feliz', () => {
  it('compone H + 2 D + C con separador y separador final', () => {
    const resultado = serializarArchivo(especifica(), [
      entrada('H', H_OK),
      entrada('D', D_OK),
      entrada('D', D_OK),
      entrada('C', C_OK),
    ]);
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(textoDe(resultado.value)).toBe(
        'Hsaludo 07\nDabc123000021x\nDabc123000021x\nCcierre1\n',
      );
    }
  });

  it('trailingSeparator.value false omite el separador final', () => {
    const resultado = serializarArchivo(especifica(estructuraInicial(), '\n', false), [
      entrada('H', H_OK),
      entrada('D', D_OK),
      entrada('C', C_OK),
    ]);
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(textoDe(resultado.value)).toBe('Hsaludo 07\nDabc123000021x\nCcierre1');
    }
  });

  it('respeta lineSeparator \r\n', () => {
    const resultado = serializarArchivo(especifica(estructuraInicial(), '\r\n'), [
      entrada('H', H_OK),
      entrada('D', D_OK),
      entrada('C', C_OK),
    ]);
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(textoDe(resultado.value)).toBe('Hsaludo 07\r\nDabc123000021x\r\nCcierre1\r\n');
    }
  });

  it('acepta longitudes heterogéneas por registro (D-069)', () => {
    const resultado = serializarArchivo(especifica(), [
      entrada('H', H_OK),
      entrada('D', D_OK),
      entrada('D', D_OK),
      entrada('C', C_OK),
    ]);
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(
        textoDe(resultado.value)
          .split('\n')
          .slice(0, -1)
          .map((l) => l.length),
      ).toEqual([10, 14, 14, 8]);
    }
  });

  it('ContractStatus BLOQUEADA no altera la serialización técnica (D-075)', () => {
    const base = especifica();
    const bloqueada: FileSpec = {
      ...base,
      lineSeparator: { value: '\n', status: 'BLOQUEADA' },
      trailingSeparator: { value: true, status: 'BLOQUEADA' },
      records: base.records.map((registro) => ({
        ...registro,
        fields: registro.fields.map((campo) => ({ ...campo, status: 'BLOQUEADA' as const })),
      })),
    };
    const resultado = serializarArchivo(bloqueada, [
      entrada('H', H_OK),
      entrada('D', D_OK),
      entrada('C', C_OK),
    ]);
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(textoDe(resultado.value)).toBe('Hsaludo 07\nDabc123000021x\nCcierre1\n');
    }
  });
});

describe('serializarArchivo · SPEC_INVALIDA (precondición compartida)', () => {
  it('una spec técnica inválida corta TODO con un único error', () => {
    const records: RecordSpec[] = [
      CABECERA,
      // D con solapamiento de posiciones: validarFileSpec rechaza la spec completa.
      {
        ...DETALLE,
        fields: [
          ...DETALLE.fields.slice(0, 2),
          { ...en(DETALLE.fields, 2), start: 12, end: 13, declaredLength: 2 },
          en(DETALLE.fields, 3),
        ],
      },
      CIERRE,
    ];
    const spec = { ...especifica(), records };
    expect(validarFileSpec(spec).ok).toBe(false);
    const resultado = serializarArchivo(spec, [entrada('H', H_OK)]);
    expect(resultado.ok).toBe(false);
    expect(resultado.ok ? [] : resultado.error).toEqual([{ codigo: 'SPEC_INVALIDA' }]);
  });
});

describe('serializarArchivo · códigos congelados', () => {
  it('REGISTRO_INEXISTENTE_EN_ESTRUCTURA acumula todas las entradas sospechosas con línea 1-based', () => {
    const resultado = serializarArchivo(especifica(), [
      entrada('X', {}),
      entrada('H', H_OK),
      entrada('Y', {}),
    ]);
    expect(resultado.ok).toBe(false);
    expect(resultado.ok ? [] : resultado.error).toEqual([
      { codigo: 'REGISTRO_INEXISTENTE_EN_ESTRUCTURA', registroId: 'X', linea: 1 },
      { codigo: 'REGISTRO_INEXISTENTE_EN_ESTRUCTURA', registroId: 'Y', linea: 3 },
    ]);
  });

  it('ORDEN_INVALIDO con registro_binario mal ubicado informa línea y registroId', () => {
    const resultado = serializarArchivo(especifica(), [entrada('C', C_OK), entrada('H', H_OK)]);
    expect(resultado.ok).toBe(false);
    expect(resultado.ok ? [] : resultado.error).toEqual([
      { codigo: 'ORDEN_INVALIDO', registroId: 'C', linea: 1, ruta: [] },
    ]);
  });

  it('REPETICION_INCOMPLETA al cortar y quedarse sin items antes de cumplir min', () => {
    const resultado = serializarArchivo(especifica(estructuraInicial(2)), [
      entrada('H', H_OK),
      entrada('D', D_OK),
    ]);
    expect(resultado.ok).toBe(false);
    expect(resultado.ok ? [] : resultado.error).toEqual([
      { codigo: 'REPETICION_INCOMPLETA', ruta: [] },
    ]);
  });

  it('REGISTRO_FALTANTE de otra forma sin registros: entrada de cierre esperada en EOF sin línea', () => {
    const resultado = serializarArchivo(especifica(), []);
    expect(resultado.ok).toBe(false);
    expect(resultado.ok ? [] : resultado.error).toEqual([
      { codigo: 'REGISTRO_FALTANTE', registroId: 'H', ruta: [] },
    ]);
  });

  it('LINEA_DEMASIADO cuando la gramática terminó y sobran entradas', () => {
    const resultado = serializarArchivo(especifica(), [
      entrada('H', H_OK),
      entrada('D', D_OK),
      entrada('C', C_OK),
      entrada('D', D_OK),
    ]);
    expect(resultado.ok).toBe(false);
    expect(resultado.ok ? [] : resultado.error).toEqual([
      { codigo: 'LINEA_DEMASIADO', registroId: 'D', linea: 4 },
    ]);
  });
});

describe('serializarArchivo · errores de campo con ubicación de entrada', () => {
  it('acumula errores de campo de varias entradas con registroId y línea de entrada', () => {
    const resultado = serializarArchivo(especifica(), [
      entrada('H', { dato: 'demasiad', numH: 'a1' }),
      entrada('D', { ref: 'fig', imp: 'xyz123', glosa: 'y' }),
      entrada('C', C_OK),
    ]);
    expect(resultado.ok).toBe(false);
    expect(resultado.ok ? [] : resultado.error).toEqual([
      { codigo: 'LONGITUD_EXCEDIDA', registroId: 'H', campoId: 'dato', linea: 1 },
      { codigo: 'DIGITO_INVALIDO', registroId: 'H', campoId: 'numH', linea: 1 },
      { codigo: 'DIGITO_INVALIDO', registroId: 'D', campoId: 'imp', linea: 2 },
    ]);
  });

  it('cuando hay errores de campo no se devuelven bytes', () => {
    const resultado = serializarArchivo(especifica(), [
      entrada('H', { dato: '', numH: '' }),
      entrada('D', D_OK),
      entrada('C', C_OK),
    ]);
    expect(resultado.ok).toBe(false);
    expect(resultado.ok ? [] : resultado.error).toEqual([
      { codigo: 'VACIO_NO_PERMITIDO', registroId: 'H', campoId: 'numH', linea: 1 },
    ]);
  });
});

describe('serializarArchivo · determinismo', () => {
  it('dos ejecuciones con la misma entrada producen bytes idénticos', () => {
    const entradas = [entrada('H', H_OK), entrada('D', D_OK), entrada('C', C_OK)];
    const a = serializarArchivo(especifica(), entradas);
    const b = serializarArchivo(especifica(), entradas);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(bytesDe(textoDe(a.value))).toEqual(b.value);
    }
  });

  it('no comparte buffer con las entradas: mutar el valor de entrada no muta la salida', () => {
    const valoresMutables: ValoresPorCampo = { ...H_OK };
    const resultado = serializarArchivo(especifica(), [
      entrada('H', valoresMutables),
      entrada('D', D_OK),
      entrada('C', C_OK),
    ]);
    expect(resultado.ok).toBe(true);
    valoresMutables['dato'] = 'OTRO!!!';
    if (resultado.ok) {
      expect(textoDe(resultado.value)).toBe('Hsaludo 07\nDabc123000021x\nCcierre1\n');
    }
  });
});
