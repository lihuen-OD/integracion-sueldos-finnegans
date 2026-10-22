// Validación técnica de specs (T4-1/T4-3): geometría, cobertura, ids, relleno, fijos,
// independencia de ContractStatus (D-075) y validación estática de estructura y
// discriminadores (D-070), con specs EXCLUSIVAMENTE sintéticas.
import { describe, expect, it } from 'vitest';
import {
  nodoRegistro,
  campo,
  fijo,
  registro,
  registroAuto,
  repeticion,
  secuencia,
} from './specsSinteticas';
import type { FieldSpec, FileSpec, RecordSpec } from '../../../../src/banks/fixed-width';
import { validarFileSpec, validarRecordSpec } from '../../../../src/banks/fixed-width';

function codigos(resultado: { ok: boolean; error?: readonly unknown[] }): string[] {
  if (resultado.ok || resultado.error === undefined) {
    return [];
  }
  return resultado.error.map((e) => (e as { codigo: string }).codigo);
}

function fileSpec(records: readonly RecordSpec[], estructura: FileSpec['structure']): FileSpec {
  return {
    id: 'SINTETICO',
    records,
    charset: 'ASCII_PRINTABLE',
    lineSeparator: { value: '\n', status: 'CONFIRMADA' },
    trailingSeparator: { value: false, status: 'CONFIRMADA' },
    structure: estructura,
  };
}

/** R1 sintético: fijo pos1..2 = 'AB', variable N 3..6, variable A 7..10. */
const R1 = registroAuto('R1', [
  fijo('TIPO', 1, 2, 'AB'),
  campo('NUM', 3, 6, 'N'),
  campo('TEXTO', 7, 10),
]);

describe('validarRecordSpec · geometría', () => {
  it('acepta una spec con cobertura exacta, relleno y fijos coherentes', () => {
    expect(validarRecordSpec(R1)).toEqual({ ok: true, value: undefined });
  });

  it('rechaza recordLength que no sea entero >= 1', () => {
    expect(codigos(validarRecordSpec(registro('R1', 0, [campo('A', 1, 1)])))).toContain(
      'LONGITUD_DE_REGISTRO_INVALIDA',
    );
    expect(codigos(validarRecordSpec(registro('R1', 2.5, [campo('A', 1, 2)])))).toContain(
      'LONGITUD_DE_REGISTRO_INVALIDA',
    );
  });

  it('reporta posiciones iniciales no 1-based, finalizadores invertidos y fuera del registro', () => {
    expect(codigos(validarRecordSpec(registro('R1', 4, [campo('A', 0, 2)])))).toContain(
      'POSICION_INVALIDA',
    );
    expect(codigos(validarRecordSpec(registro('R1', 4, [campo('A', 3, 2)])))).toContain(
      'POSICION_INVALIDA',
    );
    expect(codigos(validarRecordSpec(registro('R1', 4, [campo('A', 1, 5)])))).toContain(
      'POSICION_INVALIDA',
    );
  });

  it('exige que end-start+1 coincida con declaredLength (LONGITUD_DECLARADA_INCONSISTENTE)', () => {
    const errores = validarRecordSpec(
      registro('R1', 4, [campo('A', 1, 4, 'A', { declaredLength: 3 })]),
    );
    expect(codigos(errores)).toContain('LONGITUD_DECLARADA_INCONSISTENTE');
  });

  it('detecta hueco, solapamiento y cobertura incompleta con rangos 1-based', () => {
    const hueco = validarRecordSpec(registro('R1', 10, [campo('A', 1, 8)]));
    expect(codigos(hueco)).toEqual(
      expect.arrayContaining(['HUECO_POSICIONES', 'COBERTURA_INCOMPLETA']),
    );
    const solape = validarRecordSpec(registro('R1', 10, [campo('A', 1, 8), campo('B', 6, 10)]));
    expect(codigos(solape)).toContain('SOLAPAMIENTO_POSICIONES');
    const filtrado = (resultado: { ok: boolean; error?: readonly unknown[] }) =>
      resultado.ok || resultado.error === undefined
        ? []
        : resultado.error.filter(
            (e) => (e as { codigo: string }).codigo === 'SOLAPAMIENTO_POSICIONES',
          );
    expect(filtrado(solape)).toEqual([
      { codigo: 'SOLAPAMIENTO_POSICIONES', registroId: 'R1', desde: 6, hasta: 8 },
    ]);
  });

  it('rechaza campos fuera de orden ascendente aunque la cobertura sea exacta', () => {
    const desorden = validarRecordSpec(registro('R1', 10, [campo('B', 6, 10), campo('A', 1, 5)]));
    expect(codigos(desorden)).toEqual(['ORDEN_DE_CAMPOS_INVALIDO']);
  });

  it('rechaza ids vacíos y duplicados', () => {
    expect(codigos(validarRecordSpec(registro('R1', 2, [campo('', 1, 2)])))).toContain(
      'ID_INVALIDO',
    );
    expect(
      codigos(validarRecordSpec(registro('R1', 2, [campo('A', 1, 1), campo('A', 2, 2)]))),
    ).toContain('ID_DUPLICADO');
  });
});

describe('validarRecordSpec · relleno, fijos y ContractStatus (D-075)', () => {
  it('ZERO_LEFT solo para N; SPACE_RIGHT solo para A', () => {
    const conN = registrarCon('N', 'SPACE_RIGHT');
    const conA = registrarCon('A', 'ZERO_LEFT');
    expect(codigos(conN)).toContain('PADDING_INCOHERENTE');
    expect(codigos(conA)).toContain('PADDING_INCOHERENTE');
  });

  it('el fijo debe ocupar exactamente el ancho del campo y respetar el alfabeto tipo', () => {
    const incompleto = registerFijo('AB ', 'A', 3); // ancho 3, valor de 3 bytes con espacio: coherente
    expect(codigos(incompleto)).not.toContain('FIJO_INCOHERENTE');
    const corto = registerFijo('AB', 'A', 4);
    expect(codigos(corto)).toContain('FIJO_INCOHERENTE');
    const conNoDigito = registerFijo('X001', 'N', 4);
    expect(codigos(conNoDigito)).toContain('FIJO_INCOHERENTE');
    const noAscii = registerFijo('\t001', 'A', 4);
    expect(codigos(noAscii)).toContain('FIJO_INCOHERENTE');
  });

  it('ningún ContractStatus repara una spec técnicamente inválida', () => {
    const invalida = (status: 'CONFIRMADA' | 'INTERPRETACION_PENDIENTE' | 'BLOQUEADA') =>
      validarRecordSpec(registro('R1', 4, [campo('A', 1, 4, 'A', { status, declaredLength: 2 })]));
    const confirmada = invalida('CONFIRMADA');
    const pendiente = invalida('INTERPRETACION_PENDIENTE');
    const bloqueada = invalida('BLOQUEADA');
    expect(confirmada).toEqual(pendiente);
    expect(pendiente).toEqual(bloqueada);
    expect(codigos(bloqueada)).toContain('LONGITUD_DECLARADA_INCONSISTENTE');
  });

  function registrarCon(tipo: 'N' | 'A', relleno: 'ZERO_LEFT' | 'SPACE_RIGHT') {
    return validarRecordSpec(
      registro('R1', 4, [campo('A', 1, 4, tipo, { padding: { kind: relleno } })]),
    );
  }

  function registerFijo(valor: string, tipo: 'N' | 'A', ancho: number) {
    return validarRecordSpec(registro('R1', ancho, [fijo('F', 1, ancho, valor, tipo)]));
  }
});

describe('validarRecordSpec · geometría inválida: rechazo acotado (sin recorrer extremos)', () => {
  it('start id hiper-negativo y end id mayor a recordLength: solo errores técnicos', () => {
    const atravesado = registro('R1', 4, [campo('FUERA', -999_999_999, 999_999_999)]);
    expect(codigos(validarRecordSpec(atravesado))).toEqual([
      'POSICION_INVALIDA',
      'HUECO_POSICIONES',
      'COBERTURA_INCOMPLETA',
    ]);
  });

  it('un campo válido convive con otro de extremos gigantes: el válido sigue cubriendo su rango', () => {
    const mixto = registro('R1', 4, [campo('V', 1, 2), campo('GIGANTE', 3, 999_999_999)]);
    expect(codigos(validarRecordSpec(mixto))).toEqual([
      'POSICION_INVALIDA',
      'HUECO_POSICIONES',
      'COBERTURA_INCOMPLETA',
    ]);
  });

  it('la evaluación de pares D-070 tampoco recorre campos con geometría inválida', () => {
    const fijoCrazy = registro('A', 4, [fijo('F', 1, -5_000_000, 'AB')]);
    const grey = registro('B', 4, [fijo('F', 1, -5_000_000, 'AB')]);
    const spec = fileSpec([fijoCrazy, grey], secuencia(nodoRegistro('A'), nodoRegistro('B')));
    const codigosObtenidos = codigos(validarFileSpec(spec));
    expect(codigosObtenidos).toContain('POSICION_INVALIDA');
    expect(codigosObtenidos).toContain('FIJO_INCOHERENTE'); // ancho aritmético negativo
    expect(codigosObtenidos).toContain('DISCRIMINADOR_AMBIGUO'); // pares sin recorrer lo inválido
  });
});

describe('validarFileSpec · estructura y discriminadores (D-070)', () => {
  it('acepta `1 2+ 3`', () => {
    const r1 = registroAuto('R1', [fijo('D', 1, 1, '1')]);
    const r2 = registroAuto('R2', [fijo('D', 1, 1, '2')]);
    const r3 = registroAuto('R3', [fijo('D', 1, 1, '3')]);
    const spec = fileSpec(
      [r1, r2, r3],
      secuencia(nodoRegistro('R1'), repeticion(nodoRegistro('R2')), nodoRegistro('R3')),
    );
    expect(validarFileSpec(spec)).toEqual({ ok: true, value: undefined });
  });

  it('acepta `0 (1 2+)+` (repetición con secuencia y repetición anidada)', () => {
    const r0 = registroAuto('R0', [fijo('D', 1, 1, '0')]);
    const r1 = registroAuto('R1', [fijo('D', 1, 1, '1')]);
    const r2 = registroAuto('R2', [fijo('D', 1, 1, '2')]);
    const lote = secuencia(nodoRegistro('R1'), repeticion(nodoRegistro('R2'), 1));
    const spec = fileSpec([r0, r1, r2], secuencia(nodoRegistro('R0'), repeticion(lote, 1)));
    expect(validarFileSpec(spec)).toEqual({ ok: true, value: undefined });
  });

  it('acepta `secuencia[registro A, repeticion{min:1} A]`', () => {
    const a = registroAuto('A', [fijo('D', 1, 1, '1')]);
    const spec = fileSpec([a], secuencia(nodoRegistro('A'), repeticion(nodoRegistro('A'), 1)));
    expect(validarFileSpec(spec)).toEqual({ ok: true, value: undefined });
  });

  it('rechaza `secuencia[repeticion{min:1} A, registro A]` (ESTRUCTURA_AMBIGUA)', () => {
    const a = registroAuto('A', [fijo('D', 1, 1, '1')]);
    const spec = fileSpec([a], secuencia(repeticion(nodoRegistro('A'), 1), nodoRegistro('A')));
    expect(codigos(validarFileSpec(spec))).toContain('ESTRUCTURA_AMBIGUA');
  });

  it('rechaza `secuencia[repeticion{min:1} A, repeticion{min:1} A]`', () => {
    const a = registroAuto('A', [fijo('D', 1, 1, '1')]);
    const spec = fileSpec(
      [a],
      secuencia(repeticion(nodoRegistro('A'), 1), repeticion(nodoRegistro('A'), 1)),
    );
    expect(codigos(validarFileSpec(spec))).toContain('ESTRUCTURA_AMBIGUA');
  });

  it('rechaza el anidamiento en que un mismo id continúa la repetición y también la sigue', () => {
    const x = registroAuto('X', [fijo('D', 1, 1, '1')]);
    const estructurada = secuencia(
      repeticion(repeticion(nodoRegistro('X'), 1), 1),
      nodoRegistro('X'),
    );
    expect(codigos(validarFileSpec(fileSpec([x], estructurada)))).toContain('ESTRUCTURA_AMBIGUA');
  });

  it('exige min entero >= 1 y secuencia no vacía (ESTRUCTURA_INVALIDA)', () => {
    const a = registroAuto('A', [fijo('D', 1, 1, '1')]);
    expect(codigos(validarFileSpec(fileSpec([a], repeticion(nodoRegistro('A'), 0))))).toContain(
      'ESTRUCTURA_INVALIDA',
    );
    expect(codigos(validarFileSpec(fileSpec([a], repeticion(nodoRegistro('A'), 1.5))))).toContain(
      'ESTRUCTURA_INVALIDA',
    );
    expect(codigos(validarFileSpec(fileSpec([a], secuencia())))).toContain('ESTRUCTURA_INVALIDA');
  });

  it('rechaza ids inexistentes y registros no alcanzables', () => {
    const a = registroAuto('A', [fijo('D', 1, 1, '1')]);
    expect(codigos(validarFileSpec(fileSpec([a], nodoRegistro('Z'))))).toContain(
      'REGISTRO_INEXISTENTE_EN_ESTRUCTURA',
    );
    const conSobrante = fileSpec([a, registroAuto('B', [fijo('D', 1, 1, '2')])], nodoRegistro('A'));
    expect(codigos(validarFileSpec(conSobrante))).toContain('REGISTRO_NO_ALCANZABLE');
  });

  it('todo registro alcanzado exige al menos un fixedValue', () => {
    const discriminado = registroAuto('A', [fijo('D', 1, 1, '1'), campo('V', 2, 4)]);
    const conFijo = fileSpec([discriminado], nodoRegistro('A'));
    expect(validarFileSpec(conFijo)).toEqual({ ok: true, value: undefined });
    const sinFijo = registroAuto('A', [campo('V', 1, 4)]);
    expect(codigos(validarFileSpec(fileSpec([sinFijo], nodoRegistro('A'))))).toContain(
      'REGISTRO_SIN_DISCRIMINADOR',
    );
  });

  it('los 6 casos normativos de DISCRIMINADOR_AMBIGUO (docs/02)', () => {
    const de = (id: string, campos: readonly FieldSpec[]) => registro(id, 6, campos);

    // 1: posición común restringida con bytes distintos → distinguibles
    const caso1 = [de('R1', [fijo('D', 1, 1, '1')]), de('R2', [fijo('D', 1, 1, '2')])];
    // 2: posiciones restringidas disjuntas → DISCRIMINADOR_AMBIGUO
    const caso2 = [
      de('R1', [fijo('D', 1, 1, '1')]),
      de('R2', [campo('X', 2, 2, 'A', { fixedValue: 'A' })]),
    ];
    // 3: común restringido con iguales y otro solo de R1 → DISCRIMINADOR_AMBIGUO
    const caso3 = [
      de('R1', [fijo('D', 1, 1, '1'), campo('V', 2, 2, 'A', { fixedValue: 'A' })]),
      de('R2', [fijo('D', 1, 1, '1')]),
    ];
    // 4: mismos fixedValue → DISCRIMINADOR_AMBIGUO
    const caso4 = [de('R1', [fijo('D', 1, 2, '12')]), de('R2', [fijo('D', 1, 2, '12')])];
    // 5: uno tiene solo una posición adicional restringida → DISCRIMINADOR_AMBIGUO
    const caso5 = [
      de('R1', [fijo('D', 1, 1, '1')]),
      de('R2', [fijo('D', 1, 1, '1'), fijo('E', 2, 2, 'A')]),
    ];
    // 6: longitudes distintas → no se evalúan entre sí
    const caso6 = [
      registro('R1', 10, [fijo('D', 1, 1, '1'), campo('V', 2, 10)]),
      registro('R2', 12, [fijo('D', 1, 1, '1'), campo('V', 2, 12)]),
    ];

    expect(
      codigos(validarFileSpec(fileSpec(caso1, secuencia(nodoRegistro('R1'), nodoRegistro('R2'))))),
    ).not.toContain('DISCRIMINADOR_AMBIGUO');
    for (const par of [caso2, caso3, caso4, caso5]) {
      const spec = fileSpec(par, secuencia(nodoRegistro('R1'), nodoRegistro('R2')));
      expect(codigos(validarFileSpec(spec))).toContain('DISCRIMINADOR_AMBIGUO');
    }
    expect(
      codigos(validarFileSpec(fileSpec(caso6, secuencia(nodoRegistro('R1'), nodoRegistro('R2'))))),
    ).not.toContain('DISCRIMINADOR_AMBIGUO');
  });
});

describe('validarFileSpec · errores acumulados deterministas', () => {
  it('suma errores de RecordSpec y de estructura en orden fijo (sin solapamiento de pares)', () => {
    const r1 = registro('R1', 4, [
      fijo('F', 1, 2, 'AB'),
      campo('V', 3, 4, 'A', { declaredLength: 1 }), // LONGITUD_DECLARADA_INCONSISTENTE
    ]);
    const r2 = registro('R2', 4, [fijo('F', 1, 2, 'XY'), campo('V', 3, 4)]);
    // estructura referencia R1 y deja R2 no alcanzable; el par R1/R2 es distinguible ('AB'/'XY')
    const spec = fileSpec([r1, r2], nodoRegistro('R1'));
    expect(codigos(validarFileSpec(spec))).toEqual([
      'LONGITUD_DECLARADA_INCONSISTENTE',
      'REGISTRO_NO_ALCANZABLE',
    ]);
  });
});
