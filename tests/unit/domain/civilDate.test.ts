// CivilDate (D-044, F3): fecha civil sin timezone con representación canónica YYYY-MM-DD.
// El oráculo de calendario se computa con la Date nativa SOLO en los tests: se garantiza así
// que la implementación del dominio es independiente del oráculo.
import { describe, expect, it } from 'vitest';
import {
  civilDateCanonico,
  esBisiesto,
  partesDeCivilDate,
  parseCivilDate,
  serializarCivilDate,
  type CivilDate,
} from '../../../src/domain/civilDate';

function diasEnMesOraculo(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

function fechaValidaOraculo(anio: number, mes: number, dia: number): boolean {
  return (
    anio >= 0 &&
    anio <= 9999 &&
    mes >= 1 &&
    mes <= 12 &&
    dia >= 1 &&
    dia <= diasEnMesOraculo(anio, mes)
  );
}

function canonica(anio: number, mes: number, dia: number): string {
  return `${String(anio).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

describe('CivilDate · calendario real (D-044)', () => {
  it('coincide con el oráculo para todos los meses del rango de años 1900–2100', () => {
    for (let anio = 1900; anio <= 2100; anio += 1) {
      for (let mes = 1; mes <= 12; mes += 1) {
        for (const dia of [diasEnMesOraculo(anio, mes) - 1, diasEnMesOraculo(anio, mes)]) {
          const resultado = civilDateCanonico(anio, mes, dia);
          if (dia >= 1) {
            expect(resultado).toEqual({ ok: true, value: canonica(anio, mes, dia) });
          } else {
            expect(resultado).toEqual({ ok: false, error: 'DIA_FUERA_DE_RANGO' });
          }
        }
      }
    }
  });

  it('valida los bisiestos de 1900-2100 con la regla de los siglos', () => {
    expect(esBisiesto(2000)).toBe(true);
    expect(esBisiesto(1900)).toBe(false);
    expect(esBisiesto(2100)).toBe(false);
    expect(esBisiesto(2024)).toBe(true);
    expect(esBisiesto(2025)).toBe(false);
    for (let anio = 1900; anio <= 2100; anio += 1) {
      expect(civilDateCanonico(anio, 2, esBisiesto(anio) ? 29 : 28).ok).toBe(true);
      expect(civilDateCanonico(anio, 2, esBisiesto(anio) ? 30 : 29)).toEqual({
        ok: false,
        error: 'DIA_FUERA_DE_RANGO',
      });
    }
  });

  it('coincide con el oráculo para fechas aleatorias válidas e inválidas', () => {
    let semilla = 97;
    const random = (limite: number) => {
      semilla = (semilla * 1103515245 + 12345) % 2147483648;
      return ((semilla >>> 3) % limite) + 1;
    };
    for (let i = 0; i < 2_000; i += 1) {
      const anio = random(1200) + 1800;
      const mes = random(14);
      const dia = random(33);
      const resultado = civilDateCanonico(anio, mes, dia);
      const esperada = fechaValidaOraculo(anio, mes, dia)
        ? { ok: true as const, value: canonica(anio, mes, dia) }
        : {
            ok: false as const,
            error: mes < 1 || mes > 12 ? 'MES_FUERA_DE_RANGO' : 'DIA_FUERA_DE_RANGO',
          };
      expect(resultado).toEqual(esperada);
    }
  });
});

describe('CivilDate · parse y serialización', () => {
  it('acepta únicamente la forma canónica exacta, ESTRICTO: sin espacios (D-044)', () => {
    expect(parseCivilDate('2025-02-28')).toEqual({ ok: true, value: '2025-02-28' });
    expect(parseCivilDate('2024-02-29')).toEqual({ ok: true, value: '2024-02-29' });
    // Estricto (FIX 4): no se normaliza ni se hace trim.
    for (const invalido of [
      ' 2025-02-28 ',
      '2025-02-28 ',
      ' 2025-02-28',
      '\t2025-02-28',
      '2025-2-28',
      '25-02-28',
      '2025/02/28',
      '20250228',
      '2025-02-28T00:00',
      'abc',
      '',
    ]) {
      expect(parseCivilDate(invalido)).toEqual({
        ok: false,
        error: invalido === '' ? 'VACIO' : 'FORMATO_INVALIDO',
      });
    }
    expect(parseCivilDate('2025-13-01')).toEqual({ ok: false, error: 'MES_FUERA_DE_RANGO' });
    expect(parseCivilDate('2025-00-10')).toEqual({ ok: false, error: 'MES_FUERA_DE_RANGO' });
    expect(parseCivilDate('2025-04-31')).toEqual({ ok: false, error: 'DIA_FUERA_DE_RANGO' });
    expect(parseCivilDate('2025-02-30')).toEqual({ ok: false, error: 'DIA_FUERA_DE_RANGO' });
  });

  it('el round-trip es identidad y la representación es inmutable sin Date nativa', () => {
    const parseada = parseCivilDate('2025-02-28');
    if (!parseada.ok) {
      throw new Error('fecha sintética rechazada');
    }
    const fecha: CivilDate = parseada.value;
    expect(serializarCivilDate(fecha)).toBe('2025-02-28');
    expect(partesDeCivilDate(fecha)).toEqual({ anio: 2025, mes: 2, dia: 28 });
    expect(parseCivilDate(serializarCivilDate(fecha))).toEqual({ ok: true, value: fecha });
  });
});
