// Validaciones puras: formas técnicas documentadas, sin Date/calendario, sin transformar
// y con las longitudes tomadas de la spec.
import { describe, expect, it } from 'vitest';
import {
  TIPO_DOCUMENTO_CONFIRMADO_PATAGONIA,
  longitudCampoPatagonia,
  validarCodigoBancoPatagonia,
  validarCodigoSucursalPatagonia,
  validarComprobantePatagonia,
  validarConceptoPatagonia,
  validarDependenciaPatagonia,
  validarFechaPatagonia,
  validarNombrePatagonia,
  validarNumeroCuentaPatagonia,
  validarNumeroDocumentoPatagonia,
  validarNumeroEmpresaPatagonia,
  validarNumeroEnvioPatagonia,
  validarProvinciaDocumentoPatagonia,
  validarProvinciaNoAplicaPatagonia,
  validarTextoAsciiPatagonia,
  validarTipoCuentaPatagonia,
  validarTipoDocumentoFlujoConfirmadoPatagonia,
  validarTipoDocumentoPatagonia,
  validarTipoLiquidacionPatagonia,
  validarVersionPatagonia,
} from '../../../../src/banks/patagonia-b2';

function ok(resultado: { ok: boolean }): void {
  expect(resultado.ok).toBe(true);
}
function falla(resultado: { ok: boolean; error?: string }, error: string): void {
  expect(resultado).toEqual({ ok: false, error });
}

describe('validaciones Patagonia · geometría', () => {
  it('toma las longitudes de la spec canónica', () => {
    expect(longitudCampoPatagonia('r2_importeNeto')).toBe(11);
    expect(longitudCampoPatagonia('r1_importeLote')).toBe(15);
    expect(longitudCampoPatagonia('r0_importeLotes')).toBe(15);
    expect(longitudCampoPatagonia('r2_apellidoNombre')).toBe(20);
    expect(longitudCampoPatagonia('r1_cantidadLote')).toBe(3);
    expect(longitudCampoPatagonia('r0_cantidadLotes')).toBe(4);
  });

  it('falla explícitamente para un campo inexistente', () => {
    expect(() => longitudCampoPatagonia('r2_noExiste')).toThrow('campo Patagonia inexistente');
  });
});

describe('validaciones Patagonia · campos de envío', () => {
  it('numeroEmpresa admite 1–4 dígitos sin rellenar', () => {
    ok(validarNumeroEmpresaPatagonia('1'));
    ok(validarNumeroEmpresaPatagonia('1234'));
    for (const valor of ['', '12A4', '12345', ' 123', '123 ']) {
      falla(validarNumeroEmpresaPatagonia(valor), 'NUMERO_EMPRESA_INVALIDO');
    }
  });

  it('fecha valida solo forma AAAAMMDD, no calendario', () => {
    ok(validarFechaPatagonia('20261030'));
    ok(validarFechaPatagonia('20261301'));
    for (const valor of ['2026103', '2026-10-30', '']) {
      falla(validarFechaPatagonia(valor), 'FECHA_INVALIDA');
    }
  });

  it('numeroEnvio no impone 1–70 y sí prohíbe 99', () => {
    for (const valor of ['1', '00', '70', '71']) {
      ok(validarNumeroEnvioPatagonia(valor));
    }
    falla(validarNumeroEnvioPatagonia('99'), 'NUMERO_ENVIO_PROHIBIDO');
    for (const valor of ['', '100', 'A']) {
      falla(validarNumeroEnvioPatagonia(valor), 'NUMERO_ENVIO_INVALIDO');
    }
  });

  it('concepto admite ASCII imprimible, no vacío y hasta 10', () => {
    ok(validarConceptoPatagonia('HAB.05/00'));
    falla(validarConceptoPatagonia(''), 'TEXTO_VACIO');
    falla(validarConceptoPatagonia('12345678901'), 'LONGITUD_EXCEDIDA');
    falla(validarConceptoPatagonia('HAB\t05'), 'CARACTER_NO_ASCII');
  });
});

describe('validaciones Patagonia · cuenta y documento', () => {
  it('tipoCuenta solo 1 o 2', () => {
    ok(validarTipoCuentaPatagonia('1'));
    ok(validarTipoCuentaPatagonia('2'));
    falla(validarTipoCuentaPatagonia('3'), 'TIPO_CUENTA_INVALIDO');
  });

  it('numeroCuenta: 1–10 dígitos', () => {
    ok(validarNumeroCuentaPatagonia('1'));
    ok(validarNumeroCuentaPatagonia('0000001234'));
    falla(validarNumeroCuentaPatagonia(''), 'DIGITO_INVALIDO');
    falla(validarNumeroCuentaPatagonia('12345678901'), 'LONGITUD_INVALIDA');
    falla(validarNumeroCuentaPatagonia('123A'), 'DIGITO_INVALIDO');
  });

  it('codigoBanco exige exactamente 3 dígitos y no impone 034', () => {
    ok(validarCodigoBancoPatagonia('034'));
    ok(validarCodigoBancoPatagonia('007'));
    falla(validarCodigoBancoPatagonia('34'), 'LONGITUD_INVALIDA');
    falla(validarCodigoBancoPatagonia('03A'), 'DIGITO_INVALIDO');
  });

  it('codigoSucursal: 1–5 dígitos', () => {
    ok(validarCodigoSucursalPatagonia('1'));
    ok(validarCodigoSucursalPatagonia('00001'));
    falla(validarCodigoSucursalPatagonia('000001'), 'LONGITUD_INVALIDA');
  });

  it('tipoDocumento usa Anexo I PAT-DR e incluye 004 (PAT-8 abierta)', () => {
    for (const valor of ['001', '002', '003', '004', '006']) {
      ok(validarTipoDocumentoPatagonia(valor));
    }
    falla(validarTipoDocumentoPatagonia('005'), 'TIPO_DOCUMENTO_INVALIDO');
  });

  it('flujo confirmado PAT-8: solo 001 se habilita', () => {
    expect(TIPO_DOCUMENTO_CONFIRMADO_PATAGONIA).toBe('001');
    ok(validarTipoDocumentoFlujoConfirmadoPatagonia('001'));
  });

  it('flujo confirmado PAT-8: 002/003/004/006 son conocidos pero no confirmados', () => {
    for (const valor of ['002', '003', '004', '006']) {
      ok(validarTipoDocumentoPatagonia(valor));
      falla(validarTipoDocumentoFlujoConfirmadoPatagonia(valor), 'TIPO_DOCUMENTO_NO_CONFIRMADO');
    }
  });

  it('flujo confirmado PAT-8: fuera del catálogo es inválido', () => {
    for (const valor of ['005', '000', '007', '']) {
      falla(validarTipoDocumentoFlujoConfirmadoPatagonia(valor), 'TIPO_DOCUMENTO_INVALIDO');
    }
  });

  it('numeroDocumento: 1–17 dígitos', () => {
    ok(validarNumeroDocumentoPatagonia('1'));
    ok(validarNumeroDocumentoPatagonia('1'.repeat(17)));
    falla(validarNumeroDocumentoPatagonia('1'.repeat(18)), 'LONGITUD_INVALIDA');
  });

  it('provincia exige Anexo II solo cuando corresponde', () => {
    ok(validarProvinciaDocumentoPatagonia('01'));
    ok(validarProvinciaDocumentoPatagonia('40'));
    falla(validarProvinciaDocumentoPatagonia('00'), 'PROVINCIA_INVALIDA');
    falla(validarProvinciaDocumentoPatagonia('99'), 'PROVINCIA_INVALIDA');
  });

  it('PAT-4 no decide 00 vs espacios: la política debe dar 2 dígitos', () => {
    ok(validarProvinciaNoAplicaPatagonia('00'));
    ok(validarProvinciaNoAplicaPatagonia('99'));
    falla(validarProvinciaNoAplicaPatagonia('  '), 'PROVINCIA_INVALIDA');
    falla(validarProvinciaNoAplicaPatagonia('0'), 'PROVINCIA_INVALIDA');
  });

  it('PAT-2 ALFANUMERICA: solo letras ASCII y dígitos, conserva la caja', () => {
    ok(validarDependenciaPatagonia('DEP001', 'ALFANUMERICA'));
    ok(validarDependenciaPatagonia('1234', 'ALFANUMERICA'));
    ok(validarDependenciaPatagonia('AbC123', 'ALFANUMERICA'));
    ok(validarDependenciaPatagonia('A'.repeat(15), 'ALFANUMERICA'));
    expect(validarDependenciaPatagonia('AbC123', 'ALFANUMERICA')).toEqual({
      ok: true,
      value: 'AbC123',
    });
    falla(validarDependenciaPatagonia('', 'ALFANUMERICA'), 'DEPENDENCIA_INVALIDA');
    falla(validarDependenciaPatagonia('A'.repeat(16), 'ALFANUMERICA'), 'DEPENDENCIA_INVALIDA');
    falla(validarDependenciaPatagonia('A-1', 'ALFANUMERICA'), 'DEPENDENCIA_INVALIDA');
    falla(validarDependenciaPatagonia('A_1', 'ALFANUMERICA'), 'DEPENDENCIA_INVALIDA');
    falla(validarDependenciaPatagonia('A 1', 'ALFANUMERICA'), 'DEPENDENCIA_INVALIDA');
    falla(validarDependenciaPatagonia('DEPÓSITO', 'ALFANUMERICA'), 'DEPENDENCIA_INVALIDA');
    falla(validarDependenciaPatagonia('DEPÑO1', 'ALFANUMERICA'), 'DEPENDENCIA_INVALIDA');
    falla(validarDependenciaPatagonia('A\t1', 'ALFANUMERICA'), 'DEPENDENCIA_INVALIDA');
    falla(validarDependenciaPatagonia('DEP\n001', 'ALFANUMERICA'), 'DEPENDENCIA_INVALIDA');
  });

  it('PAT-2 NUMERICA se conserva como hipótesis histórica estricta', () => {
    ok(validarDependenciaPatagonia('1234', 'NUMERICA'));
    falla(validarDependenciaPatagonia('12A4', 'NUMERICA'), 'DEPENDENCIA_INVALIDA');
    falla(validarDependenciaPatagonia('A-1', 'NUMERICA'), 'DEPENDENCIA_INVALIDA');
    falla(validarDependenciaPatagonia('', 'NUMERICA'), 'DEPENDENCIA_INVALIDA');
    falla(validarDependenciaPatagonia('1'.repeat(16), 'NUMERICA'), 'DEPENDENCIA_INVALIDA');
  });
});

describe('validaciones Patagonia · nombre, liquidación y versión', () => {
  it('nombre generado: no vacío, A–Z/espacio y máximo 20', () => {
    ok(validarNombrePatagonia('PEREZ ANA'));
    falla(validarNombrePatagonia(''), 'NOMBRE_VACIO');
    falla(validarNombrePatagonia('Pérez'), 'NOMBRE_CARACTER_NO_RESPALDADO');
    falla(validarNombrePatagonia('A@B'), 'NOMBRE_CARACTER_NO_RESPALDADO');
    falla(validarNombrePatagonia('A'.repeat(21)), 'NOMBRE_LONGITUD_EXCEDIDA');
  });

  it('tipoLiquidacion valida forma de 3 dígitos sin imponer catálogo DR/XL', () => {
    for (const valor of ['001', '005', '999']) {
      ok(validarTipoLiquidacionPatagonia(valor));
    }
    falla(validarTipoLiquidacionPatagonia('01'), 'TIPO_LIQUIDACION_INVALIDO');
  });

  it('comprobante: 1–7 dígitos', () => {
    ok(validarComprobantePatagonia('0'));
    ok(validarComprobantePatagonia('0000000'));
    falla(validarComprobantePatagonia('12345678'), 'COMPROBANTE_INVALIDO');
    falla(validarComprobantePatagonia('ABC'), 'COMPROBANTE_INVALIDO');
  });

  it('versión admite vacío (espacios) y hasta 8 ASCII imprimibles', () => {
    ok(validarVersionPatagonia(''));
    ok(validarVersionPatagonia('V1'));
    ok(validarVersionPatagonia(' '.repeat(8)));
    falla(validarVersionPatagonia('123456789'), 'VERSION_INVALIDA');
    falla(validarVersionPatagonia('V\t1'), 'VERSION_INVALIDA');
  });

  it('texto ASCII imprimible no transforma minúsculas', () => {
    expect(validarTextoAsciiPatagonia('abc', 'r1_concepto')).toEqual({
      ok: true,
      value: 'abc',
    });
  });
});
