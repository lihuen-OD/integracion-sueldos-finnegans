// CP-F7-BNA-Hipotesis-A1: política de hipótesis aislada para BNA-1/2/6.
// No es la política productiva, no cambia estados contractuales y no genera bytes.
// P-17 se compone explícitamente y P-09/P-10 se sustituye solo en tests para recorrer
// el camino técnico; la hipótesis A1 no se convierte en política productiva.
import { describe, expect, it } from 'vitest';
import {
  ISSUES_BNA,
  POLITICA_BNA_PRODUCTIVA,
  mapearBna,
  produccionBnaHabilitada,
  resuelto,
  sinResolucion,
  type ErrorMapeoBna,
  type PoliticaBna,
  type PuntoPoliticaBna,
  type ResultadoMapeoBna,
} from '../../../../src/banks/bna';
import { POLITICA_BNA_HIPOTESIS_TECNICA } from '../../../../src/banks/bna/politicaHipotesis';
import { parseCbu, type Cbu } from '../../../../src/domain/cbu';
import { generarBna } from '../../../../src/run/generacionBna';
import {
  conciliacionGoldenBna,
  parametrosGoldenBna,
  perfilV2Golden,
} from '../../../fixtures/synthetic/goldenBna';
import {
  createRandom,
  syntheticCbu,
  syntheticCuenta,
} from '../../../fixtures/synthetic/identities.ts';
import { pagoSintetico, parametrosSinteticos, perfilSintetico } from './auxiliares';

/** CBU sintético con DV validado por el oráculo de dominio. */
function cbuCon(entidad: string, sucursal: string, semilla: number): Cbu {
  const random = createRandom(semilla);
  const resultado = parseCbu(syntheticCbu(entidad, sucursal, syntheticCuenta(random)));
  if (!resultado.ok) {
    throw new Error(`CBU sintético rechazado: ${resultado.error}`);
  }
  return resultado.value;
}

function valor(resultado: {
  ok: boolean;
  value?: ResultadoMapeoBna;
  error?: readonly ErrorMapeoBna[];
}): ResultadoMapeoBna {
  if (!resultado.ok || resultado.value === undefined) {
    throw new Error(`mapeo rechazado: ${JSON.stringify(resultado.error)}`);
  }
  return resultado.value;
}

function puntos(resultado: { ok: boolean; error?: readonly ErrorMapeoBna[] }): PuntoPoliticaBna[] {
  if (resultado.ok) {
    throw new Error('mapeo aceptado cuando debía fallar');
  }
  return (resultado.error ?? [])
    .map((error) => error.punto)
    .filter((punto): punto is PuntoPoliticaBna => punto !== undefined);
}

function r1(resultado: ResultadoMapeoBna) {
  return resultado.entradas.find((entrada) => entrada.recordId === 'BNA_R1');
}

function r2(resultado: ResultadoMapeoBna) {
  return resultado.entradas.find((entrada) => entrada.recordId === 'BNA_R2');
}

/** Composición explícita de A1 con P-17 y un override de test para P-09/P-10. */
const POLITICA_CON_PENDIENTES_RESUELTAS: PoliticaBna = {
  ...POLITICA_BNA_HIPOTESIS_TECNICA,
  identificadorPrestamo: () => resuelto('0000'),
  infoCriterio: POLITICA_BNA_PRODUCTIVA.infoCriterio,
  camposBeneficiario: POLITICA_BNA_PRODUCTIVA.camposBeneficiario,
};

describe('POLITICA_BNA_HIPOTESIS_TECNICA · BNA-1', () => {
  it('resuelve clase 1, tipo 02 y conserva el CUIL de 11 dígitos', () => {
    const pago = pagoSintetico(1);
    const resultado = valor(
      mapearBna(
        perfilSintetico(),
        parametrosSinteticos(),
        [pago],
        POLITICA_CON_PENDIENTES_RESUELTAS,
      ),
    );
    const detalle = r2(resultado);
    expect(detalle?.valores['r2_claseDocumento']).toBe('1');
    expect(detalle?.valores['r2_tipoDocumento']).toBe('02');
    expect(detalle?.valores['r2_numeroDocumento']).toBe(String(pago.cuil));
    expect(String(detalle?.valores['r2_numeroDocumento'])).toMatch(/^[0-9]{11}$/);
  });

  it('no implementa la variante clase 2 / tipo 96', () => {
    const pago = pagoSintetico(2);
    expect(POLITICA_BNA_HIPOTESIS_TECNICA.documento(pago)).toEqual(
      resuelto({ claseDocumento: '1', tipoDocumento: '02' }),
    );
  });
});

describe('POLITICA_BNA_HIPOTESIS_TECNICA · BNA-2', () => {
  it('usa el CBU del beneficiario en R2 y el CBU empresarial en R1', () => {
    const perfil = { ...perfilSintetico(), cbuEmpresa: cbuCon('011', '0001', 11) };
    const cbuBeneficiario = cbuCon('007', '1234', 22);
    const pago = pagoSintetico(1, { cbu: cbuBeneficiario });
    const resultado = valor(
      mapearBna(perfil, parametrosSinteticos(), [pago], POLITICA_CON_PENDIENTES_RESUELTAS),
    );
    const cabecera = r1(resultado);
    const detalle = r2(resultado);
    expect(cabecera?.valores['r1_bloque2CbuEmpresa']).toBe(String(perfil.cbuEmpresa).slice(8, 22));
    expect(detalle?.valores['r2_bloque2Cuenta']).toBe(String(cbuBeneficiario).slice(8, 22));
    expect(detalle?.valores['r2_bloque2Cuenta']).not.toBe(
      cabecera?.valores['r1_bloque2CbuEmpresa'],
    );
    expect(POLITICA_BNA_HIPOTESIS_TECNICA.cbuCuenta(pago)).toEqual(resuelto(cbuBeneficiario));
  });
});

describe('POLITICA_BNA_HIPOTESIS_TECNICA · BNA-6', () => {
  it.each([
    { entidad: '007', sucursal: '1234', esperada: '0007', semilla: 33 },
    { entidad: '011', sucursal: '4321', esperada: '0011', semilla: 34 },
  ])(
    'deriva entidad 0 + 3 dígitos, sucursal de 4 y DV para la entidad $entidad',
    ({ entidad, sucursal, esperada, semilla }) => {
      const cbuBeneficiario = cbuCon(entidad, sucursal, semilla);
      const pago = pagoSintetico(1, { cbu: cbuBeneficiario });
      const resultado = valor(
        mapearBna(
          perfilSintetico(),
          parametrosSinteticos(),
          [pago],
          POLITICA_CON_PENDIENTES_RESUELTAS,
        ),
      );
      const detalle = r2(resultado);
      expect(detalle?.valores['r2_entidad']).toBe(esperada);
      expect(detalle?.valores['r2_sucursal']).toBe(sucursal);
      expect(detalle?.valores['r2_dvBloque1']).toBe(String(cbuBeneficiario).slice(7, 8));
      expect(detalle?.valores['r2_entidad']).toHaveLength(4);
      expect(detalle?.valores['r2_sucursal']).toHaveLength(4);
      expect(detalle?.valores['r2_dvBloque1']).toHaveLength(1);
    },
  );

  it('no descarta el primer dígito de una sucursal de cuatro dígitos', () => {
    const cbuBeneficiario = cbuCon('007', '1234', 35);
    const pago = pagoSintetico(1, { cbu: cbuBeneficiario });
    const resultado = valor(
      mapearBna(
        perfilSintetico(),
        parametrosSinteticos(),
        [pago],
        POLITICA_CON_PENDIENTES_RESUELTAS,
      ),
    );
    const detalle = r2(resultado);
    expect(detalle?.valores['r2_sucursal']).toBe('1234');
    expect(detalle?.valores['r2_sucursal']).not.toBe('0234');
  });

  it('preserva ceros iniciales en entidad, sucursal y sucursal de empresa', () => {
    const perfil = { ...perfilSintetico(), cbuEmpresa: cbuCon('011', '0001', 44) };
    const cbuBeneficiario = cbuCon('007', '0599', 55);
    const pago = pagoSintetico(1, { cbu: cbuBeneficiario });
    const resultado = valor(
      mapearBna(perfil, parametrosSinteticos(), [pago], POLITICA_CON_PENDIENTES_RESUELTAS),
    );
    expect(r1(resultado)?.valores['r1_sucursalEmpresa']).toBe('0001');
    expect(r2(resultado)?.valores['r2_entidad']).toBe('0007');
    expect(r2(resultado)?.valores['r2_sucursal']).toBe('0599');
  });
});

describe('hipótesis pendientes y cierre productivo', () => {
  it('deja BNA-11/P-17 y P-09/P-10 sin resolución', () => {
    const perfil = perfilSintetico();
    const parametros = parametrosSinteticos();
    const pago = pagoSintetico(1);
    const resultado = mapearBna(perfil, parametros, [pago], POLITICA_BNA_HIPOTESIS_TECNICA);
    expect(resultado.ok).toBe(false);
    expect(new Set(puntos(resultado))).toEqual(new Set(['BNA-11/P-17', 'P-09/P-10']));
    expect(puntos(resultado)).not.toContain('BNA-1');
    expect(puntos(resultado)).not.toContain('BNA-2');
    expect(puntos(resultado)).not.toContain('BNA-6');
    expect(POLITICA_BNA_HIPOTESIS_TECNICA.identificadorPrestamo(pago)).toEqual(
      sinResolucion('P-09/P-10'),
    );
    expect(POLITICA_BNA_HIPOTESIS_TECNICA.infoCriterio(perfil, parametros)).toEqual(
      sinResolucion('BNA-11/P-17'),
    );
    expect(POLITICA_BNA_HIPOTESIS_TECNICA.camposBeneficiario(pago, parametros)).toEqual(
      sinResolucion('BNA-11/P-17'),
    );
  });

  it('la política productiva resuelve C-1..C-4 y P-17, y solo conserva P-09/P-10', () => {
    const perfil = perfilSintetico();
    const parametros = parametrosSinteticos();
    const pago = pagoSintetico(1);
    expect(POLITICA_BNA_PRODUCTIVA.documento(pago)).toEqual(
      resuelto({ claseDocumento: '1', tipoDocumento: '02' }),
    );
    expect(POLITICA_BNA_PRODUCTIVA.cbuCuenta(pago)).toEqual(resuelto(pago.cbu));
    expect(POLITICA_BNA_PRODUCTIVA.sucursalEmpresa(perfil)).toEqual(
      resuelto(String(perfil.cbuEmpresa).slice(3, 7)),
    );
    expect(POLITICA_BNA_PRODUCTIVA.entidadSucursal(perfil, pago)).toEqual(
      resuelto({
        entidad: `0${String(pago.cbu).slice(0, 3)}`,
        sucursal: String(pago.cbu).slice(3, 7),
      }),
    );
    expect(POLITICA_BNA_PRODUCTIVA.identificadorPrestamo(pago)).toEqual(sinResolucion('P-09/P-10'));
    expect(POLITICA_BNA_PRODUCTIVA.infoCriterio(perfil, parametros)).toEqual(
      resuelto(parametros.infoCriterioEmpresa),
    );
    expect(POLITICA_BNA_PRODUCTIVA.camposBeneficiario(pago, parametros)).toEqual(
      resuelto({ identificacionBeneficiario: String(pago.cuil), datosEmpresa: '' }),
    );
  });

  it('BNA-1 queda confirmada por CUIL y la producción sigue cerrada', () => {
    expect(ISSUES_BNA['BNA-1'].estado).toBe('CONFIRMADA');
    expect(produccionBnaHabilitada()).toBe(false);
  });

  it('ningún camino público genera bytes', () => {
    const resultado = generarBna({
      perfil: perfilV2Golden(),
      conciliacion: conciliacionGoldenBna(),
      parametros: parametrosGoldenBna(),
    });
    expect(resultado.estado).not.toBe('GENERADO');
    expect('bytes' in resultado).toBe(false);
  });
});
