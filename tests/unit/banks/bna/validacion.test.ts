// Validaciones puras BNA (CP-F5-B): formato, longitudes de la spec, convenio BNA-5,
// fecha técnica sin calendario (BNA-7), número de envío y alfabeto BNA-8 sin transformar.
import { describe, expect, it } from 'vitest';
import {
  longitudCampoBna,
  validarAlfabetoBna,
  validarConvenioBna,
  validarDigitosBna,
  validarFechaCompensacionBna,
  validarMonedaBna,
  validarNumeroEnvioBna,
  validarTextoBna,
} from '../../../../src/banks/bna';

describe('validarConvenioBna · 4/8 y BNA-5', () => {
  it('convierte 4 dígitos a 00 + 4 + 0000 y 8 a 00 + 8', () => {
    expect(validarConvenioBna('4455')).toEqual({ ok: true, value: '0044550000' });
    expect(validarConvenioBna('44556677')).toEqual({ ok: true, value: '0044556677' });
    expect(validarConvenioBna('0044550000')).toEqual({
      ok: false,
      error: 'CONVENIO_LONGITUD_INVALIDA',
    });
  });

  it('distingue no numérico de longitudes 5/6/7 y de otras longitudes', () => {
    expect(validarConvenioBna('12A4')).toEqual({
      ok: false,
      error: 'CONVENIO_NO_NUMERICO',
    });
    expect(validarConvenioBna('')).toEqual({ ok: false, error: 'CONVENIO_NO_NUMERICO' });
    for (const codigo of ['12345', '123456', '1234567']) {
      expect(validarConvenioBna(codigo)).toEqual({
        ok: false,
        error: 'CONVENIO_LONGITUD_BNA5',
      });
    }
    for (const codigo of ['1', '123', '123456789']) {
      expect(validarConvenioBna(codigo)).toEqual({
        ok: false,
        error: 'CONVENIO_LONGITUD_INVALIDA',
      });
    }
  });
});

describe('validarAlfabetoBna y validarTextoBna · BNA-8', () => {
  it('acepta A-Z, 0-9, espacio y vacío sin transformar', () => {
    expect(validarAlfabetoBna('ABC 123')).toEqual({ ok: true, value: 'ABC 123' });
    expect(validarAlfabetoBna('')).toEqual({ ok: true, value: '' });
    expect(validarTextoBna('A'.repeat(15), 'r2_referencia')).toEqual({
      ok: true,
      value: 'A'.repeat(15),
    });
  });

  it.each([
    ['minúsculas', 'abc'],
    ['ñ', 'AÑO'],
    ['acento', 'ÁRBOL'],
    ['tabulación', 'A\tB'],
    ['CR', 'A\rB'],
    ['LF', 'A\nB'],
    ['no ASCII', '€'],
    ['guion', 'A-B'],
  ])('rechaza %s sin transformarlo', (_nombre, texto) => {
    expect(validarAlfabetoBna(texto)).toEqual({
      ok: false,
      error: 'ALFABETO_BNA8_INVALIDO',
    });
  });

  it('usa la longitud declarada de la spec', () => {
    expect(validarTextoBna('A'.repeat(16), 'r2_referencia')).toEqual({
      ok: false,
      error: 'LONGITUD_EXCEDIDA',
    });
    expect(validarTextoBna('A'.repeat(21), 'r1_infoCriterioEmpresa')).toEqual({
      ok: false,
      error: 'LONGITUD_EXCEDIDA',
    });
  });
});

describe('validarDigitosBna · N', () => {
  it('acepta dígitos y rechaza letras o exceso de longitud', () => {
    expect(validarDigitosBna('0001', 'r2_sucursal')).toEqual({ ok: true, value: '0001' });
    expect(validarDigitosBna('', 'r2_sucursal')).toEqual({
      ok: false,
      error: 'DIGITO_INVALIDO',
    });
    expect(validarDigitosBna('00A1', 'r2_sucursal')).toEqual({
      ok: false,
      error: 'DIGITO_INVALIDO',
    });
    expect(validarDigitosBna('12345', 'r2_sucursal')).toEqual({
      ok: false,
      error: 'LONGITUD_EXCEDIDA',
    });
  });
});

describe('validarFechaCompensacionBna · solo forma técnica', () => {
  it('acepta 8 dígitos y rechaza formatos con separadores o letras', () => {
    expect(validarFechaCompensacionBna('20261030')).toEqual({
      ok: true,
      value: '20261030',
    });
    expect(validarFechaCompensacionBna('2026-10-30')).toEqual({
      ok: false,
      error: 'FECHA_COMPENSACION_INVALIDA',
    });
    expect(validarFechaCompensacionBna('2026103A')).toEqual({
      ok: false,
      error: 'FECHA_COMPENSACION_INVALIDA',
    });
    expect(validarFechaCompensacionBna('2026103')).toEqual({
      ok: false,
      error: 'FECHA_COMPENSACION_INVALIDA',
    });
  });

  it('no valida calendario: 20261399 sigue siendo una entrada explícita (BNA-7 abierta)', () => {
    expect(validarFechaCompensacionBna('20261399').ok).toBe(true);
  });
});

describe('validarNumeroEnvioBna y validarMonedaBna', () => {
  it('acepta hasta 6 dígitos y rechaza vacío, letras o 7 dígitos', () => {
    expect(validarNumeroEnvioBna('1')).toEqual({ ok: true, value: '1' });
    expect(validarNumeroEnvioBna('123456')).toEqual({ ok: true, value: '123456' });
    expect(validarNumeroEnvioBna('1234567')).toEqual({
      ok: false,
      error: 'NUMERO_ENVIO_INVALIDO',
    });
    expect(validarNumeroEnvioBna('1A')).toEqual({
      ok: false,
      error: 'NUMERO_ENVIO_INVALIDO',
    });
    expect(validarNumeroEnvioBna('')).toEqual({
      ok: false,
      error: 'NUMERO_ENVIO_INVALIDO',
    });
  });

  it('solo acepta moneda 0 o 1', () => {
    expect(validarMonedaBna('0')).toEqual({ ok: true, value: '0' });
    expect(validarMonedaBna('1')).toEqual({ ok: true, value: '1' });
    expect(validarMonedaBna('2')).toEqual({ ok: false, error: 'MONEDA_INVALIDA' });
    expect(validarMonedaBna('')).toEqual({ ok: false, error: 'MONEDA_INVALIDA' });
  });
});

describe('longitudCampoBna · fuente única de geometría', () => {
  it('devuelve longitudes documentadas de la spec', () => {
    expect(longitudCampoBna('r2_entidad')).toBe(4);
    expect(longitudCampoBna('r2_importe')).toBe(10);
    expect(longitudCampoBna('r1_codigoConvenio')).toBe(10);
    expect(longitudCampoBna('r3_totalImporte')).toBe(15);
  });

  it('falla explícitamente si se pide un campo inexistente', () => {
    expect(() => longitudCampoBna('no_existe')).toThrow('campo BNA inexistente');
  });
});
