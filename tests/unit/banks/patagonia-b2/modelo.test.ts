// Modelo puro: solo los datos que alimentan campos B.2 y dinero en bigint. No hay CBU,
// CUIL, datos de alta ni decisiones bancarias escondidas en el modelo.
import { describe, expect, it } from 'vitest';
import * as patagonia from '../../../../src/banks/patagonia-b2';
import { loteSintetico, pagoSintetico, parametrosSinteticos, perfilPatagonia } from './auxiliares';

describe('modelo Patagonia B.2', () => {
  it('el perfil contiene únicamente el número de EMPRESA', () => {
    const perfil = perfilPatagonia('1234');
    expect(Object.keys(perfil)).toEqual(['numeroEmpresa']);
    expect(perfil.numeroEmpresa).toBe('1234');
  });

  it('el pago usa Centavos/bigint y no expone CBU, CUIL ni datos de alta', () => {
    const pago = pagoSintetico(0);
    expect(typeof pago.neto).toBe('bigint');
    expect('cbu' in pago).toBe(false);
    expect('cuil' in pago).toBe(false);
    expect('cuit' in pago).toBe(false);
    expect('tipoConvenio' in pago).toBe(false);
    expect(pago.provinciaDocumento).toBeNull();
  });

  it('los parámetros exigen configuración técnica explícita', () => {
    const parametros = parametrosSinteticos();
    expect(parametros.hipotesisRellenoPat1).toBe('ESPACIOS');
    expect(parametros.hipotesisDependenciaPat2).toBe('NUMERICA');
    expect(parametros.lineSeparator).toBe('\n');
    expect(parametros.trailingSeparator).toBe(false);
  });

  it('el lote es solo una agrupación explícita de los mismos pagos', () => {
    const pagos = [pagoSintetico(0), pagoSintetico(1)];
    const lote = loteSintetico('0001', pagos);
    expect(lote.pagos[0]).toBe(pagos[0]);
    expect(lote.pagos[1]).toBe(pagos[1]);
  });

  it('la API pública expone serialización e inspector, pero no la fachada run', () => {
    expect('serializarPatagonia' in patagonia).toBe(true);
    expect('inspeccionarPatagonia' in patagonia).toBe(true);
    expect('generarPatagonia' in patagonia).toBe(false);
  });
});
