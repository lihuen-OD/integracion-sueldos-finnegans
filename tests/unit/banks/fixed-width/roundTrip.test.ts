// R-T1 fidelidad · R-T2 estabilidad · R-T3 limitación honesta (docs/02/06).
// El round trip opera a nivel REGISTRO con dos specs sintéticas heterogéneas (10 y 12
// bytes). El helper `valorLogico` y `valorFisico` son EXCLUSIVO de tests (el motor no
// deduce rellenos ni canonicidad). Spec A (10): fijo '1' pos1; N 'NUM' 2..7 (6);
// A 'TXT' 8..10 (3). Spec B (12): fijo '2' pos1; N 'NUM' 2..7 (6); A 'TXT' 8..12 (5).
import { describe, expect, it } from 'vitest';
import {
  identificarRegistro,
  parsearRegistro,
  serializarRegistro,
} from '../../../../src/banks/fixed-width';
import type { RecordSpec } from '../../../../src/banks/fixed-width';
import { textoDe } from './auxiliares';
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

/** Helper solo-test: derivación de valores lógicos guiada por la spec. */
function valorLogico(spec: RecordSpec, crudo: Record<string, string>): Record<string, string> {
  const logico: Record<string, string> = {};
  for (const campoF of spec.fields) {
    if (campoF.fixedValue !== undefined) {
      continue;
    }
    const bruto = crudo[campoF.id];
    if (bruto === undefined) {
      throw new Error(`crudo sin ${campoF.id}`);
    }
    if (campoF.type === 'N') {
      const sinCeros = bruto.replace(/^0+/, '');
      logico[campoF.id] = sinCeros === '' ? '0' : sinCeros;
    } else {
      logico[campoF.id] = bruto.replace(/ +$/, '');
    }
  }
  return logico;
}

/** Helper solo-test: expansión física de los rellenos declarados por la spec. */
function valorFisico(spec: RecordSpec, logico: Record<string, string>): Record<string, string> {
  const crudo: Record<string, string> = {};
  for (const campoF of spec.fields) {
    if (campoF.fixedValue !== undefined) {
      continue;
    }
    const bruto = logico[campoF.id];
    if (bruto === undefined) {
      throw new Error(`lógico sin ${campoF.id}`);
    }
    const ancho = campoF.end - campoF.start + 1;
    if (campoF.type === 'N') {
      crudo[campoF.id] = '0'.repeat(Math.max(0, ancho - bruto.length)) + bruto;
    } else {
      crudo[campoF.id] = bruto + ' '.repeat(Math.max(0, ancho - bruto.length));
    }
  }
  return crudo;
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
      ...valorFisico(A, logico),
    });
  });

  it('12 B: lo mismo con anchos heterogéneos respecto de la otra spec', () => {
    const logico = { NUM: '77', TXT: 'CO' };
    const bytes = serializados(B, logico);
    expect(textoDe(bytes)).toBe('2000077CO   ');
    expect(parseado(B, bytes)).toEqual({
      TIPO: '2',
      ...valorFisico(B, logico),
    });
  });
});

describe('R-T2 · estabilidad (helpers solo-test)', () => {
  it('parsear(serializar(v)) → valorLogico → serializar reproduce los mismos bytes', () => {
    for (const spec of [A, B]) {
      const logico = { NUM: '500', TXT: 'XY' };
      const bytes1 = serializados(spec, logico);
      const crudo = parseado(spec, bytes1);
      const bytes2 = serializados(spec, valorLogico(spec, crudo));
      expect(Array.from(bytes2)).toEqual(Array.from(bytes1));
    }
  });

  it('cada registro físico identifica a su propia spec (10 B y 12 B conviven)', () => {
    const bytes10 = serializados(A, { NUM: '9', TXT: 'Z' });
    const bytes12 = serializados(B, { NUM: '9', TXT: 'Z' });
    expect(identificarRegistro([A, B], bytes10)).toEqual({ ok: true, value: A });
    expect(identificarRegistro([A, B], bytes12)).toEqual({ ok: true, value: B });
  });
});

describe('R-T3 · limitación honesta: el raw NO decide canonicidad', () => {
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

  it('la responsable de la canonicidad es la EXPANSIÓN física: helper = spec, no al revés', () => {
    expect(valorFisico(A, { NUM: '42', TXT: 'AB' })).toEqual({ NUM: '000042', TXT: 'AB ' });
    expect(parseado(A, serializados(A, { NUM: '42', TXT: 'AB' }))).toEqual({
      TIPO: '1',
      NUM: '000042',
      TXT: 'AB ',
    });
  });
});
