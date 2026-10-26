// Contrato y geometría BNA (CP-F5-A): 3 registros de 200 bytes, 47 campos, estados y
// trazabilidad. Sin mapper, sin totales y sin serialización productiva.
import { describe, expect, it } from 'vitest';
import type { FileSpec } from '../../../../src/banks/fixed-width';
import type { FieldSpecBancaria } from '../../../../src/banks/trazabilidad';
import { validarFileSpec, validarRecordSpec } from '../../../../src/banks/fixed-width';
import {
  ID_CAMPO_BNA_TIPO_DOCUMENTO,
  REGISTROS_BNA,
  crearSpecBna,
  type BnaIssueId,
} from '../../../../src/banks/bna';

const CAMPOS = REGISTROS_BNA.flatMap((registro) => registro.fields);

function specCon(lineSeparator: '\n' | '\r\n', trailingSeparator: boolean): FileSpec {
  return crearSpecBna({ lineSeparator, trailingSeparator });
}

function campo(id: string): FieldSpecBancaria<BnaIssueId> {
  const encontrado = CAMPOS.find((c) => c.id === id);
  if (encontrado === undefined) {
    throw new Error(`Campo inexistente en la spec: ${id}`);
  }
  return encontrado;
}

const FIJOS: Readonly<Record<string, string>> = {
  r1_tipoRegistro: '1',
  r1_tipoPagos: 'SUE',
  r1_clasePagos: '1',
  r1_sistemaOriginal: '  ',
  r1_filler1: ' '.repeat(15),
  r1_casaEnvioRendicion: ' '.repeat(4),
  r1_filler2: ' '.repeat(100),
  r2_tipoRegistro: '2',
  r2_estado: '00',
  r2_numeroOperacionLink: ' '.repeat(9),
  r2_sucursalAcreditacionOriginal: ' '.repeat(4),
  r2_numeroRegistroLink: ' '.repeat(6),
  r2_observaciones: ' '.repeat(15),
  r2_filler: ' '.repeat(62),
  r3_tipoRegistro: '3',
  r3_importeAceptados: '0'.repeat(15),
  r3_cantidadAceptados: '0'.repeat(7),
  r3_importeRechazados: '0'.repeat(15),
  r3_cantidadRechazados: '0'.repeat(7),
  r3_importeComisiones: '0'.repeat(10),
  r3_importeIva: '0'.repeat(10),
  r3_importeRetencionIva: '0'.repeat(10),
  r3_importePercepcionIibb: '0'.repeat(10),
  r3_importeSelladoProvincial: '0'.repeat(10),
  r3_filler: ' '.repeat(83),
};

describe('spec BNA · geometría', () => {
  it.each([
    ['LF', '\n', false],
    ['CRLF', '\r\n', true],
  ] as const)('es técnicamente válida con la hipótesis %s', (_nombre, separador, final) => {
    const spec = specCon(separador, final);
    expect(validarFileSpec(spec)).toEqual({ ok: true, value: undefined });
    for (const registro of spec.records) {
      expect(validarRecordSpec(registro)).toEqual({ ok: true, value: undefined });
    }
  });

  it('tiene exactamente 3 registros y 47 campos', () => {
    expect(REGISTROS_BNA).toHaveLength(3);
    expect(CAMPOS).toHaveLength(47);
    expect(REGISTROS_BNA.map((r) => r.fields.length)).toEqual([15, 19, 13]);
  });

  it('conserva el conteo documental de estados por registro', () => {
    const contar = (status: 'CONFIRMADA' | 'INTERPRETACION_PENDIENTE' | 'BLOQUEADA') =>
      REGISTROS_BNA.map((registro) => registro.fields.filter((f) => f.status === status).length);
    expect(contar('CONFIRMADA')).toEqual([13, 16, 13]);
    expect(contar('INTERPRETACION_PENDIENTE')).toEqual([2, 2, 0]);
    expect(contar('BLOQUEADA')).toEqual([0, 1, 0]);
  });

  it('cada registro mide 200 bytes y cubre 1..200 sin huecos ni solapamientos', () => {
    for (const registro of REGISTROS_BNA) {
      expect(registro.recordLength).toBe(200);
      expect(registro.fields[0]?.start).toBe(1);
      for (let i = 1; i < registro.fields.length; i += 1) {
        expect(registro.fields[i]?.start).toBe((registro.fields[i - 1]?.end ?? 0) + 1);
      }
      expect(registro.fields.at(-1)?.end).toBe(200);
      for (const f of registro.fields) {
        expect(f.declaredLength).toBe(f.end - f.start + 1);
      }
    }
  });

  it('usa ids únicos, tipos y rellenos coherentes', () => {
    expect(new Set(CAMPOS.map((c) => c.id)).size).toBe(CAMPOS.length);
    for (const f of CAMPOS) {
      expect(f.id).not.toBe('');
      expect(['N', 'A']).toContain(f.type);
      expect(f.padding).toEqual(f.type === 'N' ? { kind: 'ZERO_LEFT' } : { kind: 'SPACE_RIGHT' });
      expect(f.fixedValue === undefined || f.fixedValue.length === f.declaredLength).toBe(true);
    }
  });

  it('declara exactamente los fixedValue confirmados', () => {
    for (const f of CAMPOS) {
      if (f.id in FIJOS) {
        expect(f.fixedValue).toBe(FIJOS[f.id]);
      } else {
        expect(f.fixedValue).toBeUndefined();
      }
    }
  });

  it('los ceros fijos de cantidad son de ancho completo, no un único 0', () => {
    expect(campo('r3_cantidadAceptados').type).toBe('A');
    expect(campo('r3_cantidadAceptados').fixedValue).toBe('0000000');
    expect(campo('r3_cantidadRechazados').type).toBe('A');
    expect(campo('r3_cantidadRechazados').fixedValue).toBe('0000000');
  });

  it('estructura 1, 2+ y 3 con discriminadores 1/2/3', () => {
    const spec = specCon('\n', false);
    expect(spec.structure).toEqual({
      kind: 'secuencia',
      partes: [
        { kind: 'registro', recordId: 'BNA_R1' },
        { kind: 'repeticion', parte: { kind: 'registro', recordId: 'BNA_R2' }, min: 1 },
        { kind: 'registro', recordId: 'BNA_R3' },
      ],
    });
    expect(REGISTROS_BNA.map((r) => r.fields[0]?.fixedValue)).toEqual(['1', '2', '3']);
  });
});

describe('spec BNA · BNA-1 y BNA-9', () => {
  it('BNA-1 permanece BLOQUEADA y no fija 02 ni 96', () => {
    const tipo = campo(ID_CAMPO_BNA_TIPO_DOCUMENTO);
    expect(tipo.status).toBe('BLOQUEADA');
    expect(tipo.fixedValue).toBeUndefined();
    expect(tipo.issues).toEqual(['BNA-1']);
    expect(tipo.fixedValue === '02' || tipo.fixedValue === '96').toBe(false);
    expect(CAMPOS.some((f) => f.fixedValue === '02' || f.fixedValue === '96')).toBe(false);
  });

  it('exige un separador explícito: no hay default silencioso', () => {
    expect(() =>
      (crearSpecBna as unknown as (configuracion?: unknown) => FileSpec)(undefined),
    ).toThrow();
  });

  it.each([
    ['LF', '\n', false],
    ['CRLF', '\r\n', true],
  ] as const)(
    'conserva la hipótesis %s como INTERPRETACION_PENDIENTE',
    (_nombre, separador, final) => {
      const spec = specCon(separador, final);
      expect(spec.lineSeparator).toEqual({
        value: separador,
        status: 'INTERPRETACION_PENDIENTE',
      });
      expect(spec.trailingSeparator).toEqual({
        value: final,
        status: 'INTERPRETACION_PENDIENTE',
      });
    },
  );
});
