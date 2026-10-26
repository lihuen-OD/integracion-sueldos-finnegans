// Pruebas de parseo de ARCHIVO (T4-8, CP-F4-C): matriz de errores congelada (docs/02
// §Errores · Archivo), orden por fases (escáner → por línea → estructural) y
// `rutaRepeticiones` (D-070/D-073), con RAW preservado (D-071). Fixtures sintéticas,
// construidas a mano desde literales ASCII (independientes del serializer); se agrega
// un caso de integración round-trip con la salida de `serializarArchivo`.
import { describe, expect, it } from 'vitest';
import { parsearArchivo } from '../../../../src/banks/fixed-width/parserArchivo';
import { serializarArchivo } from '../../../../src/banks/fixed-width';
import type {
  EstructuraArchivo,
  FileSpec,
  ValoresPorCampo,
} from '../../../../src/banks/fixed-width';
import { bytesDe, textoDe } from './auxiliares';
import { campo, fijo, registro, nodoRegistro, repeticion, secuencia } from './specsSinteticas';
import {
  CABECERA,
  CIERRE,
  DETALLE,
  archivoSpec,
  en,
  estructuraInicial,
  valorDe,
} from './archivoSpecs';

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

function salida(
  estructura = estructuraInicial(),
  separadorNL: '\r\n' | '\n' = '\n',
  trailing = true,
): Uint8Array {
  const serializado = serializarArchivo(espec(estructura, separadorNL, trailing), [
    { recordId: 'H', valores: H_OK },
    { recordId: 'D', valores: D_OK },
    { recordId: 'C', valores: C_OK },
  ]);
  expect(serializado.ok).toBe(true);
  return serializado.ok ? serializado.value : bytesDe('');
}

describe('parsearArchivo · caso feliz y RAW (D-071)', () => {
  it('parsea la salida del serializer y preserva la representación exacta', () => {
    const resultado = parsearArchivo(espec(), salida());
    expect(resultado.ok).toBe(true);
    const registros = valorDe(resultado).registros;
    expect(registros.map((r) => r.registroId)).toEqual(['H', 'D', 'C']);
    expect(textoDe(en(en(registros, 0).campos, 0).bytes)).toBe('H');
    expect(textoDe(en(en(registros, 0).campos, 1).bytes)).toBe('saludo ');
    expect(textoDe(en(en(registros, 1).campos, 2).bytes)).toBe('000021');
    expect(en(registros, 0).valores).toEqual({
      marcaH: 'H',
      dato: 'saludo ',
      numH: '07',
    });
  });

  it('registra línea física 1-based, offset en bytes y rutas simples', () => {
    const resultado = parsearArchivo(espec(), salida());
    expect(resultado.ok).toBe(true);
    {
      const ubicaciones = valorDe(resultado).registros;
      const offsetD = LINEA_H.length + 1;
      const offsetC = offsetD + LINEA_D.length + 1;
      expect(ubicaciones.map((r) => [r.linea, r.offset])).toEqual([
        [1, 0],
        [2, offsetD],
        [3, offsetC],
      ]);
      expect(ubicaciones.map((r) => r.rutaRepeticiones)).toEqual([[], [1], []]);
    }
  });

  it('parsea contenido escrito a mano (independencia del serializer)', () => {
    const bytes = bytesDe(`${LINEA_H}\n${LINEA_D}\n${LINEA_D}\n${LINEA_C}\n`);
    const resultado = parsearArchivo(espec(), bytes);
    expect(resultado.ok).toBe(true);
    const registros = valorDe(resultado).registros;
    expect(registros.map((r) => r.rutaRepeticiones)).toEqual([[], [1], [2], []]);
    expect(textoDe(en(en(registros, 3).campos, 1).bytes)).toBe('cierre1');
  });

  it('parsea sin separador final (trailing false)', () => {
    const bytes = bytesDe(`${LINEA_H}\n${LINEA_D}\n${LINEA_C}`);
    const resultado = parsearArchivo(espec(estructuraInicial(), '\n', false), bytes);
    expect(resultado.ok).toBe(true);
    expect(valorDe(resultado).registros.map((r) => r.registroId)).toEqual(['H', 'D', 'C']);
  });

  it('parsea líneas separadas por CRLF con offsets correctos', () => {
    const bytes = bytesDe(`${LINEA_H}\r\n${LINEA_D}\r\n${LINEA_C}\r\n`);
    const resultado = parsearArchivo(espec(estructuraInicial(), '\r\n'), bytes);
    expect(resultado.ok).toBe(true);
    const registros = valorDe(resultado).registros;
    expect(en(registros, 1).offset).toBe(LINEA_H.length + 2);
    expect(textoDe(en(en(registros, 1).campos, 1).bytes)).toBe('abc123');
  });

  it('las copias del parse no son vistas del buffer de entrada', () => {
    const bytes = salida();
    const resultado = parsearArchivo(espec(), bytes);
    expect(resultado.ok).toBe(true);
    bytes[0] = 0x58; // 'X'
    // También se muta un byte variable (dentro de 'ref' del segundo registro).
    const offsetRefD = LINEA_H.length + 1 + 2;
    bytes[offsetRefD] = 0x5a; // 'Z'
    const registros = valorDe(resultado).registros;
    expect(textoDe(en(en(registros, 0).campos, 0).bytes)).toBe('H');
    expect(en(en(registros, 1).campos, 1).bytes).toEqual(bytesDe('abc123'));
    expect(en(registros, 1).valores['ref']).toBe('abc123');
  });
});

describe('parsearArchivo · precondiciones', () => {
  it('SPEC_INVALIDA antes de procesar bytes con spec técnica inválida', () => {
    const mala = {
      ...espec(),
      records: [
        CABECERA,
        {
          ...DETALLE,
          fields: [
            ...DETALLE.fields.slice(0, 3),
            { ...en(DETALLE.fields, 3), start: 20, end: 22, declaredLength: 3 },
          ],
        },
        CIERRE,
      ],
    };
    const resultado = parsearArchivo(mala, salida());
    expect(resultado.ok).toBe(false);
    expect(resultado.ok ? [] : resultado.error).toEqual([{ codigo: 'SPEC_INVALIDA' }]);
  });

  it('ARCHIVO_VACIO', () => {
    const resultado = parsearArchivo(espec(), bytesDe(''));
    expect(resultado.ok).toBe(false);
    expect(resultado.ok ? [] : resultado.error).toEqual([{ codigo: 'ARCHIVO_VACIO' }]);
  });

  it('una spec con discriminador ambiguo se rechaza antes con SPEC_INVALIDA', () => {
    // Propiedad D-070: REGISTRO_AMBIGUO es defensa de la primitiva de identificación;
    // con una FileSpec técnicamente válida el estado es inalcanzable en el parser de
    // archivo porque `validarFileSpec` exige discriminadores no ambiguos.
    const spec: FileSpec = {
      ...espec(),
      records: [CABECERA, { ...CABECERA, id: 'H2' }],
      structure: secuencia(nodoRegistro('H'), nodoRegistro('H2')),
    };
    const resultado = parsearArchivo(spec, bytesDe(`${LINEA_H}\n${LINEA_H}\n`));
    expect(resultado.ok).toBe(false);
    expect(resultado.ok ? [] : resultado.error).toEqual([{ codigo: 'SPEC_INVALIDA' }]);
  });
});

describe('parsearArchivo · fase de escaneo (detiene)', () => {
  it('BOM_DETECTADO al comienzo', () => {
    const conBom = new Uint8Array(3 + salida().length);
    conBom.set([0xef, 0xbb, 0xbf], 0);
    conBom.set(salida(), 3);
    const resultado = parsearArchivo(espec(), conBom);
    expect(resultado.ok).toBe(false);
    expect(resultado.ok ? [] : resultado.error).toEqual([{ codigo: 'BOM_DETECTADO', offset: 0 }]);
  });

  it('BOM UTF-16LE y UTF-16BE también cortan', () => {
    for (const prefijos of [
      [0xff, 0xfe],
      [0xfe, 0xff],
    ]) {
      const bytes = Uint8Array.from([...prefijos, 0x48]);
      expect(parsearResultadoCodes(bytes)).toContain('BOM_DETECTADO');
    }
  });

  it('SEPARADOR_MIXTO por ocurrencia del separador alternativo (usuario config \\n, bytes con \\r\\n)', () => {
    const bytes = bytesDe(`${LINEA_H}\r\n${LINEA_C}\r\n`);
    const resultado = parsearArchivo(espec(), bytes);
    expect(resultado.ok).toBe(false);
    expect(resultado.ok ? [] : resultado.error).toEqual([
      { codigo: 'SEPARADOR_MIXTO', offset: LINEA_H.length },
      { codigo: 'SEPARADOR_MIXTO', offset: LINEA_H.length + 2 + LINEA_C.length },
    ]);
  });

  it('SEPARADOR_MIXTO con el separador \\r\\n configurado y un LF suelto', () => {
    const bytes = bytesDe(`${LINEA_H}\n${LINEA_C}\n`);
    const resultado = parsearArchivo(espec(estructuraInicial(), '\r\n'), bytes);
    expect(resultado.ok).toBe(false);
    expect(resultado.ok ? [] : resultado.error).toEqual([
      { codigo: 'SEPARADOR_MIXTO', offset: LINEA_H.length },
      { codigo: 'SEPARADOR_MIXTO', offset: LINEA_H.length + 1 + LINEA_C.length },
      { codigo: 'SEPARADOR_FINAL_INVALIDO' },
    ]);
  });

  it('SEPARADOR_MIXTO con un CR suelto (no seguido de LF)', () => {
    const bytes = bytesDe(`${LINEA_H}\r${LINEA_C}\n`);
    const resultado = parsearArchivo(espec(), bytes);
    expect(resultado.ok).toBe(false);
    expect(resultado.ok ? [] : resultado.error).toEqual([
      { codigo: 'SEPARADOR_MIXTO', offset: LINEA_H.length },
    ]);
  });

  it('LINEA_VACIA en la línea vacía intermedia', () => {
    const bytes = bytesDe(`${LINEA_H}\n\n${LINEA_C}\n`);
    const resultado = parsearArchivo(espec(estructuraInicial(), '\n'), bytes);
    expect(resultado.ok).toBe(false);
    expect(resultado.ok ? [] : resultado.error).toEqual([
      { codigo: 'LINEA_VACIA', linea: 2, offset: LINEA_H.length + 1 },
    ]);
  });

  it('SEPARADOR_FINAL_INVALIDO cuando falta el separador final (trailing true)', () => {
    const bytes = bytesDe(`${LINEA_H}\n${LINEA_D}\n${LINEA_C}`);
    const resultado = parsearArchivo(espec(estructuraInicial(), '\n', true), bytes);
    expect(resultado.ok).toBe(false);
    expect(resultado.ok ? [] : resultado.error).toEqual([{ codigo: 'SEPARADOR_FINAL_INVALIDO' }]);
  });

  it('SEPARADOR_FINAL_INVALIDO cuando sobra el separador final (trailing false)', () => {
    const bytes = bytesDe(`${LINEA_H}\n${LINEA_D}\n${LINEA_C}\n`);
    const resultado = parsearArchivo(espec(estructuraInicial(), '\n', false), bytes);
    expect(resultado.ok).toBe(false);
    expect(resultado.ok ? [] : resultado.error).toEqual([
      { codigo: 'SEPARADOR_FINAL_INVALIDO', offset: bytes.length - 1 },
    ]);
  });

  it('no procesa las líneas si el escaneo detecta errores', () => {
    // 'X' no termina en separador (trailing true): el error del escáner corta y no hay
    // error de fase por línea, aunque la línea tampoco sea parseable.
    const resultado = parsearArchivo(espec(), bytesDe('X'));
    expect(resultado.ok).toBe(false);
    expect(resultado.ok ? [] : resultado.error.map((e) => e.codigo)).toEqual([
      'SEPARADOR_FINAL_INVALIDO',
    ]);
  });
});

function parsearResultadoCodes(bytes: Uint8Array): readonly string[] {
  const resultado = parsearArchivo(espec(), bytes);
  return resultado.ok ? [] : resultado.error.map((e) => e.codigo);
}

describe('parsearArchivo · fase por línea (detiene al primer problema)', () => {
  it('LONGITUD_LINEA_INVALIDA cuando la línea no coincide con ningún recordLength', () => {
    const bytes = bytesDe(`${LINEA_H}\ncorto\n${LINEA_D}\n${LINEA_C}\n`);
    const resultado = parsearArchivo(espec(), bytes);
    expect(resultado.ok).toBe(false);
    expect(resultado.ok ? [] : resultado.error).toEqual([
      { codigo: 'LONGITUD_LINEA_INVALIDA', linea: 2, offset: LINEA_H.length + 1 },
    ]);
  });

  it('REGISTRO_DESCONOCIDO cuando la longitud existe pero el discriminador no', () => {
    const bytes = bytesDe(`${LINEA_H}\n${'X'.repeat(14)}\n${LINEA_C}\n`);
    const resultado = parsearArchivo(espec(), bytes);
    expect(resultado.ok).toBe(false);
    expect(resultado.ok ? [] : resultado.error).toEqual([
      { codigo: 'REGISTRO_DESCONOCIDO', linea: 2, offset: LINEA_H.length + 1 },
    ]);
  });

  it('parse con errores de campo: acumula con línea, offset, registroId y posición de campo', () => {
    // 'imp' (posiciones 8-13): 'xx021x' con 3 dígitos inválidos (pares 8, 9 y 13).
    const bytes = bytesDe(`${LINEA_H}\n${LINEA_D}\nDabc123xx021xy\n${LINEA_C}\n`);
    const resultado = parsearArchivo(espec(), bytes);
    expect(resultado.ok).toBe(false);
    expect(resultado.ok ? [] : resultado.error.map((e) => e.codigo)).toEqual([
      'DIGITO_INVALIDO',
      'DIGITO_INVALIDO',
      'DIGITO_INVALIDO',
    ]);
    if (!resultado.ok) {
      expect(resultado.error[0]).toMatchObject({
        linea: 3,
        registroId: 'D',
        campoId: 'imp',
        posicion: 8,
      });
      expect(en(resultado.error, 0).offset).toBe(LINEA_H.length + 1 + LINEA_D.length + 1);
      expect(resultado.error[1]).toMatchObject({ posicion: 9 });
      expect(resultado.error[2]).toMatchObject({ posicion: 13 });
    }
  });

  it('CARACTER_NO_ADMITIDO con un byte 0x7F dentro de un campo variable', () => {
    const lineaD = bytesDe(LINEA_D);
    lineaD[2] = 0x7f; // 'ref' (posiciones 2-7) deja de ser ASCII printable
    const bytes = Uint8Array.from([
      ...bytesDe(`${LINEA_H}\n`),
      ...lineaD,
      ...bytesDe(`\n${LINEA_C}\n`),
    ]);
    const resultado = parsearArchivo(espec(), bytes);
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

  it('la primera línea con problema detiene antes de procesar la segunda', () => {
    const bytes = bytesDe(`${LINEA_H}\nmala-linea\n${LINEA_D}\n`);
    const resultado = parsearArchivo(espec(), bytes);
    expect(resultado.ok).toBe(false);
    expect(resultado.ok ? [] : resultado.error).toHaveLength(1);
    if (!resultado.ok) {
      expect(en(resultado.error, 0).linea).toBe(2);
    }
  });
});

describe('parsearArchivo · fase estructural (única, comparte walker)', () => {
  it('REPETICION_INCOMPLETA al cerrar la repetición antes de cumplir min', () => {
    const bytes = bytesDe(`${LINEA_H}\n${LINEA_C}\n`);
    const resultado = parsearArchivo(espec(estructuraInicial(2)), bytes);
    expect(resultado.ok).toBe(false);
    expect(resultado.ok ? [] : resultado.error).toEqual([
      {
        codigo: 'REPETICION_INCOMPLETA',
        registroId: 'C',
        linea: 2,
        offset: LINEA_H.length + 1,
        ruta: [],
      },
    ]);
  });

  it('REGISTRO_FALTANTE al esperar el cierre tras la repetición completa sin línea', () => {
    const bytes = bytesDe(`${LINEA_H}\n${LINEA_D}\n`);
    const resultado = parsearArchivo(espec(), bytes);
    expect(resultado.ok).toBe(false);
    expect(resultado.ok ? [] : resultado.error).toEqual([
      { codigo: 'REGISTRO_FALTANTE', registroId: 'C', ruta: [] },
    ]);
  });

  it('LINEA_DEMASIADO al sobrar registros después del cierre', () => {
    const bytes = bytesDe(`${LINEA_H}\n${LINEA_D}\n${LINEA_C}\n${LINEA_D}\n`);
    const resultado = parsearArchivo(espec(), bytes);
    expect(resultado.ok).toBe(false);
    expect(resultado.ok ? [] : resultado.error).toEqual([
      {
        codigo: 'LINEA_DEMASIADO',
        registroId: 'D',
        linea: 4,
        offset: bytes.length - LINEA_D.length - 1,
      },
    ]);
  });

  it('ORDEN_INVALIDO con la línea mal ubicada', () => {
    const bytes = bytesDe(`${LINEA_D}\n${LINEA_H}\n${LINEA_C}\n`);
    const resultado = parsearArchivo(espec(), bytes);
    expect(resultado.ok).toBe(false);
    expect(resultado.ok ? [] : resultado.error).toEqual([
      { codigo: 'ORDEN_INVALIDO', registroId: 'D', linea: 1, offset: 0, ruta: [] },
    ]);
  });
});

describe('parsearArchivo · rutaRepeticiones anidadas (D-070/D-073)', () => {
  const INTERIOR = registro('I', 6, [fijo('marcaI', 1, 1, 'I'), campo('valorI', 2, 6, 'A')]);
  const estructuraAnidada: EstructuraArchivo = secuencia(
    nodoRegistro('H'),
    repeticion(secuencia(nodoRegistro('D'), repeticion(nodoRegistro('I'), 1)), 1),
    nodoRegistro('C'),
  );
  const specAnidada: FileSpec = {
    ...espec(estructuraAnidada),
    records: [CABECERA, DETALLE, INTERIOR, CIERRE],
  };
  const LINEA_I = 'Ival1 ';

  it('contadores 1-based exterior → interior: [1,1], [1,2], [2,1]', () => {
    const bytes = bytesDe(
      [LINEA_H, LINEA_D, LINEA_I, LINEA_I, LINEA_D, LINEA_I, LINEA_C].map((l) => `${l}\n`).join(''),
    );
    const resultado = parsearArchivo(specAnidada, bytes);
    expect(resultado.ok).toBe(true);
    expect(valorDe(resultado).registros.map((r) => [r.registroId, r.rutaRepeticiones])).toEqual([
      ['H', []],
      ['D', [1]],
      ['I', [1, 1]],
      ['I', [1, 2]],
      ['D', [2]],
      ['I', [2, 1]],
      ['C', []],
    ]);
  });

  it('tres iteraciones exteriores mantienen contadores independientes', () => {
    const bytes = bytesDe(
      [LINEA_H, LINEA_D, LINEA_I, LINEA_D, LINEA_I, LINEA_D, LINEA_I, LINEA_C]
        .map((l) => `${l}\n`)
        .join(''),
    );
    const resultado = parsearArchivo(specAnidada, bytes);
    expect(resultado.ok).toBe(true);
    expect(valorDe(resultado).registros.map((r) => [r.registroId, r.rutaRepeticiones])).toEqual([
      ['H', []],
      ['D', [1]],
      ['I', [1, 1]],
      ['D', [2]],
      ['I', [2, 1]],
      ['D', [3]],
      ['I', [3, 1]],
      ['C', []],
    ]);
  });

  it('con min interior 2, iterar la exterior exige dos I por iteración', () => {
    const bytes = bytesDe(`${LINEA_H}\n${LINEA_D}\n${LINEA_C}\n`);
    const resultado = parsearArchivo(
      {
        ...specAnidada,
        structure: secuencia(
          nodoRegistro('H'),
          repeticion(secuencia(nodoRegistro('D'), repeticion(nodoRegistro('I'), 2)), 1),
          nodoRegistro('C'),
        ),
      },
      bytes,
    );
    expect(resultado.ok).toBe(false);
    expect(resultado.ok ? [] : resultado.error).toEqual([
      {
        codigo: 'REPETICION_INCOMPLETA',
        registroId: 'C',
        linea: 3,
        offset: LINEA_H.length + 1 + LINEA_D.length + 1,
        ruta: [1],
      },
    ]);
  });
  it('una segunda iteración interior obedece al min del interior ([1,2] con min 2)', () => {
    const estructura = secuencia(
      nodoRegistro('H'),
      repeticion(secuencia(nodoRegistro('D'), repeticion(nodoRegistro('I'), 2)), 1),
      nodoRegistro('C'),
    );
    const bytes = bytesDe(
      [LINEA_H, LINEA_D, LINEA_I, LINEA_I, LINEA_D, LINEA_I, LINEA_I, LINEA_C]
        .map((l) => `${l}\n`)
        .join(''),
    );
    const resultado = parsearArchivo({ ...specAnidada, structure: estructura }, bytes);
    expect(resultado.ok).toBe(true);
    expect(valorDe(resultado).registros.map((r) => [r.registroId, r.rutaRepeticiones])).toEqual([
      ['H', []],
      ['D', [1]],
      ['I', [1, 1]],
      ['I', [1, 2]],
      ['D', [2]],
      ['I', [2, 1]],
      ['I', [2, 2]],
      ['C', []],
    ]);
  });

  it('llega explícitamente a [3, 2] en la tercera iteración exterior', () => {
    const lineas = [
      LINEA_H,
      LINEA_D,
      LINEA_I,
      LINEA_D,
      LINEA_I,
      LINEA_I,
      LINEA_D,
      LINEA_I,
      LINEA_I,
      LINEA_C,
    ];
    const bytes = bytesDe(lineas.map((l) => `${l}\n`).join(''));
    const resultado = parsearArchivo(specAnidada, bytes);
    expect(resultado.ok).toBe(true);
    expect(valorDe(resultado).registros.map((r) => r.rutaRepeticiones)).toEqual([
      [],
      [1],
      [1, 1],
      [2],
      [2, 1],
      [2, 2],
      [3],
      [3, 1],
      [3, 2],
      [],
    ]);
  });
});

describe('parsearArchivo · fases integradas (round-trip)', () => {
  it('round trip completo es byte a byte fiel (R-T1 a nivel archivo)', () => {
    const bytes = salida();
    const resultado = parsearArchivo(espec(), bytes);
    expect(resultado.ok).toBe(true);
    {
      const reconsiderado = serializarArchivo(
        espec(),
        valorDe(resultado).registros.map((r) => ({
          recordId: r.registroId,
          valores: Object.fromEntries(
            Object.entries(r.valores).filter(([campoId]) => !campoId.startsWith('marca')),
          ),
        })),
      );
      expect(reconsiderado.ok).toBe(true);
      expect(textoDe(valorDe(reconsiderado))).toBe(textoDe(bytes));
    }
  });
});
