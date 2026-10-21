// CompanyProfile v1 (D-059, P-19 abierto): generado en tiempo de ejecución para cumplir la
// política D-042 (ningún literal con forma de CUIL/CUIT versionado).
import { describe, expect, it } from 'vitest';
import { CATALOGO_BANCOS } from '../../../src/domain/destino';
import { parseCuitEmpresa } from '../../../src/domain/cuitEmpresa';
import { parsePerfil, validarPerfil } from '../../../src/profile/validar';
import { plantillaPerfil, serializarPerfil } from '../../../src/profile/plantilla';
import type { CompanyProfile } from '../../../src/profile/contrato';

const DIGITOS = ['3', '0', '7', '1', '2', '3', '4', '5', '6', '7', '1'];
const CUIT_TEXTO = DIGITOS.join('');

function perfilValido(nombreEmpresa: string | null = 'EMPRESA SINTÉTICA S.A.'): CompanyProfile {
  const cuit = parseCuitEmpresa(CUIT_TEXTO);
  if (!cuit.ok) {
    throw new Error(`CUIT sintético rechazado: ${cuit.error}`);
  }
  return { ...plantillaPerfil(cuit.value), nombreEmpresa };
}

describe('validarPerfil · contrato v1 (D-059, D-058)', () => {
  it('acepta la plantilla y el objeto completo con nombreEmpresa', () => {
    const resultado = validarPerfil(perfilValido());
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.value.schemaVersion).toBe('1');
      expect(resultado.value.catalogoBancos).toEqual(CATALOGO_BANCOS);
      expect(resultado.value.mapeosLiquidacion).toEqual([]);
      expect(resultado.value.nombreEmpresa).toBe('EMPRESA SINTÉTICA S.A.');
    }
  });

  it('rechaza claves desconocidas exactamente por su ruta (sin datos)', () => {
    const objeto: Record<string, unknown> = { ...perfilValido() };
    objeto['bancosActivos'] = ['X'];
    objeto['cuitFalso'] = '1';
    objeto['PAT_1'] = 'x';
    const resultado = validarPerfil(objeto);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      const rutas = resultado.error.map((e) => `${e.ruta}:${e.codigo}`);
      expect(rutas).toContain('bancosActivos:CLAVE_DESCONOCIDA');
      expect(rutas).toContain('cuitFalso:CLAVE_DESCONOCIDA');
      expect(rutas).toContain('PAT_1:CLAVE_DESCONOCIDA');
    }
  });

  it('rechaza schemaVersion ausente, "2", "10", "1a", 1 (number) y objeto null/array', () => {
    for (const version of [undefined, '2', '10', '1a', 1, null]) {
      const objeto = { ...perfilValido(), schemaVersion: version };
      const resultado = validarPerfil(objeto);
      expect(resultado.ok).toBe(false);
      if (!resultado.ok) {
        expect(resultado.error.map((e) => e.codigo)).toContain('SCHEMA_VERSION_INCOMPATIBLE');
      }
    }
    expect(validarPerfil(null)).toEqual({
      ok: false,
      error: [{ ruta: '$', codigo: 'NO_ES_OBJETO', detalle: 'objeto JSON esperado' }],
    });
    expect(validarPerfil(['a']).ok).toBe(false);
  });

  it('rechaza cuitEmpresa inválido, faltante o de tipo no string con errores sin PII', () => {
    const resultado = validarPerfil({ ...perfilValido(), cuitEmpresa: '30-123456-9' });
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      const [error] = resultado.error;
      expect(error).toEqual({
        ruta: '$.cuitEmpresa',
        codigo: 'CUIT_EMPRESA_NO_VALIDO',
        detalle: 'FORMATO_INVALIDO',
      });
    }
    const faltante = validarPerfil({ ...perfilValido(), cuitEmpresa: undefined });
    expect(faltante.ok).toBe(false);
    if (!faltante.ok) {
      expect(faltante.error.map((e) => e.codigo)).toContain('CAMPO_FALTANTE');
    }
  });

  it('rechaza nombreEmpresa vacío o de otro tipo; el trim conserva el valor limpìo', () => {
    const vacio = validarPerfil({ ...perfilValido(), nombreEmpresa: '   ' });
    expect(vacio.ok).toBe(false);
    if (!vacio.ok) {
      expect(vacio.error.map((e) => e.codigo)).toContain('NOMBRE_EMPRESA_INVALIDO');
    }
    const conEspacios = validarPerfil({ ...perfilValido(), nombreEmpresa: '  GAIA S.A.  ' });
    if (!conEspacios.ok) {
      throw new Error('nombre válido rechazado');
    }
    expect(conEspacios.value.nombreEmpresa).toBe('GAIA S.A.');
    const numero = validarPerfil({ ...perfilValido(), nombreEmpresa: 7 });
    expect(numero.ok).toBe(false);
  });

  it('rechaza un catálogo distinto del vigente y entradas con claves desconocidas', () => {
    const objeto: Record<string, unknown> = { ...perfilValido() };
    objeto['catalogoBancos'] = [
      ...(CATALOGO_BANCOS as unknown as readonly Record<string, unknown>[]),
      {
        textoFinnegans: 'BANCO INVENTADO',
        destino: 'BNA_GT_HABERES',
        entidadEsperada: '011',
        fuente: 'x',
      },
    ];
    const extra = validarPerfil(objeto);
    if (extra.ok) {
      throw new Error('catálogo con banco de más aceptado');
    }
    expect(extra.error.map((e) => e.codigo)).toContain('CATALOGO_INCOMPATIBLE');
    const conClaveSobrante = {
      ...perfilValido(),
      catalogoBancos: [{ ...CATALOGO_BANCOS[0], notas: 'x' }, CATALOGO_BANCOS[1]],
    };
    const resultado = validarPerfil(conClaveSobrante);
    if (!resultado.ok) {
      expect(resultado.error.map((e) => `${e.ruta}:${e.codigo}`)).toContain(
        'catalogoBancos[0].notas:CLAVE_DESCONOCIDA',
      );
    } else {
      throw new Error('clave desconocida aceptada en entrada de catálogo');
    }
  });

  it('rechaza mapeosLiquidacion no vacíos (D-026, P-09, P-10): quedan para fases bancarias', () => {
    const conMapeo = { ...perfilValido(), mapeosLiquidacion: [{ codigos: { BNA: '0003' } }] };
    const resultado = validarPerfil(conMapeo);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.map((e) => `${e.ruta}:${e.codigo}`)).toContain(
        '$.mapeosLiquidacion:MAPEOS_PENDIENTES',
      );
    }
  });

  it('mapeosLiquidacion explícitos por caso (FIX 1): null/string/number/object → TIPO_INVALIDO', () => {
    const casos: Array<[unknown, string]> = [
      [null, 'null'],
      ['no-es-array', 'string'],
      [42, 'number'],
      [{ largo: 0 }, 'object'],
    ];
    for (const [crudo, rotulo] of casos) {
      const resultado = validarPerfil({ ...perfilValido(), mapeosLiquidacion: crudo });
      if (resultado.ok) {
        throw new Error(`mapeosLiquidacion ${rotulo} atravesó la validación`);
      }
      expect(
        resultado.error.some(
          (e) => e.ruta === '$.mapeosLiquidacion' && e.codigo === 'TIPO_INVALIDO',
        ),
      ).toBe(true);
    }
  });

  it('mapeosLiquidacion [] es válido y un array no vacío es MAPEOS_PENDIENTES (P-09/P-10 intactos)', () => {
    const vacio = validarPerfil({ ...perfilValido(), mapeosLiquidacion: [] });
    expect(vacio.ok).toBe(true);
    if (vacio.ok) {
      expect(vacio.value.mapeosLiquidacion).toEqual([]);
    }
    const noVacio = validarPerfil({ ...perfilValido(), mapeosLiquidacion: [1] });
    expect(noVacio.ok).toBe(false);
    if (!noVacio.ok) {
      expect(
        noVacio.error.some(
          (e) => e.ruta === '$.mapeosLiquidacion' && e.codigo === 'MAPEOS_PENDIENTES',
        ),
      ).toBe(true);
    }
  });
});

describe('parsePerfil · JSON por contenido, sin importar el nombre (D-059)', () => {
  it('acepta JSON válido creado con cualquier nombre y rechaza texto no-JSON', () => {
    const perfil = perfilValido();
    const bytes = new TextEncoder().encode(serializarPerfil(perfil));
    const texto = new TextDecoder().decode(bytes);
    expect(parsePerfil(texto)).toEqual({ ok: true, value: perfil });
    expect(parsePerfil('{no json}')).toEqual({
      ok: false,
      error: [{ ruta: '$', codigo: 'NO_ES_JSON', detalle: 'JSON inválido' }],
    });
  });
});

describe('serializarPerfil · determinista (D-059)', () => {
  it('mismos datos producen la misma serialización y el round-trip es exacto', () => {
    const perfil = perfilValido();
    const primera = serializarPerfil(perfil);
    const segunda = serializarPerfil(perfil);
    expect(primera).toBe(segunda);
    expect(primera.endsWith('\n')).toBe(true);
    expect(JSON.parse(primera)).toEqual(JSON.parse(serializarPerfil(perfilValido())));
    const desdeTexto = parsePerfil(primera);
    if (!desdeTexto.ok) {
      throw new Error('round-trip falló');
    }
    expect(desdeTexto.value).toEqual(perfil);
  });
});
