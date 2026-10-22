// Pruebas de las etiquetas humanas (CP-F3-B): textos para quien administra la liquidación,
// simetría entre bancos (D-067) e importe con formato local. Solo presentación.
import { describe, expect, it } from 'vitest';
import {
  ETIQUETA_DESTINO,
  etiquetaAlcance,
  etiquetaEstadoFila,
  etiquetaImporte,
  ETIQUETA_MOTIVO_READINESS,
  ETIQUETA_MOTIVO_NO_APLICADA,
} from '../../../src/ui/etiquetas';

describe('etiquetaDestino · nombres humanos de los bancos (D-067)', () => {
  it('no expone los códigos internos al operador', () => {
    expect(ETIQUETA_DESTINO.BNA_GT_HABERES).toBe('Banco Nación');
    expect(ETIQUETA_DESTINO.PATAGONIA_B2).toBe('Banco Patagonia');
  });
});

describe('etiquetaImporte · pesos con centavos', () => {
  it('miles con punto y centavos con coma; guion para nulos', () => {
    expect(etiquetaImporte(42000025n)).toBe('420.000,25');
    expect(etiquetaImporte(1n)).toBe('0,01');
    expect(etiquetaImporte(-123456789n)).toBe('−1.234.567,89');
    expect(etiquetaImporte(null)).toBe('—');
  });
});

describe('etiquetaEstadoFila · estados en palabras', () => {
  it('INCLUIDA menciona el banco destino', () => {
    expect(
      etiquetaEstadoFila({
        estado: 'INCLUIDA',
        destino: 'BNA_GT_HABERES',
        origen: 'BANCO_FINNEGANS',
      }),
    ).toBe('Incluida · Banco Nación');
    expect(
      etiquetaEstadoFila({
        estado: 'INCLUIDA',
        destino: 'PATAGONIA_B2',
        origen: 'DECISION_OPERADOR',
      }),
    ).toBe('Incluida · Banco Patagonia');
  });

  it('EXCLUIDA y PENDIENTE explican por qué', () => {
    expect(etiquetaEstadoFila({ estado: 'EXCLUIDA', motivo: 'NETO_CERO' })).toContain(
      'Neto igual a cero',
    );
    expect(etiquetaEstadoFila({ estado: 'PENDIENTE', motivo: 'BANCO_VACIO' })).toContain(
      'elegir el destino',
    );
    expect(etiquetaEstadoFila({ estado: 'PENDIENTE', motivo: 'BANCO_NO_SOPORTADO' })).toContain(
      'no se adivina',
    );
  });
});

describe('alcance', () => {
  it('GLOBAL y de banco legibles', () => {
    expect(etiquetaAlcance('GLOBAL')).toBe('Toda la corrida');
    expect(etiquetaAlcance('BNA_GT_HABERES')).toBe('Banco Nación');
    expect(etiquetaAlcance('PATAGONIA_B2')).toBe('Banco Patagonia');
  });
});

describe('motivos con traza legible', () => {
  it('readiness: la configuración incompleta explica el estado honesto (D-065)', () => {
    expect(ETIQUETA_MOTIVO_READINESS.CONFIGURACION_INCOMPLETA).toContain(
      'pendientes de revisión humana',
    );
  });
  it('no aplicada: datos cambiados explicado sin códigos', () => {
    expect(ETIQUETA_MOTIVO_NO_APLICADA.DATOS_CAMBIARON).toContain('no son los vigentes');
  });
});
