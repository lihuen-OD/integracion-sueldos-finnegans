// Mapper BNA (CP-F5-B). La política sintética prueba capacidad técnica; NO resuelve
// BNA-1/2/6/P-09/P-10/BNA-11 ni habilita la generación productiva. BNA-1 sigue BLOQUEADA.
import { describe, expect, it } from 'vitest';
import {
  ID_CAMPO_BNA_TIPO_DOCUMENTO,
  ISSUES_BNA,
  POLITICA_BNA_PRODUCTIVA,
  REGISTROS_BNA,
  mapearBna,
  sinResolucion,
  type ErrorMapeoBna,
  type PuntoPoliticaBna,
  type ResultadoMapeoBna,
} from '../../../../src/banks/bna';
import { descripcionSinClasificar } from '../../../../src/domain/liquidacion';
import type { Centavos } from '../../../../src/domain/money';
import { MAX_IMPORTE_R2 } from '../../../../src/banks/bna/totales';
import {
  cuitSintetico,
  pagoSintetico,
  parametrosSinteticos,
  perfilSintetico,
  politicaSintetica,
} from './auxiliares';

function valor(resultado: {
  ok: boolean;
  value?: ResultadoMapeoBna;
  error?: readonly ErrorMapeoBna[];
}) {
  if (!resultado.ok || resultado.value === undefined) {
    throw new Error(`mapeo rechazado: ${JSON.stringify(resultado.error)}`);
  }
  return resultado.value;
}

function errores(resultado: { ok: boolean; error?: readonly ErrorMapeoBna[] }) {
  if (resultado.ok) {
    throw new Error('mapeo aceptado cuando debía fallar');
  }
  return resultado.error ?? [];
}

function codigos(resultado: { ok: boolean; error?: readonly ErrorMapeoBna[] }): string[] {
  return errores(resultado).map((error) => error.codigo);
}

function puntos(resultado: { ok: boolean; error?: readonly ErrorMapeoBna[] }): string[] {
  return errores(resultado)
    .map((error) => error.punto)
    .filter((punto): punto is PuntoPoliticaBna => punto !== undefined);
}

function r1(resultado: ResultadoMapeoBna) {
  return resultado.entradas.find((entrada) => entrada.recordId === 'BNA_R1');
}

function r2s(resultado: ResultadoMapeoBna) {
  return resultado.entradas.filter((entrada) => entrada.recordId === 'BNA_R2');
}

function r3(resultado: ResultadoMapeoBna) {
  return resultado.entradas.find((entrada) => entrada.recordId === 'BNA_R3');
}

describe('mapper BNA · R1/R2/R3 técnicos', () => {
  it('produce R1 con datos del perfil y valores explícitos', () => {
    const perfil = perfilSintetico();
    const parametros = parametrosSinteticos();
    const resultado = valor(mapearBna(perfil, parametros, [pagoSintetico(1)], politicaSintetica()));
    const cabecera = r1(resultado);
    expect(cabecera?.recordId).toBe('BNA_R1');
    expect(cabecera?.valores).toMatchObject({
      r1_identificacionEmpresa: perfil.cuitEmpresa,
      r1_bloque2CbuEmpresa: String(perfil.cbuEmpresa).slice(8, 22),
      r1_moneda: '0',
      r1_fechaCompensacion: parametros.fechaCompensacion,
      r1_infoCriterioEmpresa: parametros.infoCriterioEmpresa,
      r1_codigoConvenio: '0044550000',
      r1_numeroEnvio: parametros.numeroEnvio,
    });
    expect(cabecera?.valores['r1_sucursalEmpresa']).toHaveLength(4);
  });

  it('produce R2 con CBU, CUIL, importe y campos de la política', () => {
    const pago = pagoSintetico(2);
    const resultado = valor(
      mapearBna(perfilSintetico(), parametrosSinteticos(), [pago], politicaSintetica()),
    );
    const detalle = r2s(resultado)[0];
    expect(detalle?.valores).toMatchObject({
      r2_dvBloque1: String(pago.cbu).slice(7, 8),
      r2_bloque2Cuenta: String(pago.cbu).slice(8, 22),
      r2_importe: String(pago.neto),
      r2_referencia: 'HABERES OCTUBRE',
      r2_identificacionBeneficiario: String(pago.cuil),
      r2_claseDocumento: '1',
      r2_tipoDocumento: '02',
      r2_numeroDocumento: String(pago.cuil),
      r2_datosEmpresa: 'USO INTERNO',
      r2_identificadorPrestamo: '0000',
    });
    expect(detalle?.valores['r2_entidad']).toHaveLength(4);
    expect(detalle?.valores['r2_sucursal']).toHaveLength(4);
  });

  it('produce R3 con total y cantidad de la misma lista', () => {
    const pagos = [pagoSintetico(1), pagoSintetico(2), pagoSintetico(3)];
    const resultado = valor(
      mapearBna(perfilSintetico(), parametrosSinteticos(), pagos, politicaSintetica()),
    );
    const esperado = pagos.reduce((total, pago) => total + pago.neto, 0n);
    expect(resultado.totales.totalImporte).toBe(esperado);
    expect(resultado.totales.cantidad).toBe(3);
    expect(r3(resultado)?.valores).toEqual({
      r3_totalImporte: String(esperado),
      r3_totalCantidad: '3',
    });
  });

  it('preserva el orden de los pagos y emite un R2 por pago', () => {
    const pagos = [pagoSintetico(4), pagoSintetico(5), pagoSintetico(6)];
    const resultado = valor(
      mapearBna(perfilSintetico(), parametrosSinteticos(), pagos, politicaSintetica()),
    );
    expect(resultado.entradas.map((entrada) => entrada.recordId)).toEqual([
      'BNA_R1',
      'BNA_R2',
      'BNA_R2',
      'BNA_R2',
      'BNA_R3',
    ]);
    expect(r2s(resultado).map((entrada) => entrada.valores['r2_numeroDocumento'])).toEqual(
      pagos.map((pago) => String(pago.cuil)),
    );
  });

  it('acepta el importe máximo exacto y rechaza máximo + 1 con NETO_EXCEDE_LAYOUT', () => {
    const maximo = {
      ...pagoSintetico(7, { neto: MAX_IMPORTE_R2 }),
    };
    expect(
      mapearBna(perfilSintetico(), parametrosSinteticos(), [maximo], politicaSintetica()).ok,
    ).toBe(true);
    const excedido = pagoSintetico(8, { neto: (MAX_IMPORTE_R2 + 1n) as Centavos });
    const resultado = mapearBna(
      perfilSintetico(),
      parametrosSinteticos(),
      [excedido],
      politicaSintetica(),
    );
    expect(codigos(resultado)).toContain('NETO_EXCEDE_LAYOUT');
  });

  it('rechaza un neto negativo como error de layout BNA', () => {
    const negativo = pagoSintetico(9, { neto: -1n as Centavos });
    expect(
      codigos(
        mapearBna(perfilSintetico(), parametrosSinteticos(), [negativo], politicaSintetica()),
      ),
    ).toContain('NETO_NEGATIVO');
  });

  it('no acepta una lista vacía como archivo BNA', () => {
    expect(
      codigos(mapearBna(perfilSintetico(), parametrosSinteticos(), [], politicaSintetica())),
    ).toContain('SIN_PAGOS');
  });

  it('valida solo la forma técnica de fecha AAAAMMDD, sin calendario (BNA-7 abierta)', () => {
    const parametros = parametrosSinteticos({ fechaCompensacion: '20261399' });
    expect(
      mapearBna(perfilSintetico(), parametros, [pagoSintetico(1)], politicaSintetica()).ok,
    ).toBe(true);
    expect(
      codigos(
        mapearBna(
          perfilSintetico(),
          parametrosSinteticos({ fechaCompensacion: '2026-10-30' }),
          [pagoSintetico(1)],
          politicaSintetica(),
        ),
      ),
    ).toContain('FECHA_COMPENSACION_INVALIDA');
  });

  it('valida número de envío explícito y no calcula el día', () => {
    expect(
      mapearBna(
        perfilSintetico(),
        parametrosSinteticos({ numeroEnvio: '123456' }),
        [pagoSintetico(1)],
        politicaSintetica(),
      ).ok,
    ).toBe(true);
    expect(
      codigos(
        mapearBna(
          perfilSintetico(),
          parametrosSinteticos({ numeroEnvio: '1234567' }),
          [pagoSintetico(1)],
          politicaSintetica(),
        ),
      ),
    ).toContain('NUMERO_ENVIO_INVALIDO');
  });
});

describe('mapper BNA · convenio 4/8 y rechazo BNA-5', () => {
  it('4 dígitos usa 00 + 4 + 0000; 8 dígitos usa 00 + 8', () => {
    const cuatro = valor(
      mapearBna(
        perfilSintetico('4455'),
        parametrosSinteticos(),
        [pagoSintetico(1)],
        politicaSintetica(),
      ),
    );
    expect(r1(cuatro)?.valores['r1_codigoConvenio']).toBe('0044550000');
    const ocho = valor(
      mapearBna(
        perfilSintetico('44556677'),
        parametrosSinteticos(),
        [pagoSintetico(1)],
        politicaSintetica(),
      ),
    );
    expect(r1(ocho)?.valores['r1_codigoConvenio']).toBe('0044556677');
    expect(r1(ocho)?.valores['r1_codigoConvenio']).toHaveLength(10);
  });

  it.each(['12345', '123456', '1234567'])('rechaza %s sin adivinar relleno (BNA-5)', (codigo) => {
    expect(
      codigos(
        mapearBna(
          perfilSintetico(codigo),
          parametrosSinteticos(),
          [pagoSintetico(1)],
          politicaSintetica(),
        ),
      ),
    ).toContain('CONVENIO_LONGITUD_BNA5');
  });

  it('distingue convenio no numérico de longitud no definida', () => {
    expect(
      codigos(
        mapearBna(
          perfilSintetico('12A4'),
          parametrosSinteticos(),
          [pagoSintetico(1)],
          politicaSintetica(),
        ),
      ),
    ).toContain('CONVENIO_NO_NUMERICO');
  });
});

describe('mapper BNA · política productiva y ausencia de decisiones', () => {
  it('la política productiva deja sin resolver BNA-1, BNA-2, BNA-6, P-09/P-10 y BNA-11/P-17', () => {
    const resultado = mapearBna(
      perfilSintetico(),
      parametrosSinteticos(),
      [pagoSintetico(1)],
      POLITICA_BNA_PRODUCTIVA,
    );
    expect(resultado.ok).toBe(false);
    expect(new Set(puntos(resultado))).toEqual(
      new Set(['BNA-1', 'BNA-2', 'BNA-6', 'P-09/P-10', 'BNA-11/P-17']),
    );
    expect(codigos(resultado).every((codigo) => codigo === 'POLITICA_SIN_RESOLUCION')).toBe(true);
  });

  it('BNA-1 ausente no se reemplaza por 02 ni 96', () => {
    const resultado = mapearBna(
      perfilSintetico(),
      parametrosSinteticos(),
      [pagoSintetico(1)],
      politicaSintetica({ documento: () => sinResolucion('BNA-1') }),
    );
    expect(puntos(resultado)).toContain('BNA-1');
    expect(errores(resultado).some((error) => error.campoId === 'r2_tipoDocumento')).toBe(true);
    const tipo = REGISTROS_BNA.flatMap((registro) => registro.fields).find(
      (campo) => campo.id === ID_CAMPO_BNA_TIPO_DOCUMENTO,
    );
    expect(tipo?.fixedValue).toBeUndefined();
    expect(ISSUES_BNA['BNA-1'].estado).toBe('BLOQUEADA');
  });

  it('BNA-2 y BNA-6 sin resolución no eligen CBU, entidad ni sucursal', () => {
    const soloBna2 = mapearBna(
      perfilSintetico(),
      parametrosSinteticos(),
      [pagoSintetico(1)],
      politicaSintetica({ cbuCuenta: () => sinResolucion('BNA-2') }),
    );
    expect(puntos(soloBna2)).toEqual(['BNA-2']);
    const soloBna6 = mapearBna(
      perfilSintetico(),
      parametrosSinteticos(),
      [pagoSintetico(1)],
      politicaSintetica({ entidadSucursal: () => sinResolucion('BNA-6') }),
    );
    expect(puntos(soloBna6)).toContain('BNA-6');
  });

  it('P-09/P-10 no se infieren desde Descripcion ni se fija 0003', () => {
    const pago = pagoSintetico(1);
    const resultado = mapearBna(
      perfilSintetico(),
      parametrosSinteticos(),
      [
        {
          ...pago,
          descripcion: descripcionSinClasificar('LIQUIDACION FINAL AGRARIO'),
        },
      ],
      politicaSintetica({ identificadorPrestamo: () => sinResolucion('P-09/P-10') }),
    );
    expect(puntos(resultado)).toEqual(['P-09/P-10']);
    expect(errores(resultado).some((error) => error.campoId === 'r2_identificadorPrestamo')).toBe(
      true,
    );
  });

  it('BNA-11/P-17 exige política explícita para información y campos libres', () => {
    const info = mapearBna(
      perfilSintetico(),
      parametrosSinteticos(),
      [pagoSintetico(1)],
      politicaSintetica({ infoCriterio: () => sinResolucion('BNA-11/P-17') }),
    );
    expect(puntos(info)).toEqual(['BNA-11/P-17']);
    expect(errores(info)[0]?.campoId).toBe('r1_infoCriterioEmpresa');
    const beneficiario = mapearBna(
      perfilSintetico(),
      parametrosSinteticos(),
      [pagoSintetico(1)],
      politicaSintetica({ camposBeneficiario: () => sinResolucion('BNA-11/P-17') }),
    );
    expect(puntos(beneficiario)).toEqual(['BNA-11/P-17']);
  });

  it('una política sintética puede recorrer el camino técnico sin mutar la spec', () => {
    // Hipótesis de test: `02`/`0000` solo existen en la política sintética; no son una
    // decisión bancaria ni habilitan producción.
    const resultado = mapearBna(
      perfilSintetico(),
      parametrosSinteticos(),
      [pagoSintetico(1)],
      politicaSintetica(),
    );
    expect(resultado.ok).toBe(true);
    expect(ISSUES_BNA['BNA-1'].estado).toBe('BLOQUEADA');
    expect(
      REGISTROS_BNA.some((registro) =>
        registro.fields.some((campo) => campo.fixedValue === '02' || campo.fixedValue === '96'),
      ),
    ).toBe(false);
  });
});

describe('mapper BNA · BNA-8 sin transformaciones', () => {
  it.each([
    ['minúsculas', 'haberes'],
    ['ñ', 'AÑO'],
    ['acento', 'AÑO Á'],
    ['tab', 'HAB\tERES'],
    ['CR/LF', 'HAB\nERES'],
    ['no ASCII', 'HABERES €'],
  ])('rechaza %s en referencia A', (_nombre, referenciaUnivoca) => {
    const resultado = mapearBna(
      perfilSintetico(),
      parametrosSinteticos({ referenciaUnivoca }),
      [pagoSintetico(1)],
      politicaSintetica(),
    );
    expect(codigos(resultado)).toContain('ALFABETO_BNA8_INVALIDO');
    expect(resultado.ok).toBe(false);
  });

  it('rechaza caracteres inválidos devueltos por la política, sin transformarlos', () => {
    const info = mapearBna(
      perfilSintetico(),
      parametrosSinteticos(),
      [pagoSintetico(1)],
      politicaSintetica({
        infoCriterio: () => ({ estado: 'RESUELTO', valor: 'pago haberes' }),
      }),
    );
    expect(codigos(info)).toContain('ALFABETO_BNA8_INVALIDO');
    const beneficiario = mapearBna(
      perfilSintetico(),
      parametrosSinteticos(),
      [pagoSintetico(1)],
      politicaSintetica({
        camposBeneficiario: () => ({
          estado: 'RESUELTO',
          valor: { identificacionBeneficiario: 'AÑO', datosEmpresa: '' },
        }),
      }),
    );
    expect(codigos(beneficiario)).toContain('ALFABETO_BNA8_INVALIDO');
  });

  it('rechaza textos que exceden la longitud de la spec', () => {
    const resultado = mapearBna(
      perfilSintetico(),
      parametrosSinteticos({ referenciaUnivoca: 'A'.repeat(16) }),
      [pagoSintetico(1)],
      politicaSintetica(),
    );
    expect(codigos(resultado)).toContain('LONGITUD_EXCEDIDA');
  });
});

describe('mapper BNA · valores de política malformados', () => {
  it('rechaza tipo/clase documental malformados', () => {
    const tipo = mapearBna(
      perfilSintetico(),
      parametrosSinteticos(),
      [pagoSintetico(1)],
      politicaSintetica({
        documento: () => ({
          estado: 'RESUELTO',
          valor: { claseDocumento: '1', tipoDocumento: '9' },
        }),
      }),
    );
    expect(codigos(tipo)).toContain('POLITICA_INVALIDA');
    const clase = mapearBna(
      perfilSintetico(),
      parametrosSinteticos(),
      [pagoSintetico(1)],
      politicaSintetica({
        documento: () =>
          ({ estado: 'RESUELTO', valor: { claseDocumento: '3', tipoDocumento: '02' } }) as never,
      }),
    );
    expect(codigos(clase)).toContain('POLITICA_INVALIDA');
  });

  it('rechaza identificador de préstamo, entidad o sucursal de longitud incorrecta', () => {
    const prestamo = mapearBna(
      perfilSintetico(),
      parametrosSinteticos(),
      [pagoSintetico(1)],
      politicaSintetica({ identificadorPrestamo: () => ({ estado: 'RESUELTO', valor: '1' }) }),
    );
    expect(prestamo.ok).toBe(false);
    expect(codigos(prestamo)).toContain('POLITICA_INVALIDA');
    const entidad = mapearBna(
      perfilSintetico(),
      parametrosSinteticos(),
      [pagoSintetico(1)],
      politicaSintetica({
        entidadSucursal: () => ({
          estado: 'RESUELTO',
          valor: { entidad: '011', sucursal: '0001' },
        }),
      }),
    );
    expect(entidad.ok).toBe(false);
    const sucursal = mapearBna(
      perfilSintetico(),
      parametrosSinteticos(),
      [pagoSintetico(1)],
      politicaSintetica({
        entidadSucursal: () => ({
          estado: 'RESUELTO',
          valor: { entidad: '0011', sucursal: '01' },
        }),
      }),
    );
    expect(sucursal.ok).toBe(false);
  });

  it('rechaza moneda inválida y referencias no textuales', () => {
    expect(
      codigos(
        mapearBna(
          { ...perfilSintetico(), moneda: '2' as never },
          parametrosSinteticos(),
          [pagoSintetico(1)],
          politicaSintetica(),
        ),
      ),
    ).toContain('MONEDA_INVALIDA');
    expect(
      codigos(
        mapearBna(
          perfilSintetico(),
          parametrosSinteticos({ referenciaUnivoca: '' }),
          [pagoSintetico(1)],
          politicaSintetica(),
        ),
      ),
    ).toContain('REFERENCIA_INVALIDA');
  });

  it('acepta campos libres vacíos solo si la política lo resuelve explícitamente', () => {
    const resultado = mapearBna(
      perfilSintetico(),
      parametrosSinteticos(),
      [pagoSintetico(1)],
      politicaSintetica({
        infoCriterio: () => ({ estado: 'RESUELTO', valor: '' }),
        camposBeneficiario: () => ({
          estado: 'RESUELTO',
          valor: { identificacionBeneficiario: '', datosEmpresa: '' },
        }),
      }),
    );
    expect(resultado.ok).toBe(true);
  });
});

describe('mapper BNA · perfil sintético auxiliar', () => {
  it('el CUIT sintético del helper conserva forma canónica', () => {
    expect(cuitSintetico()).toMatch(/^[0-9]{11}$/);
  });
});
