// Identificación de registros en runtime (T4-3/D-070): filtro por longitud + discriminadores
// derivados de TODOS los fixedValue; 0 → REGISTRO_DESCONOCIDO, 1 → identificado,
// >1 → REGISTRO_AMBIGUO (defensa incluso ante specs que la validación estática rechazaría).
import { describe, expect, it } from 'vitest';
import { identificarRegistro } from '../../../../src/banks/fixed-width';
import type { RecordSpec } from '../../../../src/banks/fixed-width';
import { bytesDe } from './auxiliares';
import { campo, fijo, registro } from './specsSinteticas';

// Dos specs sintéticas de distinta longitud, cada una con su discriminador.
const CORTO = registro('CORTO', 8, [fijo('D', 1, 2, 'AB'), campo('V', 3, 8)]);
const LARGO = registro('LARGO', 12, [fijo('D', 1, 2, 'CD'), campo('V', 3, 12)]);

describe('identificarRegistro', () => {
  it('filtra primero por longitud (reg.12B no coincide con ambiente de 8B)', () => {
    const matches = identificarRegistro([CORTO, LARGO], bytesDe('CD' + 'x'.repeat(10)));
    expect(matches).toEqual({ ok: true, value: LARGO });
  });

  it('identifica 1 coincidencia', () => {
    expect(identificarRegistro([CORTO, LARGO], bytesDe('AB000067'))).toEqual({
      ok: true,
      value: CORTO,
    });
  });

  it('0 coincidencias por length → REGISTRO_DESCONOCIDO', () => {
    expect(identificarRegistro([CORTO], bytesDe('a'.repeat(9)))).toEqual({
      ok: false,
      error: { codigo: 'REGISTRO_DESCONOCIDO' },
    });
  });

  it('0 coincidencias por discriminador → REGISTRO_DESCONOCIDO', () => {
    expect(identificarRegistro([CORTO], bytesDe('XY123456'))).toEqual({
      ok: false,
      error: { codigo: 'REGISTRO_DESCONOCIDO' },
    });
  });

  it('defensa: >1 coincidencia → REGISTRO_AMBIGUO con ids aún con spec no validada', () => {
    const duplicadoA = registro('DUP_A', 8, [fijo('D', 1, 2, 'AB'), campo('V', 3, 8)]);
    const duplicadoB = registro('DUP_B', 8, [fijo('D', 1, 2, 'AB'), campo('V', 3, 8)]);
    const parAmbiguo: readonly RecordSpec[] = [duplicadoA, duplicadoB];
    expect(identificarRegistro(parAmbiguo, bytesDe('AB333333'))).toEqual({
      ok: false,
      error: { codigo: 'REGISTRO_AMBIGUO', registros: ['DUP_A', 'DUP_B'] },
    });
  });

  it('defensa: un record sin ningún fixedValue nunca produce coincidencia vacía', () => {
    const sinDisco = registro('SIN_D', 8, [campo('V', 1, 8)]);
    expect(identificarRegistro([sinDisco], bytesDe('ABCDEFGH'))).toEqual({
      ok: false,
      error: { codigo: 'REGISTRO_DESCONOCIDO' },
    });
  });

  it('longitudes heterogéneas dentro del mismo FileSpec (D-069)', () => {
    const bytes12 = bytesDe('CD' + 'Z'.repeat(10));
    const resultado = identificarRegistro([CORTO, LARGO], bytes12);
    expect(resultado.ok && resultado.value.recordLength).toBe(12);
    const bytes8 = bytesDe('AB1.6   ');
    const corto = identificarRegistro([CORTO, LARGO], bytes8);
    expect(corto.ok && corto.value.recordLength).toBe(8);
  });
});
