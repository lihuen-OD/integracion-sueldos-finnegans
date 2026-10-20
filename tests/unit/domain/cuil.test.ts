// Todos los CUIL de prueba se generan en tiempo de ejecución (D-042): ningún literal con forma
// de CUIL en este archivo. El oráculo es la implementación independiente de los fixtures.
import { describe, expect, it } from 'vitest';
import { formatearCuil, parseCuil, type Cuil } from '../../../src/domain/cuil';
import { createRandom, randomInt, syntheticCuil } from '../../fixtures/synthetic/identities.ts';

const PREFIJOS = ['20', '23', '24', '27', '30', '33', '34', '12'] as const;

/** CUIL válidos (con guiones) generados con el oráculo. */
function cuilesValidos(cantidad: number, semilla: number): string[] {
  const random = createRandom(semilla);
  const resultado: string[] = [];
  while (resultado.length < cantidad) {
    const prefijo = PREFIJOS[randomInt(random, 0, PREFIJOS.length - 1)] ?? '20';
    const cuil = syntheticCuil(prefijo, randomInt(random, 10_000, 99_999_999));
    if (cuil !== null) {
      resultado.push(cuil);
    }
  }
  return resultado;
}

function valido(texto: string): Cuil {
  const resultado = parseCuil(texto);
  if (!resultado.ok) {
    throw new Error(`CUIL sintético rechazado: ${resultado.error}`);
  }
  return resultado.value;
}

describe('parseCuil · dígito verificador (D-024, fuente oficial pendiente P-18)', () => {
  it('coincide con el oráculo para 2.000 bases y los 10 DV posibles de cada una', () => {
    const random = createRandom(11);
    let noAsignables = 0;
    for (let i = 0; i < 2_000; i += 1) {
      const prefijo = PREFIJOS[i % PREFIJOS.length] ?? '20';
      const dni = randomInt(random, 0, 99_999_999);
      const base = `${prefijo}${String(dni).padStart(8, '0')}`;
      const oraculo = syntheticCuil(prefijo, dni);
      if (oraculo === null) {
        noAsignables += 1;
      }
      for (let dv = 0; dv <= 9; dv += 1) {
        const resultado = parseCuil(`${base}${String(dv)}`);
        if (oraculo === null) {
          expect(resultado).toEqual({ ok: false, error: 'DV_NO_ASIGNABLE' });
        } else if (oraculo.endsWith(`-${String(dv)}`)) {
          expect(resultado).toEqual({ ok: true, value: `${base}${String(dv)}` });
        } else {
          expect(resultado).toEqual({ ok: false, error: 'DV_INVALIDO' });
        }
      }
    }
    // Con resto uniforme, ~1/11 de las bases no admite DV: el caso queda ejercitado.
    expect(noAsignables).toBeGreaterThan(100);
  });

  it('no aplica reglas de prefijo (D-050): cualquier prefijo con DV válido se acepta', () => {
    for (const prefijo of PREFIJOS) {
      const random = createRandom(Number(prefijo));
      let cuil: string | null = null;
      while (cuil === null) {
        cuil = syntheticCuil(prefijo, randomInt(random, 10_000, 99_999));
      }
      expect(parseCuil(cuil).ok).toBe(true);
    }
  });

  it('detecta toda sustitución de un solo dígito', () => {
    for (const cuil of cuilesValidos(60, 3)) {
      const digitos = cuil.replaceAll('-', '');
      for (let posicion = 0; posicion < 11; posicion += 1) {
        for (let digito = 0; digito <= 9; digito += 1) {
          if (String(digito) === digitos[posicion]) {
            continue;
          }
          const alterado =
            digitos.slice(0, posicion) + String(digito) + digitos.slice(posicion + 1);
          expect(parseCuil(alterado).ok).toBe(false);
        }
      }
    }
  });
});

describe('parseCuil · N-02 estricta (D-052): solo dos representaciones', () => {
  const [conGuiones = ''] = cuilesValidos(1, 5);
  const canonico = conGuiones.replaceAll('-', '');
  /** Bloques del CUIL sintético: prefijo (2), documento (8) y DV (1). */
  const [p, d, v] = [canonico.slice(0, 2), canonico.slice(2, 10), canonico.slice(10)];

  it.each([
    ['canónica', () => canonico],
    ['con guiones XX-XXXXXXXX-X', () => conGuiones],
    ['con guiones y espacios U+0020 en los extremos', () => '  ' + conGuiones + '  '],
    ['canónica con espacios U+0020 en los extremos', () => ' ' + canonico + ' '],
  ])('acepta la forma %s y produce el Cuil canónico', (_caso, texto) => {
    expect(parseCuil(texto())).toEqual({ ok: true, value: canonico });
  });

  it.each([
    [
      'guiones en otra posición (3-7-1)',
      () => canonico.slice(0, 3) + '-' + canonico.slice(3, 10) + '-' + v,
    ],
    ['guiones en otra posición (2-9)', () => p + '-' + canonico.slice(2)],
    ['un solo guion', () => p + '-' + d + v],
    ['guion final', () => canonico + '-'],
    ['guion inicial', () => '-' + canonico],
    ['guiones duplicados', () => p + '--' + d + '-' + v],
    ['guiones repetidos en ambos bloques', () => p + '--' + d + '--' + v],
  ])('rechaza dígitos y guiones fuera de forma: %s', (_caso, texto) => {
    expect(parseCuil(texto())).toEqual({ ok: false, error: 'FORMATO_INVALIDO' });
  });

  it.each([
    ['espacios internos en lugar de guiones', () => p + ' ' + d + ' ' + v],
    ['espacios alrededor de los guiones', () => p + ' - ' + d + ' - ' + v],
    [
      'un espacio interno en la forma canónica',
      () => canonico.slice(0, 5) + ' ' + canonico.slice(5),
    ],
    ['tab', () => p + '\t' + d + '\t' + v],
    ['tab en un extremo', () => '\t' + conGuiones],
    ['NBSP', () => p + '\u00a0' + d + '\u00a0' + v],
    ['NBSP en un extremo', () => conGuiones + '\u00a0'],
    ['espacio angosto', () => p + '\u202f' + d + '\u202f' + v],
    ['punto', () => p + '.' + d + '.' + v],
    ['barra', () => p + '/' + d + '/' + v],
    ['guion bajo', () => p + '_' + d + '_' + v],
    ['raya Unicode', () => p + '\u2013' + d + '\u2013' + v],
    ['signo menos Unicode', () => p + '\u2212' + d + '\u2212' + v],
    ['letra', () => canonico.slice(0, 10) + 'x'],
  ])('rechaza un separador o carácter no aprobado: %s', (_caso, texto) => {
    expect(parseCuil(texto())).toEqual({ ok: false, error: 'CARACTER_NO_PERMITIDO' });
  });

  it('rechaza dígitos no ASCII', () => {
    const anchos = canonico.replace(/[0-9]/g, (digito) =>
      String.fromCharCode(0xff10 + digito.charCodeAt(0) - 48),
    );
    expect(parseCuil(anchos)).toEqual({ ok: false, error: 'CARACTER_NO_PERMITIDO' });
  });

  it.each([
    ['vacío', () => '', 'VACIO'],
    ['solo espacios U+0020', () => '   ', 'VACIO'],
    ['solo guiones', () => '--', 'FORMATO_INVALIDO'],
    ['10 dígitos', () => canonico.slice(0, 10), 'LONGITUD_INVALIDA'],
    ['12 dígitos', () => canonico + '0', 'LONGITUD_INVALIDA'],
    [
      'con guiones pero un dígito de menos',
      () => p + '-' + d.slice(1) + '-' + v,
      'FORMATO_INVALIDO',
    ],
  ])('rechaza %s', (_caso, texto, error) => {
    expect(parseCuil(texto())).toEqual({ ok: false, error });
  });

  it('valida el DV después de validar la forma, en ambas representaciones', () => {
    const otroDv = String((Number(v) + 1) % 10);
    for (const texto of [p + '-' + d + '-' + otroDv, ' ' + p + d + otroDv]) {
      expect(parseCuil(texto).ok).toBe(false);
    }
  });

  it('el error nunca contiene el valor leído', () => {
    const resultado = parseCuil(canonico.slice(0, 10) + 'x');
    expect(JSON.stringify(resultado)).not.toContain(d);
  });
});

describe('formatearCuil', () => {
  it('muestra PP-DDDDDDDD-V y vuelve al mismo Cuil canónico', () => {
    for (const cuil of cuilesValidos(200, 9)) {
      const canonico = valido(cuil);
      expect(formatearCuil(canonico)).toBe(cuil);
      expect(parseCuil(formatearCuil(canonico))).toEqual({ ok: true, value: canonico });
    }
  });
});
