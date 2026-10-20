// Todos los CBU de prueba se generan en tiempo de ejecución (D-042) con el oráculo
// independiente de los fixtures: ningún literal con forma de CBU en este archivo.
import { describe, expect, it } from 'vitest';
import { entidadCbu, parseCbu, type Cbu } from '../../../src/domain/cbu';
import {
  createRandom,
  randomInt,
  syntheticCbu,
  syntheticCuenta,
} from '../../fixtures/synthetic/identities.ts';

function partesAleatorias(random: () => number): [string, string, string] {
  const entidad = String(randomInt(random, 0, 999)).padStart(3, '0');
  const sucursal = String(randomInt(random, 0, 9999)).padStart(4, '0');
  return [entidad, sucursal, syntheticCuenta(random)];
}

function cbusValidos(cantidad: number, semilla: number): string[] {
  const random = createRandom(semilla);
  return Array.from({ length: cantidad }, () => syntheticCbu(...partesAleatorias(random)));
}

describe('parseCbu · dígitos verificadores (D-024, fuente oficial pendiente P-18)', () => {
  it('acepta 2.000 CBU generados por el oráculo y extrae la entidad', () => {
    const random = createRandom(21);
    for (let i = 0; i < 2_000; i += 1) {
      const [entidad, sucursal, cuenta] = partesAleatorias(random);
      const cbu = syntheticCbu(entidad, sucursal, cuenta);
      const resultado = parseCbu(cbu);
      expect(resultado).toEqual({ ok: true, value: cbu });
      expect(entidadCbu(cbu as Cbu)).toBe(entidad);
    }
  });

  it('coincide con el oráculo para las 100 combinaciones de DV de 300 bases', () => {
    for (const cbu of cbusValidos(300, 22)) {
      const dv1 = cbu[7];
      const dv2 = cbu[21];
      for (let d1 = 0; d1 <= 9; d1 += 1) {
        for (let d2 = 0; d2 <= 9; d2 += 1) {
          const candidato = `${cbu.slice(0, 7)}${String(d1)}${cbu.slice(8, 21)}${String(d2)}`;
          const esperado =
            String(d1) !== dv1
              ? { ok: false, error: 'DV_BLOQUE_1_INVALIDO' }
              : String(d2) !== dv2
                ? { ok: false, error: 'DV_BLOQUE_2_INVALIDO' }
                : { ok: true, value: candidato };
          expect(parseCbu(candidato)).toEqual(esperado);
        }
      }
    }
  });

  it('detecta toda sustitución de un solo dígito, en cualquiera de los dos bloques', () => {
    for (const cbu of cbusValidos(60, 23)) {
      for (let posicion = 0; posicion < 22; posicion += 1) {
        for (let digito = 0; digito <= 9; digito += 1) {
          if (String(digito) === cbu[posicion]) {
            continue;
          }
          const alterado = cbu.slice(0, posicion) + String(digito) + cbu.slice(posicion + 1);
          const resultado = parseCbu(alterado);
          expect(resultado.ok).toBe(false);
          if (!resultado.ok) {
            expect(resultado.error).toBe(
              posicion < 8 ? 'DV_BLOQUE_1_INVALIDO' : 'DV_BLOQUE_2_INVALIDO',
            );
          }
        }
      }
    }
  });
});

describe('parseCbu · sin normalización (D-046)', () => {
  const [cbu = ''] = cbusValidos(1, 24);

  it.each([
    ['espacio en los extremos', () => ` ${cbu}`],
    ['espacio final', () => `${cbu} `],
    ['bloques 8 + 14 con guion', () => `${cbu.slice(0, 8)}-${cbu.slice(8)}`],
    ['bloques 8 + 14 con espacio', () => `${cbu.slice(0, 8)} ${cbu.slice(8)}`],
    ['NBSP', () => `${cbu.slice(0, 8)}\u00a0${cbu.slice(8)}`],
    ['tab', () => `${cbu}\t`],
    ['punto', () => `${cbu.slice(0, 11)}.${cbu.slice(11)}`],
    ['letra', () => `${cbu.slice(0, 21)}x`],
  ])('rechaza el CBU con %s', (_caso, texto) => {
    expect(parseCbu(texto())).toEqual({ ok: false, error: 'CARACTER_NO_PERMITIDO' });
  });

  it.each([
    ['vacío', () => '', 'VACIO'],
    ['21 dígitos', () => cbu.slice(0, 21), 'LONGITUD_INVALIDA'],
    ['23 dígitos', () => `${cbu}0`, 'LONGITUD_INVALIDA'],
  ])('rechaza %s', (_caso, texto, error) => {
    expect(parseCbu(texto())).toEqual({ ok: false, error });
  });

  it('el error nunca contiene el valor leído', () => {
    const resultado = parseCbu(`${cbu.slice(0, 21)}x`);
    expect(JSON.stringify(resultado)).not.toContain(cbu.slice(8, 20));
  });
});
