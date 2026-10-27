// Política productiva: ningún punto abierto se resuelve. Las resoluciones sintéticas son
// solo capacidades de test y no modifican ISSUES_PATAGONIA ni la aptitud.
import { describe, expect, it } from 'vitest';
import {
  POLITICA_PATAGONIA_PRODUCTIVA,
  resuelto,
  sinResolucion,
} from '../../../../src/banks/patagonia-b2';
import { pagoSintetico, parametrosSinteticos, perfilPatagonia } from './auxiliares';

describe('política Patagonia productiva', () => {
  it('no resuelve P-20, PAT-7/P-09/P-10, PAT-9/P-14, PAT-15 ni PAT-16', () => {
    const pago = pagoSintetico(0);
    expect(POLITICA_PATAGONIA_PRODUCTIVA.loteo([pago])).toEqual({
      estado: 'SIN_RESOLUCION',
      punto: 'P-20',
    });
    expect(POLITICA_PATAGONIA_PRODUCTIVA.tipoLiquidacion(pago)).toEqual({
      estado: 'SIN_RESOLUCION',
      punto: 'PAT-7/P-09/P-10',
    });
    expect(POLITICA_PATAGONIA_PRODUCTIVA.nombre(pago)).toEqual({
      estado: 'SIN_RESOLUCION',
      punto: 'PAT-9/P-14',
    });
    expect(
      POLITICA_PATAGONIA_PRODUCTIVA.versionLote(perfilPatagonia(), parametrosSinteticos()),
    ).toEqual({ estado: 'SIN_RESOLUCION', punto: 'PAT-15' });
    expect(POLITICA_PATAGONIA_PRODUCTIVA.comprobanteNoInformado(pago)).toEqual({
      estado: 'SIN_RESOLUCION',
      punto: 'PAT-16',
    });
  });

  it('no resuelve PAT-4 cuando la provincia no aplica', () => {
    const pago = pagoSintetico(0);
    expect(POLITICA_PATAGONIA_PRODUCTIVA.provinciaNoAplica(pago)).toEqual({
      estado: 'SIN_RESOLUCION',
      punto: 'PAT-4',
    });
  });

  it('los helpers de resolución son explícitos y no cambian la política productiva', () => {
    expect(resuelto('X')).toEqual({ estado: 'RESUELTO', valor: 'X' });
    expect(sinResolucion('PAT-15')).toEqual({
      estado: 'SIN_RESOLUCION',
      punto: 'PAT-15',
    });
    expect(POLITICA_PATAGONIA_PRODUCTIVA.loteo([pagoSintetico(0)]).estado).toBe('SIN_RESOLUCION');
  });
});
