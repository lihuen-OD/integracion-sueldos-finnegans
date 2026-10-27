// Mapper puro: R0 + (R1 + R2*)+, sin serializar ni decidir preguntas abiertas. Cada test
// usa una política sintética explícita; la productiva solo demuestra que no hay defaults.
import { describe, expect, it } from 'vitest';
import type { Centavos } from '../../../../src/domain/money';
import {
  ISSUES_PATAGONIA,
  POLITICA_PATAGONIA_PRODUCTIVA,
  aptitudPatagonia,
  crearRegistrosPatagonia,
  crearSpecPatagoniaB2,
  mapearPatagonia,
  resuelto,
  sinResolucion,
  type ErrorMapeoPatagonia,
  type ResultadoMapeoPatagonia,
} from '../../../../src/banks/patagonia-b2';
import {
  loteSintetico,
  pagoSintetico,
  parametrosSinteticos,
  perfilPatagonia,
  politicaSintetica,
} from './auxiliares';

function exito(
  resultado:
    | { ok: true; value: ResultadoMapeoPatagonia }
    | { ok: false; error: readonly ErrorMapeoPatagonia[] },
): ResultadoMapeoPatagonia {
  if (!resultado.ok) {
    throw new Error(
      `mapeo inesperadamente rechazado: ${resultado.error.map((e) => e.codigo).join(',')}`,
    );
  }
  return resultado.value;
}

function errores(resultado: {
  ok: boolean;
  error?: readonly ErrorMapeoPatagonia[];
}): readonly ErrorMapeoPatagonia[] {
  return resultado.ok ? [] : (resultado.error ?? []);
}

function codigos(resultado: { ok: boolean; error?: readonly ErrorMapeoPatagonia[] }): string[] {
  return errores(resultado).map((error) => error.codigo);
}

function requerido<T>(valor: T | undefined): T {
  if (valor === undefined) {
    throw new Error('valor requerido ausente');
  }
  return valor;
}

function entrada(
  resultado: ResultadoMapeoPatagonia,
  recordId: string,
  indice = 0,
): Record<string, string> {
  return requerido(resultado.entradas.filter((e) => e.recordId === recordId)[indice]).valores;
}

describe('mapper Patagonia · estructura y contenido', () => {
  it('emite R0, R1 y R2 en orden, sin bytes ni serialización', () => {
    const pagos = [pagoSintetico(0)];
    const resultado = exito(
      mapearPatagonia(perfilPatagonia('1234'), parametrosSinteticos(), pagos, politicaSintetica()),
    );
    expect(resultado.entradas.map((e) => e.recordId)).toEqual(['PAT_R0', 'PAT_R1', 'PAT_R2']);
    expect('bytes' in resultado).toBe(false);
    expect('texto' in resultado).toBe(false);

    expect(entrada(resultado, 'PAT_R0')).toEqual({
      r0_numeroEmpresa: '1234',
      r0_fechaPresentacion: '20261027',
      r0_numeroEnvio: '1',
      r0_cantidadLotes: '1',
      r0_importeLotes: '123456',
      r0_numeroEmpresaFinal: '1234',
    });
    expect(entrada(resultado, 'PAT_R1')).toEqual({
      r1_numeroLote: '0001',
      r1_concepto: 'HAB.05/00',
      r1_cantidadLote: '1',
      r1_importeLote: '123456',
      r1_fechaAcreditacion: '20261030',
      r1_numeroEnvio: '1',
      r1_version: '',
      r1_numeroEmpresa: '1234',
    });
    expect(entrada(resultado, 'PAT_R2')).toEqual({
      r2_numeroLote: '0001',
      r2_tipoCuenta: '2',
      r2_numeroCuenta: '0000001234',
      r2_importeNeto: '123456',
      r2_numeroComprobante: '1000',
      r2_apellidoNombre: 'PEREZ ANA',
      r2_codigoBanco: '034',
      r2_codigoSucursal: '0001',
      r2_tipoDocumento: '001',
      r2_numeroDocumento: '20000000',
      r2_provinciaDocumento: '00',
      r2_codigoDependencia: '1234',
      r2_tipoLiquidacion: '001',
      r2_numeroEmpresa: '1234',
    });
    expect(resultado.totales).toEqual({
      totalImporte: 123_456n,
      cantidadPagos: 1,
      cantidadLotes: 1,
      importesPorLote: [123_456n],
    });
  });

  it('no incluye campos fijos en las entradas del llamador', () => {
    const resultado = exito(
      mapearPatagonia(
        perfilPatagonia(),
        parametrosSinteticos(),
        [pagoSintetico(0)],
        politicaSintetica(),
      ),
    );
    const r0 = entrada(resultado, 'PAT_R0');
    const r1 = entrada(resultado, 'PAT_R1');
    const r2 = entrada(resultado, 'PAT_R2');
    expect(r0['r0_tipoRegistro']).toBeUndefined();
    expect(r0['r0_codigoBanco']).toBeUndefined();
    expect(r1['r1_tipoRegistro']).toBeUndefined();
    expect(r1['r1_tipoMovimiento']).toBeUndefined();
    expect(r2['r2_tipoRegistro']).toBeUndefined();
    expect(r2['r2_espacios']).toBeUndefined();
    expect(Object.values(r0).every((valor) => typeof valor === 'string')).toBe(true);
  });

  it('emite varios lotes con cantidades e importes consistentes', () => {
    const pagos = [pagoSintetico(0), pagoSintetico(1), pagoSintetico(2)];
    const lotes = [
      loteSintetico('0001', [requerido(pagos[0]), requerido(pagos[1])]),
      loteSintetico('0002', [requerido(pagos[2])]),
    ];
    const resultado = exito(
      mapearPatagonia(
        perfilPatagonia('99'),
        parametrosSinteticos(),
        pagos,
        politicaSintetica({ loteo: () => resuelto(lotes) }),
      ),
    );
    expect(resultado.entradas.map((e) => e.recordId)).toEqual([
      'PAT_R0',
      'PAT_R1',
      'PAT_R2',
      'PAT_R2',
      'PAT_R1',
      'PAT_R2',
    ]);
    const r1s = resultado.entradas.filter((e) => e.recordId === 'PAT_R1');
    expect(r1s.map((e) => e.valores['r1_cantidadLote'])).toEqual(['2', '1']);
    expect(r1s.map((e) => e.valores['r1_importeLote'])).toEqual(['246913', '123458']);
    expect(r1s.map((e) => e.valores['r1_numeroEmpresa'])).toEqual(['99', '99']);
    expect(entrada(resultado, 'PAT_R0')['r0_cantidadLotes']).toBe('2');
    expect(entrada(resultado, 'PAT_R0')['r0_importeLotes']).toBe('370371');
    expect(resultado.totales.importesPorLote).toEqual([246_913n, 123_458n]);
  });
});

describe('mapper Patagonia · validaciones de entrada', () => {
  it('rechaza lista vacía', () => {
    const resultado = mapearPatagonia(
      perfilPatagonia(),
      parametrosSinteticos(),
      [],
      politicaSintetica(),
    );
    expect(codigos(resultado)).toContain('SIN_PAGOS');
  });

  it('rechaza perfil, fechas, envío y concepto inválidos', () => {
    expect(
      codigos(
        mapearPatagonia(
          perfilPatagonia('12345'),
          parametrosSinteticos(),
          [pagoSintetico(0)],
          politicaSintetica(),
        ),
      ),
    ).toContain('NUMERO_EMPRESA_INVALIDO');
    expect(
      codigos(
        mapearPatagonia(
          perfilPatagonia(),
          parametrosSinteticos({ fechaPresentacion: '2026-10-27' }),
          [pagoSintetico(0)],
          politicaSintetica(),
        ),
      ),
    ).toContain('FECHA_INVALIDA');
    expect(
      codigos(
        mapearPatagonia(
          perfilPatagonia(),
          parametrosSinteticos({ numeroEnvio: '99' }),
          [pagoSintetico(0)],
          politicaSintetica(),
        ),
      ),
    ).toContain('NUMERO_ENVIO_PROHIBIDO');
    expect(
      codigos(
        mapearPatagonia(
          perfilPatagonia(),
          parametrosSinteticos({ concepto: '' }),
          [pagoSintetico(0)],
          politicaSintetica(),
        ),
      ),
    ).toContain('TEXTO_VACIO');
  });

  it('rechaza campos de cuenta/documento inválidos', () => {
    const pagos = [
      pagoSintetico(0, {
        numeroCuenta: '12345678901',
        codigoBanco: '34',
        codigoSucursal: '000001',
        numeroDocumento: 'x',
      }),
    ];
    const resultado = mapearPatagonia(
      perfilPatagonia(),
      parametrosSinteticos(),
      pagos,
      politicaSintetica(),
    );
    expect(codigos(resultado)).toEqual(
      expect.arrayContaining(['LONGITUD_INVALIDA', 'DIGITO_INVALIDO']),
    );
    expect(errores(resultado).some((e) => e.campoId === 'r2_codigoBanco')).toBe(true);
    expect(errores(resultado).some((e) => e.campoId === 'r2_codigoSucursal')).toBe(true);
  });

  it('rechaza neto cero, negativo o fuera de layout', () => {
    const casos = [0n, -1n, 100_000_000_000n];
    for (const neto of casos) {
      const resultado = mapearPatagonia(
        perfilPatagonia(),
        parametrosSinteticos(),
        [pagoSintetico(0, { neto: neto as Centavos })],
        politicaSintetica(),
      );
      expect(codigos(resultado)).toContain(neto > 0n ? 'NETO_EXCEDE_LAYOUT' : 'NETO_NO_POSITIVO');
    }
  });
});

describe('mapper Patagonia · decisiones abiertas', () => {
  it('la política productiva no resuelve el loteo (P-20)', () => {
    const resultado = mapearPatagonia(
      perfilPatagonia(),
      parametrosSinteticos(),
      [pagoSintetico(0)],
      POLITICA_PATAGONIA_PRODUCTIVA,
    );
    expect(errores(resultado)).toEqual([
      expect.objectContaining({ codigo: 'POLITICA_SIN_RESOLUCION', punto: 'P-20' }),
    ]);
  });

  it('PAT-7/P-09/P-10 no se resuelve por default', () => {
    const resultado = mapearPatagonia(
      perfilPatagonia(),
      parametrosSinteticos(),
      [pagoSintetico(0)],
      politicaSintetica({ tipoLiquidacion: () => sinResolucion('PAT-7/P-09/P-10') }),
    );
    expect(errores(resultado)).toEqual([
      expect.objectContaining({
        codigo: 'POLITICA_SIN_RESOLUCION',
        punto: 'PAT-7/P-09/P-10',
        campoId: 'r2_tipoLiquidacion',
      }),
    ]);
  });

  it('PAT-9/P-14 no se resuelve por default', () => {
    const resultado = mapearPatagonia(
      perfilPatagonia(),
      parametrosSinteticos(),
      [pagoSintetico(0)],
      politicaSintetica({ nombre: () => sinResolucion('PAT-9/P-14') }),
    );
    expect(errores(resultado)).toEqual([
      expect.objectContaining({
        codigo: 'POLITICA_SIN_RESOLUCION',
        punto: 'PAT-9/P-14',
        campoId: 'r2_apellidoNombre',
      }),
    ]);
  });

  it('PAT-15 no se resuelve por default', () => {
    const resultado = mapearPatagonia(
      perfilPatagonia(),
      parametrosSinteticos(),
      [pagoSintetico(0)],
      politicaSintetica({ versionLote: () => sinResolucion('PAT-15') }),
    );
    expect(errores(resultado)).toEqual([
      expect.objectContaining({
        codigo: 'POLITICA_SIN_RESOLUCION',
        punto: 'PAT-15',
        campoId: 'r1_version',
      }),
    ]);
  });

  it('PAT-16 no se resuelve por default cuando falta el legajo', () => {
    const resultado = mapearPatagonia(
      perfilPatagonia(),
      parametrosSinteticos(),
      [pagoSintetico(0, { legajo: null })],
      politicaSintetica({ comprobanteNoInformado: () => sinResolucion('PAT-16') }),
    );
    expect(errores(resultado)).toEqual([
      expect.objectContaining({
        codigo: 'POLITICA_SIN_RESOLUCION',
        punto: 'PAT-16',
        campoId: 'r2_numeroComprobante',
      }),
    ]);
  });

  it('PAT-4: con tipo 004 usa la provincia del dato y no llama a la política', () => {
    const resultado = exito(
      mapearPatagonia(
        perfilPatagonia(),
        parametrosSinteticos(),
        [pagoSintetico(0, { tipoDocumento: '004', provinciaDocumento: '02' })],
        politicaSintetica({
          provinciaNoAplica: () => {
            throw new Error('no debe resolver PAT-4 con tipo 004');
          },
        }),
      ),
    );
    expect(entrada(resultado, 'PAT_R2')['r2_provinciaDocumento']).toBe('02');
  });

  it('PAT-4: con tipo 004 exige provincia', () => {
    const resultado = mapearPatagonia(
      perfilPatagonia(),
      parametrosSinteticos(),
      [pagoSintetico(0, { tipoDocumento: '004', provinciaDocumento: null })],
      politicaSintetica(),
    );
    expect(errores(resultado)).toEqual([
      expect.objectContaining({
        codigo: 'PROVINCIA_INVALIDA',
        campoId: 'r2_provinciaDocumento',
      }),
    ]);
  });

  it('PAT-4: con tipo distinto no acepta provincia informada', () => {
    const resultado = mapearPatagonia(
      perfilPatagonia(),
      parametrosSinteticos(),
      [pagoSintetico(0, { tipoDocumento: '001', provinciaDocumento: '02' })],
      politicaSintetica(),
    );
    expect(codigos(resultado)).toContain('PROVINCIA_NO_CORRESPONDE');
  });

  it('PAT-4: sin provincia y tipo distinto, la política debe resolver', () => {
    const resultado = mapearPatagonia(
      perfilPatagonia(),
      parametrosSinteticos(),
      [pagoSintetico(0)],
      politicaSintetica({ provinciaNoAplica: () => sinResolucion('PAT-4') }),
    );
    expect(errores(resultado)).toEqual([
      expect.objectContaining({
        codigo: 'POLITICA_SIN_RESOLUCION',
        punto: 'PAT-4',
        campoId: 'r2_provinciaDocumento',
      }),
    ]);
  });
});

describe('mapper Patagonia · campos derivados y políticas', () => {
  it('usa el legajo como comprobante cuando es directamente utilizable', () => {
    const resultado = exito(
      mapearPatagonia(
        perfilPatagonia(),
        parametrosSinteticos(),
        [pagoSintetico(0, { legajo: '0007' })],
        politicaSintetica({
          comprobanteNoInformado: () => {
            throw new Error('no debe usarse la política de PAT-16');
          },
        }),
      ),
    );
    expect(entrada(resultado, 'PAT_R2')['r2_numeroComprobante']).toBe('0007');
  });

  it('PAT-16: si el legajo no sirve, usa la resolución explícita', () => {
    for (const legajo of [null, '', '12345678', 'ABCD']) {
      const resultado = exito(
        mapearPatagonia(
          perfilPatagonia(),
          parametrosSinteticos(),
          [pagoSintetico(0, { legajo })],
          politicaSintetica({ comprobanteNoInformado: () => resuelto('0000007') }),
        ),
      );
      expect(entrada(resultado, 'PAT_R2')['r2_numeroComprobante']).toBe('0000007');
    }
  });

  it('valida el nombre generado por la política, sin recomponerlo', () => {
    const resultado = mapearPatagonia(
      perfilPatagonia(),
      parametrosSinteticos(),
      [pagoSintetico(0)],
      politicaSintetica({
        nombre: () =>
          resuelto({
            original: 'Pérez Ana',
            generado: 'Pérez ANA',
            transformado: true,
            truncado: false,
          }),
      }),
    );
    expect(codigos(resultado)).toContain('NOMBRE_CARACTER_NO_RESPALDADO');
  });

  it('valida la versión resuelta por PAT-15', () => {
    const resultado = mapearPatagonia(
      perfilPatagonia(),
      parametrosSinteticos(),
      [pagoSintetico(0)],
      politicaSintetica({ versionLote: () => resuelto('123456789') }),
    );
    expect(codigos(resultado)).toContain('VERSION_INVALIDA');
  });

  it('valida el tipo de liquidación sin imponer un catálogo DR/XL (PAT-7 abierta)', () => {
    const resultado = mapearPatagonia(
      perfilPatagonia(),
      parametrosSinteticos(),
      [pagoSintetico(0)],
      politicaSintetica({ tipoLiquidacion: () => resuelto('005') }),
    );
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(entrada(resultado.value, 'PAT_R2')['r2_tipoLiquidacion']).toBe('005');
    }
  });

  it('usa el código de banco del pago y no hardcodea 034 en R2 (PAT-17)', () => {
    const resultado = exito(
      mapearPatagonia(
        perfilPatagonia(),
        parametrosSinteticos(),
        [pagoSintetico(0, { codigoBanco: '007' })],
        politicaSintetica(),
      ),
    );
    expect(entrada(resultado, 'PAT_R2')['r2_codigoBanco']).toBe('007');
    expect(ISSUES_PATAGONIA['PAT-17'].estado).toBe('INTERPRETACION_PENDIENTE');

    const [r0] = crearRegistrosPatagonia(parametrosSinteticos());
    expect(r0.fields.find((campo) => campo.id === 'r0_codigoBanco')?.fixedValue).toBe('034');
  });

  it('respeta la hipótesis PAT-2 sin convertirla en decisión bancaria', () => {
    const pagos = [pagoSintetico(0, { codigoDependencia: 'A-1' })];
    const numerica = mapearPatagonia(
      perfilPatagonia(),
      parametrosSinteticos(),
      pagos,
      politicaSintetica(),
    );
    expect(codigos(numerica)).toContain('DEPENDENCIA_INVALIDA');

    const alfanumerica = exito(
      mapearPatagonia(
        perfilPatagonia(),
        parametrosSinteticos({ hipotesisDependenciaPat2: 'ALFANUMERICA' }),
        pagos,
        politicaSintetica(),
      ),
    );
    expect(entrada(alfanumerica, 'PAT_R2')['r2_codigoDependencia']).toBe('A-1');
    expect(ISSUES_PATAGONIA['PAT-2'].estado).toBe('BLOQUEADA');
  });

  it('PAT-1 y PAT-2 siguen bloqueando la generación, aunque el mapper sea técnico', () => {
    const spec = crearSpecPatagoniaB2(parametrosSinteticos());
    const aptitud = aptitudPatagonia(spec);
    expect(aptitud.generadorHabilitado).toBe(false);
    expect(ISSUES_PATAGONIA['PAT-1'].estado).toBe('BLOQUEADA');
    expect(ISSUES_PATAGONIA['PAT-2'].estado).toBe('BLOQUEADA');
    const resultado = exito(
      mapearPatagonia(
        perfilPatagonia(),
        parametrosSinteticos(),
        [pagoSintetico(0)],
        politicaSintetica(),
      ),
    );
    expect(resultado.entradas.length).toBeGreaterThan(0);
  });

  it('rechaza un loteo que no cubre exactamente los pagos', () => {
    const pagos = [pagoSintetico(0), pagoSintetico(1)];
    const resultado = mapearPatagonia(
      perfilPatagonia(),
      parametrosSinteticos(),
      pagos,
      politicaSintetica({ loteo: () => resuelto([loteSintetico('0001', [requerido(pagos[0])])]) }),
    );
    expect(codigos(resultado)).toContain('LOTEO_NO_COINCIDE_CON_PAGOS');
  });

  it('PAT-5: acepta 71 (no impone 1–70) y rechaza 99', () => {
    const aceptado = mapearPatagonia(
      perfilPatagonia(),
      parametrosSinteticos({ numeroEnvio: '71' }),
      [pagoSintetico(0)],
      politicaSintetica(),
    );
    expect(aceptado.ok).toBe(true);
    const rechazado = mapearPatagonia(
      perfilPatagonia(),
      parametrosSinteticos({ numeroEnvio: '99' }),
      [pagoSintetico(0)],
      politicaSintetica(),
    );
    expect(codigos(rechazado)).toContain('NUMERO_ENVIO_PROHIBIDO');
  });
});
