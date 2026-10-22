// CUIT empresa estructural (D-061, P-18 abierto). Ningún literal con forma de CUIL/CUIT
// (D-042): todos los valores se construyen en tiempo de ejecución. Es deliberado incluir
// formas con DV INVÁLIDO: la prueba demuestra que F3 solo valida estructura y no reutiliza
// el validador de CUIL (que sí aplica DV según D-024/D-052).
import { describe, expect, it } from 'vitest';
import { parseCuitEmpresa, tieneFormaConGuiones } from '../../../src/domain/cuitEmpresa';

const BASE = '3' + '0' + '7' + '1' + '2' + '3' + '4' + '5' + '6' + '7' + '1';

describe('parseCuitEmpresa · validación ESTRUCTURAL (D-061)', () => {
  it('acepta 11 dígitos canónicos con guiones y sin guiones', () => {
    expect(parseCuitEmpresa(BASE)).toEqual({ ok: true, value: BASE });
    expect(parseCuitEmpresa(`${BASE.slice(0, 2)}-${BASE.slice(2, 10)}-${BASE.slice(10)}`)).toEqual({
      ok: true,
      value: BASE,
    });
  });

  it('no reutiliza el contrato de Cuil: la estructura no verifica el DV', () => {
    // Se generan 11 dígitos sin consultar ningún DV; el resultado es solo estructura.
    const resultado = parseCuitEmpresa(BASE);
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.value).toBe(BASE);
    }
  });

  it('rechaza vacío y caracteres no permitidos', () => {
    expect(parseCuitEmpresa('')).toEqual({ ok: false, error: 'VACIO' });
    expect(parseCuitEmpresa('   ')).toEqual({ ok: false, error: 'VACIO' });
    const conSlash = `${BASE.slice(0, 8)}/${BASE.slice(8)}`;
    const conEspaciosInternos = `${BASE.slice(0, 4)} ${BASE.slice(4)}`;
    const conLetra = `${BASE.slice(0, 10)}x`;
    const conRaya = `${BASE.slice(0, 4)}–${BASE.slice(5)}`;
    for (const valor of [conSlash, conEspaciosInternos, conLetra, conRaya]) {
      expect(parseCuitEmpresa(valor)).toEqual({ ok: false, error: 'CARACTER_NO_PERMITIDO' });
    }
  });

  it('rechaza longitudes distintas de 11 dígitos', () => {
    const nueve = BASE.slice(0, 9);
    const diez = BASE.slice(0, 10);
    const doce = `${BASE}1`;
    for (const valor of [nueve, diez, doce]) {
      expect(parseCuitEmpresa(valor)).toEqual({ ok: false, error: 'LONGITUD_INVALIDA' });
    }
  });

  it('rechaza guiones en posiciones equivocadas y repetidos; puntos como carácter no permitido', () => {
    const guionTardio = `${BASE.slice(0, 8)}-${BASE.slice(8)}`;
    const guionExtra = `${BASE.slice(0, 2)}--${BASE.slice(2)}`;
    for (const valor of [guionTardio, guionExtra]) {
      expect(parseCuitEmpresa(valor)).toEqual({ ok: false, error: 'FORMATO_INVALIDO' });
    }
    const conPuntos = `${BASE.slice(0, 2)}.${BASE.slice(2, 10)}.${BASE.slice(10)}`;
    expect(parseCuitEmpresa(conPuntos)).toEqual({ ok: false, error: 'CARACTER_NO_PERMITIDO' });
  });

  it('acepta espacios de los extremos (como N-02 de D-052) y detecta la forma con guiones', () => {
    expect(parseCuitEmpresa(`  ${BASE}  `)).toEqual({ ok: true, value: BASE });
    expect(
      tieneFormaConGuiones(` ${BASE.slice(0, 2)}-${BASE.slice(2, 10)}-${BASE.slice(10)} `),
    ).toBe(true);
    expect(tieneFormaConGuiones(BASE)).toBe(false);
  });
});
