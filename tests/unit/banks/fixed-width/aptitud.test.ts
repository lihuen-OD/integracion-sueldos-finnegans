// Pruebas de aptitud (T4-10, CP-F4-C): `hallarBloqueosGeneracion` es el ÚNICO lector de
// ContractStatus (D-075). Determinista en orden de spec; INTERPRETACION_PENDIENTE no
// bloquea y NO se informa; la validez técnica no interviene.
import { describe, expect, it } from 'vitest';
import { hallarBloqueosGeneracion } from '../../../../src/banks/fixed-width/aptitud';
import type { FileSpec } from '../../../../src/banks/fixed-width';
import { en } from './archivoSpecs';
import { archivoSpec, estructuraInicial } from './archivoSpecs';

const baseSpec: FileSpec = archivoSpec(estructuraInicial(), '\n');

describe('hallarBloqueosGeneracion · sin bloqueos', () => {
  it('todo CONFIRMADA → sin bloqueos', () => {
    expect(hallarBloqueosGeneracion(baseSpec)).toEqual([]);
  });

  it('INTERPRETACION_PENDIENTE NO bloquea y NO se informa', () => {
    const spec: FileSpec = {
      ...baseSpec,
      lineSeparator: { value: '\n', status: 'INTERPRETACION_PENDIENTE' },
      trailingSeparator: { value: true, status: 'INTERPRETACION_PENDIENTE' },
    };
    expect(hallarBloqueosGeneracion(spec)).toEqual([]);
  });
});

describe('hallarBloqueosGeneracion · separadores', () => {
  it('lineSeparator BLOQUEADA', () => {
    const spec: FileSpec = {
      ...baseSpec,
      lineSeparator: { value: '\n', status: 'BLOQUEADA' },
    };
    expect(hallarBloqueosGeneracion(spec)).toEqual([{ tipo: 'lineSeparator' }]);
  });

  it('trailingSeparator BLOQUEADA', () => {
    const spec: FileSpec = {
      ...baseSpec,
      trailingSeparator: { value: true, status: 'BLOQUEADA' },
    };
    expect(hallarBloqueosGeneracion(spec)).toEqual([{ tipo: 'trailingSeparator' }]);
  });

  it('ambos separadores BLOQUEADA en orden congelado', () => {
    const spec: FileSpec = {
      ...baseSpec,
      lineSeparator: { value: '\n', status: 'BLOQUEADA' },
      trailingSeparator: { value: true, status: 'BLOQUEADA' },
    };
    expect(hallarBloqueosGeneracion(spec)).toEqual([
      { tipo: 'lineSeparator' },
      { tipo: 'trailingSeparator' },
    ]);
  });
});

describe('hallarBloqueosGeneracion · campos', () => {
  it('un campo BLOQUEADA por registro y campoId', () => {
    const cabecera = en(baseSpec.records, 0);
    const spec: FileSpec = {
      ...baseSpec,
      records: [
        {
          ...cabecera,
          fields: [
            en(cabecera.fields, 0),
            { ...en(cabecera.fields, 1), status: 'BLOQUEADA' },
            en(cabecera.fields, 2),
          ],
        },
        ...baseSpec.records.slice(1),
      ],
    };
    expect(hallarBloqueosGeneracion(spec)).toEqual([
      { tipo: 'campo', registroId: 'H', campoId: 'dato' },
    ]);
  });

  it('distingue el mismo campoId en dos registros distintos', () => {
    const spec: FileSpec = {
      ...baseSpec,
      records: baseSpec.records.map((registro) => ({
        ...registro,
        fields: registro.fields.map((campo) => ({
          ...campo,
          status: 'BLOQUEADA' as const,
        })),
      })),
    };
    const bloqueos = hallarBloqueosGeneracion(spec);
    const identidades = bloqueos
      .filter((b) => b.tipo === 'campo')
      .map((b) => `${b.registroId}.${b.campoId}`);
    expect(identidades).toContain('H.dato');
    expect(identidades).toContain('D.ref');
    expect(new Set(identidades).size).toBe(identidades.length);
  });

  it('orden congelado completo: separadores primero, luego campos por registro y orden declarativo', () => {
    const conBloqueos: FileSpec['records'] = baseSpec.records.map((registro, indice) => ({
      ...registro,
      fields: registro.fields.map((campo, posicion) => ({
        ...campo,
        status: (indice + posicion) % 3 === 0 ? ('BLOQUEADA' as const) : ('CONFIRMADA' as const),
      })),
    }));
    const spec: FileSpec = {
      ...baseSpec,
      lineSeparator: { value: '\n', status: 'BLOQUEADA' },
      trailingSeparator: { value: true, status: 'BLOQUEADA' },
      records: conBloqueos,
    };
    expect(hallarBloqueosGeneracion(spec)).toEqual([
      { tipo: 'lineSeparator' },
      { tipo: 'trailingSeparator' },
      { tipo: 'campo', registroId: 'H', campoId: 'marcaH' },
      { tipo: 'campo', registroId: 'D', campoId: 'imp' },
      { tipo: 'campo', registroId: 'C', campoId: 'resumen' },
    ]);
  });
});

describe('hallarBloqueosGeneracion · idempotencia y aislamiento', () => {
  it('dos llamadas devuelven resultados idénticos sin mutar la spec', () => {
    const a = hallarBloqueosGeneracion(baseSpec);
    const b = hallarBloqueosGeneracion(baseSpec);
    expect(a).toEqual(b);
    expect(en(baseSpec.records, 0).fields.every((campo) => campo.status === 'CONFIRMADA')).toBe(
      true,
    );
  });
});
