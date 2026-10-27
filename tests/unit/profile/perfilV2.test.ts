// CompanyProfile v2 (D-079): discriminación estricta por versión, sin migraciones ni
// defaults. CUIT/CBU se generan en ejecución (D-042); no hay identificadores reales.
import { describe, expect, it } from 'vitest';
import { parseCbu } from '../../../src/domain/cbu';
import { parseCuitEmpresa } from '../../../src/domain/cuitEmpresa';
import { CATALOGO_BANCOS } from '../../../src/domain/destino';
import {
  parsePerfil,
  parsePerfilVersionado,
  validarPerfil,
  validarPerfilV2,
  validarPerfilVersionado,
} from '../../../src/profile/validar';
import {
  plantillaPerfil,
  serializarPerfil,
  serializarPerfilV2,
  serializarPerfilVersionado,
} from '../../../src/profile/plantilla';
import { perfilVersionadoDesdeBytes } from '../../../src/profile/archivo';
import type { CompanyProfileV2 } from '../../../src/profile/contrato';
import {
  createRandom,
  syntheticCbu,
  syntheticCuenta,
  syntheticCuil,
} from '../../fixtures/synthetic/identities.ts';

function cuit() {
  const texto = syntheticCuil('30', 12_345_678);
  if (texto === null) {
    throw new Error('CUIT sintético no asignable');
  }
  const resultado = parseCuitEmpresa(texto);
  if (!resultado.ok) {
    throw new Error(`CUIT sintético rechazado: ${resultado.error}`);
  }
  return resultado.value;
}

function cbu(semilla = 11) {
  const resultado = parseCbu(syntheticCbu('011', '0001', syntheticCuenta(createRandom(semilla))));
  if (!resultado.ok) {
    throw new Error(`CBU sintético rechazado: ${resultado.error}`);
  }
  return resultado.value;
}

function perfilV2(
  cambios: Partial<CompanyProfileV2> = {},
  cambiosBna: Partial<CompanyProfileV2['bna']> = {},
): CompanyProfileV2 {
  const base: CompanyProfileV2 = {
    schemaVersion: '2',
    cuitEmpresa: cuit(),
    nombreEmpresa: 'EMPRESA SINTÉTICA S.A.',
    catalogoBancos: [...CATALOGO_BANCOS],
    bna: {
      cbuEmpresa: cbu(),
      codigoConvenio: '4455',
      moneda: '0',
    },
    mapeosLiquidacion: [],
  };
  return { ...base, ...cambios, bna: { ...base.bna, ...cambiosBna } };
}

function codigos(resultado: { ok: boolean; error?: readonly { codigo: string }[] }): string[] {
  return resultado.ok ? [] : (resultado.error ?? []).map((error) => error.codigo);
}

function objetoJson(texto: string): Record<string, unknown> {
  return JSON.parse(texto) as Record<string, unknown>;
}

describe('perfil v1 · compatibilidad intacta (D-059)', () => {
  it('sigue validando y exportando "1", sin bna', () => {
    const v1 = plantillaPerfil(cuit());
    const validado = validarPerfil(v1);
    expect(validado.ok).toBe(true);
    const texto = serializarPerfil(v1);
    expect(objetoJson(texto)['schemaVersion']).toBe('1');
    expect(objetoJson(texto)['bna']).toBeUndefined();
    expect(parsePerfil(texto)).toEqual({ ok: true, value: v1 });
  });

  it('parsePerfil histórico rechaza v2 (no hay migración inversa)', () => {
    expect(parsePerfil(JSON.stringify(perfilV2())).ok).toBe(false);
  });

  it('un v1 con claves v2 se rechaza en el validador v1 y en el versionado', () => {
    const objeto = { ...plantillaPerfil(cuit()), bna: { cbuEmpresa: cbu() } };
    expect(codigos(validarPerfil(objeto))).toContain('CLAVE_DESCONOCIDA');
    expect(codigos(validarPerfilVersionado(objeto))).toContain('CLAVE_DESCONOCIDA');
  });
});

describe('perfil v2 · contrato mínimo (D-079)', () => {
  it('acepta el objeto completo y conserva la versión real', () => {
    const v2 = perfilV2();
    const resultado = validarPerfilV2(v2);
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) {
      throw new Error('v2 válido rechazado');
    }
    expect(resultado.value).toEqual(v2);
    expect(resultado.value.schemaVersion).toBe('2');
  });

  it('exporta "2" de forma determinista y hace round-trip versionado', () => {
    const v2 = perfilV2();
    const primera = serializarPerfilVersionado(v2);
    const segunda = serializarPerfilV2(v2);
    expect(primera).toBe(segunda);
    expect(primera.endsWith('\n')).toBe(true);
    expect(objetoJson(primera)['schemaVersion']).toBe('2');
    const importado = parsePerfilVersionado(primera);
    expect(importado).toEqual({ ok: true, value: v2 });
    const desdeBytes = perfilVersionadoDesdeBytes(new TextEncoder().encode(primera));
    expect(desdeBytes).toEqual({ ok: true, value: v2 });
  });

  it('permite nombreEmpresa null, pero exige la clave (sin defaults)', () => {
    expect(validarPerfilV2(perfilV2({ nombreEmpresa: null })).ok).toBe(true);
    const sinNombre: Record<string, unknown> = { ...perfilV2() };
    delete sinNombre['nombreEmpresa'];
    expect(codigos(validarPerfilV2(sinNombre))).toContain('CAMPO_FALTANTE');
  });

  it('rechaza claves desconocidas en la raíz y dentro de bna', () => {
    expect(codigos(validarPerfilV2({ ...perfilV2(), sucursalEmpresa: '0001' }))).toContain(
      'CLAVE_DESCONOCIDA',
    );
    expect(
      codigos(
        validarPerfilV2({
          ...perfilV2(),
          bna: { ...perfilV2().bna, tipoDocumento: '02' },
        }),
      ),
    ).toContain('CLAVE_DESCONOCIDA');
  });

  it('rechaza bna faltante, no objeto, sin cbuEmpresa y sin moneda', () => {
    const sinBna: Record<string, unknown> = { ...perfilV2() };
    delete sinBna['bna'];
    expect(codigos(validarPerfilV2(sinBna))).toContain('BNA_FALTANTE');
    expect(codigos(validarPerfilV2({ ...perfilV2(), bna: 'x' }))).toContain('TIPO_INVALIDO');
    expect(codigos(validarPerfilV2(perfilV2({}, { cbuEmpresa: undefined as never })))).toContain(
      'CAMPO_FALTANTE',
    );
    const sinMoneda: Record<string, unknown> = {
      ...perfilV2(),
      bna: { cbuEmpresa: cbu(), codigoConvenio: '4455' },
    };
    expect(codigos(validarPerfilV2(sinMoneda))).toContain('CAMPO_FALTANTE');
  });

  it('rechaza CBU inválido y moneda distinta de 0/1', () => {
    expect(
      codigos(validarPerfilV2(perfilV2({}, { cbuEmpresa: `${'0'.repeat(21)}1` as never }))),
    ).toContain('CBU_EMPRESA_NO_VALIDO');
    expect(codigos(validarPerfilV2(perfilV2({}, { moneda: '2' as never })))).toContain(
      'MONEDA_BNA_INVALIDA',
    );
    expect(codigos(validarPerfilV2(perfilV2({}, { moneda: 0 as never })))).toContain(
      'MONEDA_BNA_INVALIDA',
    );
  });

  it('acepta convenio de 4 y 8, rechaza no numérico y 5/6/7 (BNA-5)', () => {
    expect(validarPerfilV2(perfilV2({}, { codigoConvenio: '4455' })).ok).toBe(true);
    expect(validarPerfilV2(perfilV2({}, { codigoConvenio: '44556677' })).ok).toBe(true);
    expect(codigos(validarPerfilV2(perfilV2({}, { codigoConvenio: '12A4' })))).toContain(
      'CONVENIO_BNA_NO_NUMERICO',
    );
    for (const longitud of ['12345', '123456', '1234567']) {
      expect(codigos(validarPerfilV2(perfilV2({}, { codigoConvenio: longitud })))).toContain(
        'CONVENIO_BNA5_LONGITUD_NO_DEFINIDA',
      );
    }
    expect(codigos(validarPerfilV2(perfilV2({}, { codigoConvenio: '123' })))).toContain(
      'CONVENIO_BNA_LONGITUD_INVALIDA',
    );
  });

  it('rechaza mapeos no vacíos y mapeos no-array', () => {
    expect(codigos(validarPerfilV2({ ...perfilV2(), mapeosLiquidacion: [1] }))).toContain(
      'MAPEOS_PENDIENTES',
    );
    expect(codigos(validarPerfilV2({ ...perfilV2(), mapeosLiquidacion: null }))).toContain(
      'TIPO_INVALIDO',
    );
  });

  it('rechaza otra versión sin intentar validar como v1 ni completar v2', () => {
    const otro = { ...perfilV2(), schemaVersion: '4' };
    expect(codigos(validarPerfilVersionado(otro))).toEqual(['SCHEMA_VERSION_INCOMPATIBLE']);
    expect(validarPerfilVersionado(null).ok).toBe(false);
    const v1ConVersion2: Record<string, unknown> = {
      ...plantillaPerfil(cuit()),
      schemaVersion: '2',
    };
    expect(codigos(validarPerfilVersionado(v1ConVersion2))).toContain('BNA_FALTANTE');
  });

  it('no reinterpreta claves v1 como configuración BNA', () => {
    const objeto: Record<string, unknown> = {
      ...perfilV2(),
      bna: undefined,
      cbuEmpresa: cbu(),
    };
    expect(codigos(validarPerfilVersionado(objeto))).toContain('CLAVE_DESCONOCIDA');
    expect(codigos(validarPerfilVersionado(objeto))).toContain('BNA_FALTANTE');
  });

  it('rechaza objetos no planos, campos faltantes y tipos inválidos sin completar defaults', () => {
    expect(codigos(validarPerfilV2(null))).toContain('NO_ES_OBJETO');
    expect(codigos(validarPerfilVersionado([]))).toContain('NO_ES_OBJETO');
    const sinCuit: Record<string, unknown> = { ...perfilV2() };
    delete sinCuit['cuitEmpresa'];
    expect(codigos(validarPerfilV2(sinCuit))).toContain('CAMPO_FALTANTE');
    expect(codigos(validarPerfilV2(perfilV2({ nombreEmpresa: 3 as never })))).toContain(
      'TIPO_INVALIDO',
    );
    expect(codigos(validarPerfilV2({ ...perfilV2(), catalogoBancos: undefined }))).toContain(
      'CAMPO_FALTANTE',
    );
    expect(codigos(validarPerfilV2({ ...perfilV2(), mapeosLiquidacion: undefined }))).toContain(
      'CAMPO_FALTANTE',
    );
    expect(codigos(validarPerfilV2(perfilV2({}, { cbuEmpresa: 1 as never })))).toContain(
      'TIPO_INVALIDO',
    );
  });

  it('rechaza JSON inválido y bytes que no son UTF-8 en la API versionada', () => {
    expect(codigos(parsePerfilVersionado('{'))).toContain('NO_ES_JSON');
    expect(perfilVersionadoDesdeBytes(Uint8Array.of(0xff, 0xfe)).ok).toBe(false);
    expect(codigos(perfilVersionadoDesdeBytes(Uint8Array.of(0xff, 0xfe)))).toContain('NO_ES_JSON');
  });
});
