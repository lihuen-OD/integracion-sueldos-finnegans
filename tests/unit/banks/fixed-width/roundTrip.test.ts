// R-T1 fidelidad · R-T2 estabilidad · R-T3 limitación honesta (D-071, docs/02/06).
// El round trip opera a nivel REGISTRO con dos specs sintéticas heterogéneas (10 y 12
// bytes). NINGÚN helper canonicaliza: los valores RAW se copian TAL CUAL (sin trim, sin
// quitar ceros, sin quitar espacios, sin parseInt/Number). Spec A (10): fijo '1' pos1;
// N 'NUM' 2..7 (6); A 'TXT' 8..10 (3). Spec B (12): fijo '2' pos1; N 'NUM' 2..7 (6);
// A 'TXT' 8..12 (5).
import { describe, expect, it } from 'vitest';
import {
  identificarRegistro,
  parsearRegistro,
  serializarRegistro,
} from '../../../../src/banks/fixed-width';
import type { RecordSpec } from '../../../../src/banks/fixed-width';
import { bytesDe, textoDe } from './auxiliares';
import { campo, fijo, registro } from './specsSinteticas';

const A: RecordSpec = registro('A', 10, [
  fijo('TIPO', 1, 1, '1'),
  campo('NUM', 2, 7, 'N'),
  campo('TXT', 8, 10),
]);
const B: RecordSpec = registro('B', 12, [
  fijo('TIPO', 1, 1, '2'),
  campo('NUM', 2, 7, 'N'),
  campo('TXT', 8, 12),
]);

/** Helper solo-test: COPIA TAL CUAL de los valores RAW de los campos SIN fixedValue. */
function valoresVariables(spec: RecordSpec, crudo: Record<string, string>): Record<string, string> {
  const copia: Record<string, string> = {};
  for (const campoVariable of spec.fields) {
    if (campoVariable.fixedValue !== undefined) {
      continue;
    }
    const bruto = crudo[campoVariable.id];
    if (bruto === undefined) {
      throw new Error(`crudo sin ${campoVariable.id}`);
    }
    copia[campoVariable.id] = bruto;
  }
  return copia;
}

function serializados(spec: RecordSpec, valores: Record<string, string>): Uint8Array {
  const fisico = serializarRegistro(spec, valores);
  if (!fisico.ok) {
    throw new Error(`no serializa: ${JSON.stringify(fisico.error)}`);
  }
  return fisico.value;
}

function parseado(spec: RecordSpec, bytes: Uint8Array): Record<string, string> {
  const crudo = parsearRegistro(spec, bytes);
  if (!crudo.ok) {
    throw new Error(`no parsea: ${JSON.stringify(crudo.error)}`);
  }
  return crudo.value.valores;
}

describe('R-T1 · fidelidad del round trip', () => {
  it('10 B: serializar → parsear devuelve exactamente la expansión física esperada', () => {
    const logico = { NUM: '1234', TXT: 'AB' };
    const bytes = serializados(A, logico);
    expect(textoDe(bytes)).toBe('1001234AB ');
    expect(parseado(A, bytes)).toEqual({
      TIPO: '1',
      NUM: '001234',
      TXT: 'AB ',
    });
  });

  it('12 B: lo mismo con anchos heterogéneos respecto de la otra spec', () => {
    const logico = { NUM: '77', TXT: 'CO' };
    const bytes = serializados(B, logico);
    expect(textoDe(bytes)).toBe('2000077CO   ');
    expect(parseado(B, bytes)).toEqual({
      TIPO: '2',
      NUM: '000077',
      TXT: 'CO   ',
    });
  });
});

describe('R-T2 · estabilidad documental (D-071): parsear → copiar RAW tal cual → serializar', () => {
  const casos = [
    {
      nombre: 'spec A 10 B con ceros iniciales en N y espacios finales en A',
      spec: A,
      bruto: '1000042AB ', // MANUALES: '1' + NUM '000042' (2..7) + TXT 'AB ' (8..10)
      rawEsperado: { NUM: '000042', TXT: 'AB ' },
    },
    {
      nombre: 'spec A 10 B con el campo N completamente lleno de ceros',
      spec: A,
      bruto: '1000000AB ', // MANUALES: '1' + NUM '000000' + TXT 'AB '
      rawEsperado: { NUM: '000000', TXT: 'AB ' },
    },
    {
      nombre: 'spec A 10 B con espacio inicial en A (los espacios son significativos)',
      spec: A,
      bruto: '1000042 AB', // MANUALES: '1' + '000042' + TXT ' AB'
      rawEsperado: { NUM: '000042', TXT: ' AB' },
    },
    {
      nombre: 'spec A 10 B con espacio interior en A y dígito con ceros de relleno',
      spec: A,
      bruto: '1000042X Y', // MANUALES: '1' + '000042' + TXT 'X Y'
      rawEsperado: { NUM: '000042', TXT: 'X Y' },
    },
    {
      nombre: 'spec B 12 B (longitud distinta) con ceros y espacios finales',
      spec: B,
      bruto: '2000042AB   ', // MANUALES: '2' + '000042' + TXT 'AB   '
      rawEsperado: { NUM: '000042', TXT: 'AB   ' },
    },
  ] as const;

  for (const caso of casos) {
    it(`${caso.nombre}: el serializer recibe el RAW de ancho completo y reproduce los bytes`, () => {
      // 1) registro RAW construido MANUALMENTE, sin usar el serializer
      const r = bytesDe(caso.bruto);
      // 2) parseo del registro manual
      const crudo = parsearRegistro(caso.spec, r);
      expect(crudo.ok).toBe(true);
      if (!crudo.ok) {
        throw new Error(`no parsea el manual: ${JSON.stringify(crudo.error)}`);
      }
      // 3+4) valores RAW solo de campos SIN fixedValue, copiados TAL CUAL
      const rawVariables = valoresVariables(caso.spec, crudo.value.valores);
      expect(rawVariables).toEqual(caso.rawEsperado); // documento qué recibe el serializer
      // 5+6) serializar esos RAW y exigir igualdad byte a byte con `r`
      const bytesFinal = serializados(caso.spec, rawVariables);
      expect(Array.from(bytesFinal)).toEqual(Array.from(r));
    });
  }

  it('el helper NO transformó nada: copia exacta de lo parseado (sin quitar ceros ni espacios)', () => {
    const r = bytesDe('1000042AB ');
    const crudo = parsearRegistro(A, r);
    if (!crudo.ok) {
      throw new Error('se esperaba ok');
    }
    expect(valoresVariables(A, crudo.value.valores)).toEqual({
      NUM: crudo.value.valores['NUM'],
      TXT: crudo.value.valores['TXT'],
    });
  });

  it('cada registro físico manual identifica a su propia spec (10 B y 12 B conviven)', () => {
    expect(identificarRegistro([A, B], bytesDe('1000009ZZ '))).toEqual({ ok: true, value: A });
    expect(identificarRegistro([A, B], bytesDe('2000009ZZ   '))).toEqual({ ok: true, value: B });
  });
});

describe('R-T3 · limitación honesta normativa (D-071): el parser acepta mutaciones estructuralmente válidas', () => {
  it('A) campo N: cambiar un dígito ASCII por otro dígito ASCII — el parser acepta AMBOS', () => {
    const r1 = bytesDe('1000042AB '); // manual, válido
    expect(parsearRegistro(A, r1).ok).toBe(true);
    const r2 = r1.slice(); // copia mutada manualmente: '000042' → '000043' (última posición de NUM)
    r2[6] = '3'.charCodeAt(0);
    expect(Array.from(r2)).not.toEqual(Array.from(r1));
    const parseado2 = parsearRegistro(A, r2);
    expect(parseado2.ok).toBe(true);
    if (!parseado2.ok) {
      throw new Error('se esperaba ok');
    }
    expect(parseado2.value.valores['NUM']).toBe('000043');
    // El motor genérico no puede saber que el valor variable fue alterado: ambos son válidos.
  });

  it('B) campo A: cambiar un ASCII printable por otro ASCII printable — el parser acepta AMBOS', () => {
    const r1 = bytesDe('1000042AB '); // manual, válido
    expect(parsearRegistro(A, r1).ok).toBe(true);
    const r2 = r1.slice(); // mutación manual de TXT 'AB ' → 'AC ' (índice 8 = posición 9, dentro de TXT 8..10)
    r2[8] = 'C'.charCodeAt(0);
    const parseado2 = parsearRegistro(A, r2);
    expect(parseado2.ok).toBe(true);
    if (!parseado2.ok) {
      throw new Error('se esperaba ok');
    }
    expect(parseado2.value.valores['TXT']).toBe('AC ');
  });

  it('sin checksum ni total ni comparación semántica: esa detección es F5/F6, no F4', () => {
    // documentación en vivo: la mutación dentro del alfabeto NO produce ningún error
    const r1 = bytesDe('1000042AB ');
    const r2 = r1.slice();
    r2[6] = '9'.charCodeAt(0); // dígito alterado: sigue estructuralmente válido
    expect(parsearRegistro(A, r2).ok).toBe(true);
  });
});

describe('R-T3 · adicionales (ambigüedad lógica, conservados de la revisión previa)', () => {
  it('dos entradas lógicas distintas (N y A, con rellenos ambiguos) producen los mismos bytes', () => {
    // '42' → '000042' y '0042' → '000042'; 'AB' → 'AB ' y 'AB ' → 'AB ' (ancho exacto)
    expect(textoDe(serializados(A, { NUM: '42', TXT: 'AB' }))).toBe(
      textoDe(serializados(A, { NUM: '0042', TXT: 'AB ' })),
    );
  });

  it('por lo tanto la distinción lógica de espacios finales no es decidible por el motor', () => {
    const bytes = serializados(A, { NUM: '42', TXT: 'AB' });
    expect(parseado(A, bytes)['TXT']).toBe('AB '); // el raw no conserva el original lógico
  });
});
