import { describe, expect, it } from 'vitest';
import type { FieldSpecBancaria } from '../../../../src/banks/trazabilidad';
import {
  validarEstructura,
  validarFileSpec,
  validarRecordSpec,
} from '../../../../src/banks/fixed-width';
import {
  ID_CAMPO_PAT_DEPENDENCIA,
  ID_CAMPO_PAT_RELLENO_PAT1,
  ID_REGISTRO_PAT_0,
  ID_REGISTRO_PAT_1,
  ID_REGISTRO_PAT_2,
  PAT1_LONGITUD_DECLARADA_DOCUMENTAL,
  PAT1_LONGITUD_GEOMETRICA,
  PAT1_POSICION_FIN,
  PAT1_POSICION_INICIO,
  PAT2_LONGITUD,
  PAT2_POSICION_FIN,
  PAT2_POSICION_INICIO,
  PAT_TIPO_MOVIMIENTO_PLAN_SUELDOS,
  crearRegistrosPatagonia,
  crearSpecPatagoniaB2,
  type ConfiguracionTecnicaPatagonia,
  type HipotesisDependenciaPat2,
  type HipotesisRellenoPat1,
  type PatagoniaIssueId,
  type SpecPatagonia,
} from '../../../../src/banks/patagonia-b2';

const BASE = {
  hipotesisRellenoPat1: 'ESPACIOS',
  hipotesisDependenciaPat2: 'NUMERICA',
  lineSeparator: '\n',
  trailingSeparator: false,
} as const satisfies ConfiguracionTecnicaPatagonia;

function spec(overrides: Partial<ConfiguracionTecnicaPatagonia> = {}): SpecPatagonia {
  return crearSpecPatagoniaB2({ ...BASE, ...overrides });
}

function campo(
  archivo: SpecPatagonia,
  registroId: string,
  campoId: string,
): FieldSpecBancaria<PatagoniaIssueId> {
  const registro = archivo.records.find((r) => r.id === registroId);
  const encontrado = registro?.fields.find((f) => f.id === campoId);
  if (encontrado === undefined) {
    throw new Error(`Campo inexistente: ${registroId}/${campoId}`);
  }
  return encontrado;
}

describe('spec Patagonia B.2 · geometría', () => {
  it.each([
    ['ESPACIOS + NUMERICA + LF', 'ESPACIOS', 'NUMERICA', '\n', false],
    ['ESPACIOS + ALFANUMERICA + CRLF', 'ESPACIOS', 'ALFANUMERICA', '\r\n', true],
    ['CEROS + NUMERICA + CRLF', 'CEROS', 'NUMERICA', '\r\n', true],
    ['CEROS + ALFANUMERICA + LF', 'CEROS', 'ALFANUMERICA', '\n', false],
  ] as const)(
    'es técnicamente válida con %s',
    (_nombre, relleno, dependencia, separador, final) => {
      const archivo = spec({
        hipotesisRellenoPat1: relleno,
        hipotesisDependenciaPat2: dependencia,
        lineSeparator: separador,
        trailingSeparator: final,
      });
      expect(validarFileSpec(archivo)).toEqual({ ok: true, value: undefined });
      expect(
        validarEstructura(
          archivo.structure,
          new Map(archivo.records.map((registro) => [registro.id, registro])),
        ),
      ).toEqual([]);
      for (const registro of archivo.records) {
        expect(validarRecordSpec(registro)).toEqual({ ok: true, value: undefined });
      }
    },
  );

  it('tiene 3 registros, 42 campos y longitudes 200/200/200', () => {
    const archivo = spec();
    expect(archivo.records.map((r) => r.id)).toEqual([
      ID_REGISTRO_PAT_0,
      ID_REGISTRO_PAT_1,
      ID_REGISTRO_PAT_2,
    ]);
    expect(archivo.records.map((r) => r.recordLength)).toEqual([200, 200, 200]);
    expect(archivo.records.map((r) => r.fields.length)).toEqual([14, 11, 17]);
    expect(archivo.records.flatMap((r) => r.fields)).toHaveLength(42);
  });

  it.each([0, 1, 2])('el registro %i cubre 1..200 sin huecos ni solapamientos', (indice) => {
    const registro = spec().records[indice];
    expect(registro).toBeDefined();
    if (registro === undefined) return;

    expect(registro.fields[0]?.start).toBe(1);
    for (let i = 1; i < registro.fields.length; i += 1) {
      expect(registro.fields[i]?.start).toBe((registro.fields[i - 1]?.end ?? 0) + 1);
    }
    expect(registro.fields.at(-1)?.end).toBe(200);
    for (const f of registro.fields) {
      expect(f.declaredLength).toBe(f.end - f.start + 1);
    }
  });

  it('usa discriminadores 0/1/2 y estructura `0 (1 2+)+`', () => {
    const archivo = spec();
    expect(archivo.records.map((r) => r.fields[0]?.fixedValue)).toEqual(['0', '1', '2']);
    expect(archivo.structure).toEqual({
      kind: 'secuencia',
      partes: [
        { kind: 'registro', recordId: ID_REGISTRO_PAT_0 },
        {
          kind: 'repeticion',
          min: 1,
          parte: {
            kind: 'secuencia',
            partes: [
              { kind: 'registro', recordId: ID_REGISTRO_PAT_1 },
              {
                kind: 'repeticion',
                min: 1,
                parte: { kind: 'registro', recordId: ID_REGISTRO_PAT_2 },
              },
            ],
          },
        },
      ],
    });
  });

  it('H-02: solo implementa el movimiento 2 (Plan Sueldos), no el 4', () => {
    const movimiento = campo(spec(), ID_REGISTRO_PAT_1, 'r1_tipoMovimiento');
    expect(movimiento.fixedValue).toBe(PAT_TIPO_MOVIMIENTO_PLAN_SUELDOS);
    expect(movimiento.fixedValue).not.toBe('4');
  });
});

describe('spec Patagonia B.2 · PAT-1', () => {
  it('usa siempre 93 posiciones geométricas y nunca 96 en el FieldSpec', () => {
    for (const hipotesis of ['ESPACIOS', 'CEROS'] as const) {
      const relleno = campo(
        spec({ hipotesisRellenoPat1: hipotesis }),
        ID_REGISTRO_PAT_2,
        ID_CAMPO_PAT_RELLENO_PAT1,
      );
      expect(relleno.start).toBe(PAT1_POSICION_INICIO);
      expect(relleno.end).toBe(PAT1_POSICION_FIN);
      expect(relleno.declaredLength).toBe(PAT1_LONGITUD_GEOMETRICA);
      expect(relleno.declaredLength).toBe(93);
      expect(relleno.declaredLength).not.toBe(PAT1_LONGITUD_DECLARADA_DOCUMENTAL);
      expect(relleno.fixedValue).toHaveLength(93);
    }
  });

  it('ESPACIOS produce un FieldSpec CONFIRMADO coherente con espacios', () => {
    const relleno = campo(
      spec({ hipotesisRellenoPat1: 'ESPACIOS' }),
      ID_REGISTRO_PAT_2,
      ID_CAMPO_PAT_RELLENO_PAT1,
    );
    expect(relleno.type).toBe('A');
    expect(relleno.padding).toEqual({ kind: 'SPACE_RIGHT' });
    expect(relleno.fixedValue).toBe(' '.repeat(93));
    expect(relleno.status).toBe('CONFIRMADA');
    expect(relleno.issues).toEqual(['PAT-1']);
    expect(relleno.source.nota).toContain('96');
    expect(relleno.source.nota).toContain('PC-01');
  });

  it('CEROS produce un FieldSpec coherente con ceros y sigue BLOQUEADA', () => {
    const relleno = campo(
      spec({ hipotesisRellenoPat1: 'CEROS' }),
      ID_REGISTRO_PAT_2,
      ID_CAMPO_PAT_RELLENO_PAT1,
    );
    expect(relleno.type).toBe('N');
    expect(relleno.padding).toEqual({ kind: 'ZERO_LEFT' });
    expect(relleno.fixedValue).toBe('0'.repeat(93));
    expect(relleno.status).toBe('BLOQUEADA');
    expect(relleno.issues).toEqual(['PAT-1']);
    expect(relleno.source.nota).toContain('96');
    expect(relleno.source.nota).toContain('histórica');
  });

  it('PC-01: 104–196 son exactamente 93 espacios y 197–200 es EMPRESA', () => {
    const archivo = spec({ hipotesisRellenoPat1: 'ESPACIOS' });
    const registro = archivo.records.find((r) => r.id === ID_REGISTRO_PAT_2);
    if (registro === undefined) {
      throw new Error('registro R2 ausente');
    }
    const relleno = campo(archivo, ID_REGISTRO_PAT_2, ID_CAMPO_PAT_RELLENO_PAT1);
    const empresa = registro.fields.find((f) => f.id === 'r2_numeroEmpresa');
    if (empresa === undefined) {
      throw new Error('campo de EMPRESA ausente');
    }

    expect(relleno.start).toBe(104);
    expect(relleno.end).toBe(196);
    expect(relleno.end - relleno.start + 1).toBe(93);
    expect(relleno.declaredLength).toBe(93);
    expect(relleno.fixedValue).toBe(' '.repeat(93));
    expect(new Set(relleno.fixedValue)).toEqual(new Set([' ']));

    expect(empresa.start).toBe(197);
    expect(empresa.end).toBe(200);
    expect(empresa.declaredLength).toBe(4);
    expect(empresa.type).toBe('N');
    expect(registro.recordLength).toBe(200);

    // No hay huecos: el relleno termina donde empieza EMPRESA y el registro cierra en 200.
    expect(relleno.end + 1).toBe(empresa.start);
    expect(empresa.end).toBe(registro.recordLength);
  });

  it('conserva la longitud documental 96 fuera de la geometría F4', () => {
    expect(PAT1_LONGITUD_DECLARADA_DOCUMENTAL).toBe(96);
    expect(PAT1_LONGITUD_GEOMETRICA).toBe(93);
    for (const registro of spec().records) {
      for (const f of registro.fields) {
        expect(f.declaredLength).not.toBe(96);
      }
    }
  });

  it('sin elección explícita de PAT-1 no crea spec', () => {
    expect(() =>
      crearSpecPatagoniaB2(undefined as unknown as ConfiguracionTecnicaPatagonia),
    ).toThrow();
    expect(() => crearRegistrosPatagonia(undefined as never)).toThrow();
  });
});

describe('spec Patagonia B.2 · PAT-2', () => {
  it('ALFANUMERICA está CONFIRMADA: A/SPACE_RIGHT en 85–99', () => {
    const dependencia = campo(
      spec({ hipotesisDependenciaPat2: 'ALFANUMERICA' }),
      ID_REGISTRO_PAT_2,
      ID_CAMPO_PAT_DEPENDENCIA,
    );
    expect(dependencia.start).toBe(85);
    expect(dependencia.end).toBe(99);
    expect(dependencia.declaredLength).toBe(15);
    expect(dependencia.type).toBe('A');
    expect(dependencia.padding).toEqual({ kind: 'SPACE_RIGHT' });
    expect(dependencia.fixedValue).toBeUndefined();
    expect(dependencia.status).toBe('CONFIRMADA');
    expect(dependencia.issues).toEqual(['PAT-2']);
    expect(dependencia.source.nota).toContain('PC-02');
    expect(dependencia.source.nota).toContain('alta');
  });

  it('NUMERICA se conserva como hipótesis histórica BLOQUEADA (N/ZERO_LEFT)', () => {
    const dependencia = campo(
      spec({ hipotesisDependenciaPat2: 'NUMERICA' }),
      ID_REGISTRO_PAT_2,
      ID_CAMPO_PAT_DEPENDENCIA,
    );
    expect(dependencia.start).toBe(85);
    expect(dependencia.end).toBe(99);
    expect(dependencia.declaredLength).toBe(15);
    expect(dependencia.type).toBe('N');
    expect(dependencia.padding).toEqual({ kind: 'ZERO_LEFT' });
    expect(dependencia.fixedValue).toBeUndefined();
    expect(dependencia.status).toBe('BLOQUEADA');
    expect(dependencia.issues).toEqual(['PAT-2']);
    expect(dependencia.source.nota).toContain('histórica');
  });

  it('PC-02: 85–99 son 15 posiciones y el registro conserva 200', () => {
    const archivo = spec({ hipotesisDependenciaPat2: 'ALFANUMERICA' });
    const registro = archivo.records.find((r) => r.id === ID_REGISTRO_PAT_2);
    if (registro === undefined) {
      throw new Error('registro R2 ausente');
    }
    const dependencia = campo(archivo, ID_REGISTRO_PAT_2, ID_CAMPO_PAT_DEPENDENCIA);
    expect(dependencia.start).toBe(PAT2_POSICION_INICIO);
    expect(dependencia.end).toBe(PAT2_POSICION_FIN);
    expect(dependencia.end - dependencia.start + 1).toBe(PAT2_LONGITUD);
    expect(dependencia.declaredLength).toBe(15);
    expect(registro.recordLength).toBe(200);
    expect(registro.fields.at(-1)?.end).toBe(200);
  });

  it('sin elección explícita de PAT-2 no crea spec', () => {
    expect(() =>
      crearSpecPatagoniaB2({
        ...BASE,
        hipotesisDependenciaPat2: undefined as unknown as HipotesisDependenciaPat2,
      }),
    ).toThrow();
  });
});

describe('spec Patagonia B.2 · PAT-14', () => {
  it.each([
    ['\n', false],
    ['\r\n', true],
  ] as const)('exige separadores explícitos (%j, %s) y los deja pendientes', (sep, final) => {
    const archivo = spec({ lineSeparator: sep, trailingSeparator: final });
    expect(archivo.lineSeparator).toEqual({
      value: sep,
      status: 'INTERPRETACION_PENDIENTE',
    });
    expect(archivo.trailingSeparator).toEqual({
      value: final,
      status: 'INTERPRETACION_PENDIENTE',
    });
    expect(archivo.charset).toBe('ASCII_PRINTABLE');
  });

  it('no infiere LF, CRLF ni salto final si el llamador no los elige', () => {
    expect(() =>
      crearSpecPatagoniaB2({
        ...BASE,
        lineSeparator: undefined as unknown as '\n',
      }),
    ).toThrow();
    expect(() =>
      crearSpecPatagoniaB2({
        ...BASE,
        trailingSeparator: undefined as unknown as boolean,
      }),
    ).toThrow();
  });
});

describe('spec Patagonia B.2 · hipótesis y contrato', () => {
  it.each([
    ['ESPACIOS', 'NUMERICA'],
    ['ESPACIOS', 'ALFANUMERICA'],
    ['CEROS', 'NUMERICA'],
    ['CEROS', 'ALFANUMERICA'],
  ] as const)(
    '(%s, %s): solo ESPACIOS confirma PAT-1 y solo ALFANUMERICA confirma PAT-2',
    (relleno: HipotesisRellenoPat1, dependencia: HipotesisDependenciaPat2) => {
      const archivo = spec({
        hipotesisRellenoPat1: relleno,
        hipotesisDependenciaPat2: dependencia,
      });
      expect(campo(archivo, ID_REGISTRO_PAT_2, ID_CAMPO_PAT_RELLENO_PAT1).status).toBe(
        relleno === 'ESPACIOS' ? 'CONFIRMADA' : 'BLOQUEADA',
      );
      expect(campo(archivo, ID_REGISTRO_PAT_2, ID_CAMPO_PAT_DEPENDENCIA).status).toBe(
        dependencia === 'ALFANUMERICA' ? 'CONFIRMADA' : 'BLOQUEADA',
      );
      expect(campo(archivo, ID_REGISTRO_PAT_2, ID_CAMPO_PAT_RELLENO_PAT1).issues).toEqual([
        'PAT-1',
      ]);
      expect(campo(archivo, ID_REGISTRO_PAT_2, ID_CAMPO_PAT_DEPENDENCIA).issues).toEqual(['PAT-2']);
    },
  );
});
