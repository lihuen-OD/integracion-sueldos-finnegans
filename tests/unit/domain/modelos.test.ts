import { describe, expect, it } from 'vitest';
import {
  CATALOGO_BANCOS,
  clasificarBanco,
  DESTINOS,
  type BancoCatalogado,
} from '../../../src/domain/destino';
import { descripcionSinClasificar } from '../../../src/domain/liquidacion';
import {
  ANEXO_I_TIPOS_DOCUMENTO,
  ANEXO_II_PROVINCIAS,
  CAMPOS_BANCARIOS,
  CONSUMO_POR_DESTINO,
  TIPOS_CUENTA_PATAGONIA,
  validarCamposBancarios,
  type CampoBancario,
  type ValorLeido,
} from '../../../src/domain/maestro';
import {
  createRandom,
  syntheticCbu,
  syntheticCuenta,
} from '../../fixtures/synthetic/identities.ts';

const NACION = 'BANCO DE LA NACION ARGENTINA';
const PATAGONIA = 'BANCO PATAGONIA S.A.';
const texto = (valor: string): ValorLeido => ({ tipo: 'TEXTO', texto: valor });

describe('catálogo de bancos (D-012, D-049)', () => {
  it('asocia los textos exactos aprobados a su destino y entidad esperada', () => {
    expect(clasificarBanco(NACION)).toMatchObject({
      tipo: 'CATALOGADO',
      banco: { destino: 'BNA_GT_HABERES', entidadEsperada: '011' },
    });
    expect(clasificarBanco(PATAGONIA)).toMatchObject({
      tipo: 'CATALOGADO',
      banco: { destino: 'PATAGONIA_B2', entidadEsperada: '034' },
    });
  });

  it('cubre ambos destinos, sin textos repetidos y con fuente', () => {
    expect(new Set(CATALOGO_BANCOS.map((banco) => banco.destino))).toEqual(new Set(DESTINOS));
    expect(new Set(CATALOGO_BANCOS.map((banco) => banco.textoFinnegans)).size).toBe(
      CATALOGO_BANCOS.length,
    );
    for (const banco of CATALOGO_BANCOS) {
      expect(banco.entidadEsperada).toMatch(/^[0-9]{3}$/);
      expect(banco.fuente).toMatch(/D-012/);
    }
  });

  it.each([
    ['vacío', ''],
    ['un espacio', ' '],
    ['solo espacios U+0020', '     '],
  ])('%s → VACIO (N-04)', (_caso, valor) => {
    expect(clasificarBanco(valor)).toEqual({ tipo: 'VACIO' });
  });

  it.each([
    ['minúsculas', NACION.toLowerCase()],
    ['espacio final', `${PATAGONIA} `],
    ['espacio inicial', ` ${NACION}`],
    ['sin "S.A."', 'BANCO PATAGONIA'],
    ['abreviado', 'BANCO NACION'],
    ['con acento', 'BANCO DE LA NACIÓN ARGENTINA'],
    ['otro banco', 'BANCO DE PRUEBA S.A.'],
    ['tab', '\t'],
    ['NBSP', '\u00a0'],
  ])('variante no catalogada (%s) → NO_SOPORTADO, sin adivinar', (_caso, valor) => {
    expect(clasificarBanco(valor)).toEqual({ tipo: 'NO_SOPORTADO' });
  });

  it('una celda ilegible falla de forma segura', () => {
    expect(clasificarBanco(null)).toEqual({ tipo: 'NO_SOPORTADO' });
  });

  it('acepta un catálogo provisto (perfil de empresa, F3)', () => {
    const propio: BancoCatalogado[] = [
      { textoFinnegans: 'NACION', destino: 'BNA_GT_HABERES', entidadEsperada: '011', fuente: 'x' },
    ];
    expect(clasificarBanco('NACION', propio).tipo).toBe('CATALOGADO');
    expect(clasificarBanco(NACION, propio).tipo).toBe('NO_SOPORTADO');
  });
});

describe('descripción de liquidación (D-037, P-10)', () => {
  it.each(['JULIO Agrario', 'AGOSTO Agrario', 'JULIO Comercio ', 'JULIO Liq final ', ''])(
    'conserva %j tal cual y no la clasifica',
    (original) => {
      expect(descripcionSinClasificar(original)).toEqual({
        descripcionOriginal: original,
        clasificacion: { estado: 'REGLA_PENDIENTE' },
      });
    },
  );
});

describe('catálogos Patagonia con fuente', () => {
  it('tipos de cuenta 1 y 2 (PAT-DR p.9)', () => {
    expect(TIPOS_CUENTA_PATAGONIA.map((entrada) => entrada.codigo)).toEqual(['1', '2']);
  });

  it('Anexo I según PAT-DR, incluido 004 (PAT-8)', () => {
    expect(ANEXO_I_TIPOS_DOCUMENTO.map((entrada) => entrada.codigo)).toEqual([
      '001',
      '002',
      '003',
      '004',
      '006',
    ]);
  });

  it('Anexo II con 24 provincias, de 01 a 23 y 40', () => {
    const codigos = ANEXO_II_PROVINCIAS.map((entrada) => entrada.codigo);
    expect(codigos).toHaveLength(24);
    expect(codigos.at(0)).toBe('01');
    expect(codigos.at(-2)).toBe('23');
    expect(codigos.at(-1)).toBe('40');
  });

  it('cada entrada cita su página', () => {
    for (const entrada of [
      ...TIPOS_CUENTA_PATAGONIA,
      ...ANEXO_I_TIPOS_DOCUMENTO,
      ...ANEXO_II_PROVINCIAS,
    ]) {
      expect(entrada.fuente).toMatch(/^PAT-DR p\.(9|10)/);
    }
  });
});

describe('consumo de campos por destino (D-048)', () => {
  it('BNA requiere CBU y no consume ningún campo PAT_*: no hay bloqueo cruzado', () => {
    expect(CONSUMO_POR_DESTINO.CBU.BNA_GT_HABERES).toBe('REQUERIDO');
    for (const campo of CAMPOS_BANCARIOS.filter((nombre) => nombre.startsWith('PAT_'))) {
      expect(CONSUMO_POR_DESTINO[campo].BNA_GT_HABERES).toBe('NO_CONSUMIDO');
    }
  });

  it('Patagonia requiere sus PAT_*, consume la provincia solo si está y NO consume el CBU (D-056)', () => {
    expect(CONSUMO_POR_DESTINO.CBU.PATAGONIA_B2).toBe('NO_CONSUMIDO');
    expect(CONSUMO_POR_DESTINO.PAT_PROVINCIA_DOCUMENTO.PATAGONIA_B2).toBe('CONSUMIDO_SI_PRESENTE');
    for (const campo of CAMPOS_BANCARIOS.filter(
      (nombre) => nombre.startsWith('PAT_') && nombre !== 'PAT_PROVINCIA_DOCUMENTO',
    )) {
      expect(CONSUMO_POR_DESTINO[campo].PATAGONIA_B2).toBe('REQUERIDO');
    }
  });
});

describe('validarCamposBancarios (docs/03 §B.1, sin normalizar)', () => {
  const random = createRandom(31);
  const cbu = syntheticCbu('034', '0123', syntheticCuenta(random));
  const completos: Record<CampoBancario, ValorLeido> = {
    CBU: texto(cbu),
    PAT_TIPO_CUENTA: texto('2'),
    PAT_NUMERO_CUENTA: texto('0001234567'),
    PAT_CODIGO_BANCO: texto('034'),
    PAT_CODIGO_SUCURSAL: texto('00123'),
    PAT_TIPO_DOCUMENTO: texto('004'),
    PAT_NUMERO_DOCUMENTO: texto('00000000001234567'),
    PAT_PROVINCIA_DOCUMENTO: texto('16'),
    PAT_CODIGO_DEPENDENCIA: texto('DEP 01'),
  };

  it('sin datos: todos los campos VACIO', () => {
    const resultado = validarCamposBancarios({});
    expect(resultado.cbu).toEqual({ estado: 'VACIO' });
    for (const campo of Object.values(resultado.patagonia)) {
      expect(campo).toEqual({ estado: 'VACIO' });
    }
  });

  it('datos completos y válidos: VALIDO con el texto exacto', () => {
    const resultado = validarCamposBancarios(completos);
    expect(resultado.cbu).toEqual({ estado: 'VALIDO', texto: cbu, valor: cbu });
    expect(resultado.patagonia.tipoCuenta).toEqual({ estado: 'VALIDO', texto: '2', valor: '2' });
    expect(resultado.patagonia.numeroCuenta).toMatchObject({ valor: '0001234567' });
    expect(resultado.patagonia.codigoSucursal).toMatchObject({ valor: '00123' });
    expect(resultado.patagonia.provinciaDocumento).toMatchObject({ estado: 'VALIDO', valor: '16' });
    expect(resultado.patagonia.codigoDependencia).toEqual({
      estado: 'VALIDO',
      texto: 'DEP 01',
      valor: 'DEP 01',
    });
  });

  const caso = (campo: CampoBancario, valor: string, motivo: string) =>
    [campo, valor, motivo] as const;

  it.each([
    caso('CBU', `${cbu.slice(0, 21)}${String((Number(cbu[21]) + 1) % 10)}`, 'DV_BLOQUE_2_INVALIDO'),
    caso('CBU', `${cbu.slice(0, 8)} ${cbu.slice(8)}`, 'CARACTER_NO_PERMITIDO'),
    caso('CBU', cbu.slice(0, 21), 'LONGITUD_INVALIDA'),
    caso('PAT_TIPO_CUENTA', '3', 'FUERA_DE_CATALOGO'),
    caso('PAT_TIPO_CUENTA', ' 1', 'FUERA_DE_CATALOGO'),
    caso('PAT_NUMERO_CUENTA', '12345678901', 'LONGITUD_INVALIDA'),
    caso('PAT_NUMERO_CUENTA', ' 123', 'CARACTER_NO_PERMITIDO'),
    caso('PAT_NUMERO_CUENTA', '12-3', 'CARACTER_NO_PERMITIDO'),
    caso('PAT_CODIGO_BANCO', '34', 'LONGITUD_INVALIDA'),
    caso('PAT_CODIGO_BANCO', '0034', 'LONGITUD_INVALIDA'),
    caso('PAT_CODIGO_SUCURSAL', '123456', 'LONGITUD_INVALIDA'),
    caso('PAT_TIPO_DOCUMENTO', '1', 'FUERA_DE_CATALOGO'),
    caso('PAT_TIPO_DOCUMENTO', '005', 'FUERA_DE_CATALOGO'),
    caso('PAT_NUMERO_DOCUMENTO', '1'.repeat(18), 'LONGITUD_INVALIDA'),
    caso('PAT_PROVINCIA_DOCUMENTO', '1', 'FUERA_DE_CATALOGO'),
    caso('PAT_PROVINCIA_DOCUMENTO', '24', 'FUERA_DE_CATALOGO'),
    caso('PAT_CODIGO_DEPENDENCIA', 'D'.repeat(16), 'LONGITUD_INVALIDA'),
  ])('%s = %j → INVALIDO %s, conservando el texto', (campo, valor, motivo) => {
    const resultado = validarCamposBancarios({ ...completos, [campo]: texto(valor) });
    const estados = { CBU: resultado.cbu, ...porColumna(resultado.patagonia) };
    expect(estados[campo]).toEqual({ estado: 'INVALIDO', texto: valor, motivo });
  });

  it('provincia informada con un tipo de documento distinto de 004 → NO_CORRESPONDE', () => {
    const resultado = validarCamposBancarios({ ...completos, PAT_TIPO_DOCUMENTO: texto('001') });
    expect(resultado.patagonia.provinciaDocumento).toEqual({
      estado: 'INVALIDO',
      texto: '16',
      motivo: 'NO_CORRESPONDE_AL_TIPO_DOCUMENTO',
    });
  });

  it('no infiere relación entre documento y CUIL ni deriva datos (D-047, P-28)', () => {
    const resultado = validarCamposBancarios({
      ...completos,
      PAT_TIPO_DOCUMENTO: texto('001'),
      PAT_PROVINCIA_DOCUMENTO: texto(''),
    });
    expect(resultado.patagonia.numeroDocumento).toMatchObject({ estado: 'VALIDO' });
    expect(resultado.patagonia.provinciaDocumento).toEqual({ estado: 'VACIO' });
  });

  it('dependencia: hasta 15 caracteres tal cual, sin trim ni validar tipo (PAT-2)', () => {
    const valor = ' A-1 b.2 ñ    ';
    const resultado = validarCamposBancarios({ PAT_CODIGO_DEPENDENCIA: texto(valor) });
    expect(resultado.patagonia.codigoDependencia).toEqual({
      estado: 'VALIDO',
      texto: valor,
      valor,
    });
  });

  it.each([
    [{ tipo: 'NUMERO', texto: '7' } as const, 'CELDA_NUMERICA', '7'],
    [{ tipo: 'FORMULA' } as const, 'FORMULA', ''],
    [{ tipo: 'OTRO' } as const, 'TIPO_DE_CELDA', ''],
  ])('celda %o → INVALIDO %s', (valor, motivo, textoEsperado) => {
    const resultado = validarCamposBancarios({ CBU: valor, PAT_NUMERO_CUENTA: valor });
    expect(resultado.cbu).toEqual({ estado: 'INVALIDO', texto: textoEsperado, motivo });
    expect(resultado.patagonia.numeroCuenta).toEqual({
      estado: 'INVALIDO',
      texto: textoEsperado,
      motivo,
    });
  });
});

function porColumna(
  patagonia: ReturnType<typeof validarCamposBancarios>['patagonia'],
): Record<Exclude<CampoBancario, 'CBU'>, unknown> {
  return {
    PAT_TIPO_CUENTA: patagonia.tipoCuenta,
    PAT_NUMERO_CUENTA: patagonia.numeroCuenta,
    PAT_CODIGO_BANCO: patagonia.codigoBanco,
    PAT_CODIGO_SUCURSAL: patagonia.codigoSucursal,
    PAT_TIPO_DOCUMENTO: patagonia.tipoDocumento,
    PAT_NUMERO_DOCUMENTO: patagonia.numeroDocumento,
    PAT_PROVINCIA_DOCUMENTO: patagonia.provinciaDocumento,
    PAT_CODIGO_DEPENDENCIA: patagonia.codigoDependencia,
  };
}
