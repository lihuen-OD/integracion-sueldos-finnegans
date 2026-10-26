// Pruebas del inspector de archivo (T4-9, CP-F4-C): wrapper del parser que observa la
// estructura sin interpretar semántica bancaria ni inducir round-trips. Los archivos se
// construyen a MANO (independencia del serializer), salvo el test de round-trip explícito.
import { describe, expect, it } from 'vitest';
import { inspeccionarArchivo } from '../../../../src/banks/fixed-width/inspector';
import type { FileSpec, ValoresPorCampo } from '../../../../src/banks/fixed-width';
import { serializarArchivo, validarFileSpec } from '../../../../src/banks/fixed-width';
import { bytesDe, textoDe } from './auxiliares';
import { en, valorDe } from './archivoSpecs';
import { CABECERA, CIERRE, DETALLE, archivoSpec, estructuraInicial } from './archivoSpecs';

const H_OK: ValoresPorCampo = { dato: 'saludo', numH: '07' };
const D_OK: ValoresPorCampo = { ref: 'abc123', imp: '000021', glosa: 'x' };
const C_OK: ValoresPorCampo = { resumen: 'cierre1' };

function espec(
  estructura = estructuraInicial(),
  separadorNL: '\r\n' | '\n' = '\n',
  trailing = true,
): FileSpec {
  const base: FileSpec = archivoSpec(estructura, separadorNL);
  return { ...base, trailingSeparator: { value: trailing, status: 'CONFIRMADA' } };
}

const LINEA_H = 'Hsaludo 07';
const LINEA_D = 'Dabc123000021x';
const LINEA_C = 'Ccierre1';

describe('inspeccionarArchivo · caso feliz', () => {
  it('observa todos los registros RAW con línea, offset y ruta sin interpretar semántica', () => {
    const bytes = bytesDe([LINEA_H, LINEA_D, LINEA_C].map((l) => `${l}\n`).join(''));
    const resultado = inspeccionarArchivo(espec(), bytes);
    expect(resultado.ok).toBe(true);
    const registros = valorDe(resultado).registros;
    expect(registros.map((r) => r.registroId)).toEqual(['H', 'D', 'C']);
    expect(textoDe(en(en(registros, 0).campos, 1).bytes)).toBe('saludo ');
    expect(en(registros, 1).offset).toBe(LINEA_H.length + 1);
    expect(registros.map((r) => r.rutaRepeticiones)).toEqual([[], [1], []]);
  });

  it('contenido mutado dentro de un campo variable sigue inspeccionando OK (R-T3 honesta)', () => {
    const mutado = bytesDe([LINEA_H, 'Dabc123000022x', LINEA_C].map((l) => `${l}\n`).join(''));
    const resultado = inspeccionarArchivo(espec(), mutado);
    expect(resultado.ok).toBe(true);
    expect(textoDe(en(en(valorDe(resultado).registros, 1).campos, 2).bytes)).toBe('000022');
  });
});

describe('inspeccionarArchivo · precondición SPEC_INVALIDA', () => {
  it('spec técnicamente inválida corta sin procesar bytes', () => {
    const detalle = {
      ...DETALLE,
      fields: [
        ...DETALLE.fields.slice(0, 2),
        { ...en(DETALLE.fields, 2), start: 8, end: 8, declaredLength: 1 },
        en(DETALLE.fields, 3),
      ],
    };
    const spec: FileSpec = { ...espec(), records: [CABECERA, detalle, CIERRE] };
    expect(validarFileSpec(spec).ok).toBe(false);
    const resultado = inspeccionarArchivo(spec, bytesDe(''));
    expect(resultado.ok).toBe(false);
    expect(resultado.ok ? [] : resultado.error).toEqual([{ codigo: 'SPEC_INVALIDA' }]);
  });
});

describe('inspeccionarArchivo · códigos de archivo congelados', () => {
  it('ARCHIVO_VACIO', () => {
    expect(inspeccionarArchivo(espec(), bytesDe('')).ok).toBe(false);
  });

  it('BOM_DETECTADO', () => {
    const conBom = new Uint8Array(3 + LINEA_H.length + 1);
    conBom.set([0xef, 0xbb, 0xbf], 0);
    conBom.set(bytesDe(`${LINEA_H}\n`), 3);
    const resultado = inspeccionarArchivo(espec(), conBom);
    expect(resultado.ok).toBe(false);
    expect(resultado.ok ? [] : resultado.error).toEqual([{ codigo: 'BOM_DETECTADO', offset: 0 }]);
  });

  it('SEPARADOR_MIXTO (una pareja CR+LF con \\n configurado, por ocurrencia)', () => {
    const bytes = bytesDe(`${LINEA_H}\r\n${LINEA_C}\n`);
    const resultado = inspeccionarArchivo(espec(), bytes);
    expect(resultado.ok).toBe(false);
    expect(resultado.ok ? [] : resultado.error).toEqual([
      { codigo: 'SEPARADOR_MIXTO', offset: LINEA_H.length },
    ]);
  });

  it('LINEA_VACIA', () => {
    const bytes = bytesDe(`${LINEA_H}\n\n${LINEA_D}\n${LINEA_C}\n`);
    const resultado = inspeccionarArchivo(espec(), bytes);
    expect(resultado.ok).toBe(false);
    expect(resultado.ok ? [] : resultado.error).toEqual([
      { codigo: 'LINEA_VACIA', linea: 2, offset: LINEA_H.length + 1 },
    ]);
  });

  it('CARACTER_NO_ADMITIDO con un byte no printable mutado a mano', () => {
    const lineaD = bytesDe(LINEA_D);
    lineaD[2] = 0x80;
    const bytes = Uint8Array.from([
      ...bytesDe(`${LINEA_H}\n`),
      ...lineaD,
      ...bytesDe(`\n${LINEA_C}\n`),
    ]);
    const resultado = inspeccionarArchivo(espec(), bytes);
    expect(resultado.ok).toBe(false);
    expect(resultado.ok ? [] : resultado.error).toEqual([
      {
        codigo: 'CARACTER_NO_ADMITIDO',
        linea: 2,
        offset: LINEA_H.length + 1,
        registroId: 'D',
        posicion: 3,
      },
    ]);
  });

  it('SEPARADOR_FINAL_INVALIDO (sobra el separador final con trailing false)', () => {
    const bytes = bytesDe(`${LINEA_H}\n${LINEA_D}\n${LINEA_C}\n`);
    const resultado = inspeccionarArchivo(espec(estructuraInicial(), '\n', false), bytes);
    expect(resultado.ok).toBe(false);
    expect(resultado.ok ? [] : resultado.error).toEqual([
      { codigo: 'SEPARADOR_FINAL_INVALIDO', offset: bytes.length - 1 },
    ]);
  });

  it('SEPARADOR_FINAL_INVALIDO (falta el separador final con trailing true)', () => {
    const bytes = bytesDe(`${LINEA_H}\n${LINEA_D}\n${LINEA_C}`);
    const resultado = inspeccionarArchivo(espec(), bytes);
    expect(resultado.ok).toBe(false);
    expect(resultado.ok ? [] : resultado.error).toEqual([{ codigo: 'SEPARADOR_FINAL_INVALIDO' }]);
  });

  it('LONGITUD_LINEA_INVALIDA', () => {
    const bytes = bytesDe(`${LINEA_H}\ncorto\n${LINEA_C}\n`);
    const resultado = inspeccionarArchivo(espec(), bytes);
    expect(resultado.ok).toBe(false);
    expect(resultado.ok ? [] : resultado.error.map((e) => e.codigo)).toEqual([
      'LONGITUD_LINEA_INVALIDA',
    ]);
  });

  it('ORDEN_INVALIDO con línea de cierre antes de la cabecera', () => {
    const bytes = bytesDe(`${LINEA_C}\n${LINEA_H}\n${LINEA_D}\n`);
    const resultado = inspeccionarArchivo(espec(), bytes);
    expect(resultado.ok).toBe(false);
    expect(resultado.ok ? [] : resultado.error.map((e) => e.codigo)).toEqual(['ORDEN_INVALIDO']);
  });

  it('REGISTRO_DESCONOCIDO con discriminador mutado fuera del campo variable', () => {
    const bytes = bytesDe(`${LINEA_H}\n${'X'.repeat(14)}\n${LINEA_C}\n`);
    const resultado = inspeccionarArchivo(espec(), bytes);
    expect(resultado.ok).toBe(false);
    expect(resultado.ok ? [] : resultado.error.map((e) => e.codigo)).toEqual([
      'REGISTRO_DESCONOCIDO',
    ]);
  });
});

describe('inspeccionarArchivo · round-trip con el serializer (explícito)', () => {
  it('parsea la salida del serializer sin ampliar la API pública', () => {
    const serializado = serializarArchivo(espec(), [
      { recordId: 'H', valores: H_OK },
      { recordId: 'D', valores: D_OK },
      { recordId: 'C', valores: C_OK },
    ]);
    const bytes = valorDe(serializado);
    const resultado = inspeccionarArchivo(espec(), bytes);
    expect(resultado.ok).toBe(true);
    const registros = valorDe(resultado).registros;
    expect(registros.map((r) => r.registroId)).toEqual(['H', 'D', 'C']);
    expect(textoDe(en(en(registros, 2).campos, 0).bytes)).toBe('C');
  });
});
