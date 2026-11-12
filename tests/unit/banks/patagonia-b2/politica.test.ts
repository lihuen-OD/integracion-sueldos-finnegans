// Política productiva: PAT-4, PAT-9/P-14, PAT-15, PAT-16 y P-20 están resueltos por
// decisiones internas; solo PAT-7/P-09/P-10 sigue abierto. Las resoluciones sintéticas
// son solo capacidades de test y no modifican ISSUES_PATAGONIA ni la aptitud.
import { describe, expect, it } from 'vitest';
import {
  DECISION_NOMBRE_PATAGONIA_PRODUCTIVA,
  POLITICA_PATAGONIA_PRODUCTIVA,
  resuelto,
  sinResolucion,
} from '../../../../src/banks/patagonia-b2';
import { pagoSintetico, parametrosSinteticos, perfilPatagonia } from './auxiliares';

describe('política Patagonia productiva', () => {
  it('resuelve PAT-4, PAT-9/P-14, PAT-15, PAT-16 y P-20 y solo deja abierto PAT-7/P-09/P-10', () => {
    const pago = pagoSintetico(0);
    expect(POLITICA_PATAGONIA_PRODUCTIVA.provinciaNoAplica(pago)).toEqual({
      estado: 'RESUELTO',
      valor: '00',
    });
    expect(POLITICA_PATAGONIA_PRODUCTIVA.loteo([pago])).toEqual({
      estado: 'RESUELTO',
      valor: [{ numeroLote: '0001', pagos: [pago] }],
    });
    expect(POLITICA_PATAGONIA_PRODUCTIVA.tipoLiquidacion(pago)).toEqual({
      estado: 'SIN_RESOLUCION',
      punto: 'PAT-7/P-09/P-10',
    });
    expect(DECISION_NOMBRE_PATAGONIA_PRODUCTIVA).toEqual({
      orden: 'APELLIDO_NOMBRE',
      separador: ' ',
      recortarExtremos: true,
      colapsarEspaciosInternos: true,
      truncamiento: 'RECHAZAR',
    });
    expect(POLITICA_PATAGONIA_PRODUCTIVA.nombre(pago)).toEqual({
      estado: 'RESUELTO',
      valor: {
        original: 'Pérez Ana',
        generado: 'PEREZ ANA',
        transformado: true,
        truncado: false,
      },
    });
    expect(
      POLITICA_PATAGONIA_PRODUCTIVA.versionLote(perfilPatagonia(), parametrosSinteticos()),
    ).toEqual({ estado: 'RESUELTO', valor: '' });
    expect(
      POLITICA_PATAGONIA_PRODUCTIVA.comprobanteNoInformado(pagoSintetico(0, { legajo: null })),
    ).toEqual({ estado: 'RESUELTO', valor: '0000000' });
    expect(POLITICA_PATAGONIA_PRODUCTIVA.comprobanteNoInformado(pago)).toEqual({
      estado: 'SIN_RESOLUCION',
      punto: 'PAT-16',
    });
  });

  it('los helpers de resolución son explícitos y no cambian la política productiva', () => {
    expect(resuelto('X')).toEqual({ estado: 'RESUELTO', valor: 'X' });
    expect(sinResolucion('PAT-16')).toEqual({
      estado: 'SIN_RESOLUCION',
      punto: 'PAT-16',
    });
    expect(POLITICA_PATAGONIA_PRODUCTIVA.loteo([pagoSintetico(0)]).estado).toBe('RESUELTO');
  });
});
