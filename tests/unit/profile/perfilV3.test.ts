// CompanyProfile v3 (D-087): conserva v1/v2 sin migraciones y agrega solo el número de
// EMPRESA Patagonia. CUIT/CBU se generan en ejecución (D-042).
import { describe, expect, it } from 'vitest';
import { parseCbu } from '../../../src/domain/cbu';
import { parseCuitEmpresa } from '../../../src/domain/cuitEmpresa';
import { CATALOGO_BANCOS } from '../../../src/domain/destino';
import {
  parsePerfil,
  parsePerfilVersionado,
  validarPerfil,
  validarPerfilV2,
  validarPerfilV3,
  validarPerfilVersionado,
} from '../../../src/profile/validar';
import {
  plantillaPerfil,
  serializarPerfilV2,
  serializarPerfilV3,
  serializarPerfilVersionado,
} from '../../../src/profile/plantilla';
import { perfilVersionadoDesdeBytes } from '../../../src/profile/archivo';
import type { CompanyProfileV2, CompanyProfileV3 } from '../../../src/profile/contrato';
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

function cbu(semilla = 31) {
  const resultado = parseCbu(syntheticCbu('011', '0001', syntheticCuenta(createRandom(semilla))));
  if (!resultado.ok) {
    throw new Error(`CBU sintético rechazado: ${resultado.error}`);
  }
  return resultado.value;
}

function perfilV3(
  cambios: Partial<CompanyProfileV3> = {},
  cambiosPatagonia: Partial<CompanyProfileV3['patagonia']> = {},
): CompanyProfileV3 {
  const base: CompanyProfileV3 = {
    schemaVersion: '3',
    cuitEmpresa: cuit(),
    nombreEmpresa: 'EMPRESA SINTÉTICA S.A.',
    catalogoBancos: [...CATALOGO_BANCOS],
    bna: {
      cbuEmpresa: cbu(),
      codigoConvenio: '4455',
      moneda: '0',
    },
    patagonia: {
      numeroEmpresa: '1234',
    },
    mapeosLiquidacion: [],
  };
  return { ...base, ...cambios, patagonia: { ...base.patagonia, ...cambiosPatagonia } };
}

function perfilV2(): CompanyProfileV2 {
  const v3 = perfilV3();
  return {
    schemaVersion: '2',
    cuitEmpresa: v3.cuitEmpresa,
    nombreEmpresa: v3.nombreEmpresa,
    catalogoBancos: v3.catalogoBancos,
    bna: v3.bna,
    mapeosLiquidacion: [],
  };
}

function codigos(resultado: { ok: boolean; error?: readonly { codigo: string }[] }): string[] {
  return resultado.ok ? [] : (resultado.error ?? []).map((error) => error.codigo);
}

function objetoJson(texto: string): Record<string, unknown> {
  return JSON.parse(texto) as Record<string, unknown>;
}

describe('perfil v1/v2 · compatibilidad intacta con v3', () => {
  it('v1 y v2 siguen validando, serializando y exportando su versión real', () => {
    const v1 = plantillaPerfil(cuit());
    expect(validarPerfil(v1).ok).toBe(true);
    expect(objetoJson(serializarPerfilVersionado(v1))['schemaVersion']).toBe('1');

    const v2 = perfilV2();
    expect(validarPerfilV2(v2).ok).toBe(true);
    expect(serializarPerfilVersionado(v2)).toBe(serializarPerfilV2(v2));
    expect(objetoJson(serializarPerfilVersionado(v2))['schemaVersion']).toBe('2');
  });

  it('un v3 no se acepta por los validadores históricos ni se convierte a v2', () => {
    const v3 = perfilV3();
    expect(codigos(validarPerfil(v3))).toContain('CLAVE_DESCONOCIDA');
    expect(codigos(validarPerfilV2(v3))).toContain('CLAVE_DESCONOCIDA');
    expect(parsePerfil(JSON.stringify(v3)).ok).toBe(false);
  });

  it('un v2 no se acepta como v3 ni se completa patagonia por default', () => {
    const v2 = perfilV2();
    expect(codigos(validarPerfilV3(v2))).toContain('SCHEMA_VERSION_INCOMPATIBLE');
    expect(codigos(validarPerfilV3(v2))).toContain('PATAGONIA_FALTANTE');
  });
});

describe('perfil v3 · contrato mínimo (D-087)', () => {
  it('acepta el objeto completo y conserva la versión y el número de EMPRESA exactos', () => {
    const v3 = perfilV3();
    const resultado = validarPerfilV3(v3);
    expect(resultado).toEqual({ ok: true, value: v3 });
    if (resultado.ok) {
      expect(resultado.value.schemaVersion).toBe('3');
      expect(resultado.value.patagonia.numeroEmpresa).toBe('1234');
      expect(resultado.value.mapeosLiquidacion).toEqual([]);
    }
  });

  it('serializa en orden canónico, de forma determinista, y hace round-trip versionado', () => {
    const v3 = perfilV3();
    const primera = serializarPerfilVersionado(v3);
    expect(primera).toBe(serializarPerfilV3(v3));
    expect(primera.endsWith('\n')).toBe(true);
    expect(Object.keys(objetoJson(primera))).toEqual([
      'schemaVersion',
      'cuitEmpresa',
      'nombreEmpresa',
      'catalogoBancos',
      'bna',
      'patagonia',
      'mapeosLiquidacion',
    ]);
    expect(objetoJson(primera)['patagonia']).toEqual({ numeroEmpresa: '1234' });
    expect(parsePerfilVersionado(primera)).toEqual({ ok: true, value: v3 });
    expect(perfilVersionadoDesdeBytes(new TextEncoder().encode(primera))).toEqual({
      ok: true,
      value: v3,
    });
  });

  it('no normaliza ni rellena numeroEmpresa al persistir', () => {
    const v3 = perfilV3({}, { numeroEmpresa: '12' });
    const texto = serializarPerfilV3(v3);
    expect((objetoJson(texto)['patagonia'] as Record<string, unknown>)['numeroEmpresa']).toBe('12');
    expect(validarPerfilVersionado(v3)).toEqual({ ok: true, value: v3 });
  });

  it('exige patagonia, numeroEmpresa y bna sin defaults', () => {
    const sinPatagonia: Record<string, unknown> = { ...perfilV3() };
    delete sinPatagonia['patagonia'];
    expect(codigos(validarPerfilV3(sinPatagonia))).toContain('PATAGONIA_FALTANTE');

    const patagoniaVacia: Record<string, unknown> = { ...perfilV3(), patagonia: {} };
    expect(codigos(validarPerfilV3(patagoniaVacia))).toContain('CAMPO_FALTANTE');

    const sinBna: Record<string, unknown> = { ...perfilV3() };
    delete sinBna['bna'];
    expect(codigos(validarPerfilV3(sinBna))).toContain('BNA_FALTANTE');
  });

  it('rechaza numeroEmpresa vacío, no numérico o de más de 4 dígitos', () => {
    for (const numeroEmpresa of ['', '12A4', '12345', ' 123', '123 ']) {
      expect(codigos(validarPerfilV3(perfilV3({}, { numeroEmpresa })))).toContain(
        'NUMERO_EMPRESA_PATAGONIA_INVALIDO',
      );
    }
    expect(codigos(validarPerfilV3(perfilV3({}, { numeroEmpresa: '0' })))).toEqual([]);
  });

  it('rechaza claves desconocidas en raíz, patagonia y bna', () => {
    expect(codigos(validarPerfilV3({ ...perfilV3(), sucursalEmpresa: '0001' }))).toContain(
      'CLAVE_DESCONOCIDA',
    );
    expect(
      codigos(validarPerfilV3({ ...perfilV3(), patagonia: { numeroEmpresa: '1234', cbu: 'x' } })),
    ).toContain('CLAVE_DESCONOCIDA');
    expect(
      codigos(
        validarPerfilV3({ ...perfilV3(), bna: { ...perfilV3().bna, tipoDocumento: '02' } }),
      ),
    ).toContain('CLAVE_DESCONOCIDA');
  });

  it('mantiene mapeosLiquidacion vacío y rechaza valores no-array o no vacíos', () => {
    for (const mapeos of [null, 'x', {}, [{}]]) {
      const objeto = { ...perfilV3(), mapeosLiquidacion: mapeos };
      expect(validarPerfilV3(objeto).ok).toBe(false);
    }
  });

  it('el dispatch versionado acepta "3" y rechaza versiones desconocidas', () => {
    const v3 = perfilV3();
    expect(validarPerfilVersionado(v3)).toEqual({ ok: true, value: v3 });
    expect(codigos(validarPerfilVersionado({ ...v3, schemaVersion: '4' }))).toContain(
      'SCHEMA_VERSION_INCOMPATIBLE',
    );
  });
});
