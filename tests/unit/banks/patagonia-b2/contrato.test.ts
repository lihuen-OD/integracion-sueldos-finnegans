import { describe, expect, it } from 'vitest';
import {
  IDS_ISSUE_PATAGONIA,
  ISSUES_PATAGONIA,
  PAT1_LONGITUD_DECLARADA_DOCUMENTAL,
  PAT1_LONGITUD_GEOMETRICA,
  PAT_TIPO_MOVIMIENTO_FUERA_DE_ALCANCE_F6,
  PAT_TIPO_MOVIMIENTO_PLAN_SUELDOS,
} from '../../../../src/banks/patagonia-b2';

describe('contrato Patagonia B.2', () => {
  it('inventaría PAT-1…PAT-17 en orden', () => {
    expect(IDS_ISSUE_PATAGONIA).toEqual([
      'PAT-1',
      'PAT-2',
      'PAT-3',
      'PAT-4',
      'PAT-5',
      'PAT-6',
      'PAT-7',
      'PAT-8',
      'PAT-9',
      'PAT-10',
      'PAT-11',
      'PAT-12',
      'PAT-13',
      'PAT-14',
      'PAT-15',
      'PAT-16',
      'PAT-17',
    ]);
  });

  it('conserva exactamente los estados documentados', () => {
    const estados = Object.fromEntries(
      IDS_ISSUE_PATAGONIA.map((id) => [id, ISSUES_PATAGONIA[id].estado]),
    );

    expect(estados).toEqual({
      'PAT-1': 'BLOQUEADA',
      'PAT-2': 'BLOQUEADA',
      'PAT-3': 'INTERPRETACION_PENDIENTE',
      'PAT-4': 'INTERPRETACION_PENDIENTE',
      'PAT-5': 'INTERPRETACION_PENDIENTE',
      'PAT-6': 'INTERPRETACION_PENDIENTE',
      'PAT-7': 'INTERPRETACION_PENDIENTE',
      'PAT-8': 'INTERPRETACION_PENDIENTE',
      'PAT-9': 'INTERPRETACION_PENDIENTE',
      'PAT-10': 'INTERPRETACION_PENDIENTE',
      'PAT-11': 'INTERPRETACION_PENDIENTE',
      'PAT-12': 'INTERPRETACION_PENDIENTE',
      'PAT-13': 'INTERPRETACION_PENDIENTE',
      'PAT-14': 'INTERPRETACION_PENDIENTE',
      'PAT-15': 'INTERPRETACION_PENDIENTE',
      'PAT-16': 'INTERPRETACION_PENDIENTE',
      'PAT-17': 'INTERPRETACION_PENDIENTE',
    });
  });

  it('solo PAT-1 y PAT-2 están BLOQUEADA; las I no se convierten en B', () => {
    expect(IDS_ISSUE_PATAGONIA.filter((id) => ISSUES_PATAGONIA[id].estado === 'BLOQUEADA')).toEqual(
      ['PAT-1', 'PAT-2'],
    );
    expect(
      IDS_ISSUE_PATAGONIA.filter(
        (id) => ISSUES_PATAGONIA[id].estado === 'INTERPRETACION_PENDIENTE',
      ),
    ).toEqual([
      'PAT-3',
      'PAT-4',
      'PAT-5',
      'PAT-6',
      'PAT-7',
      'PAT-8',
      'PAT-9',
      'PAT-10',
      'PAT-11',
      'PAT-12',
      'PAT-13',
      'PAT-14',
      'PAT-15',
      'PAT-16',
      'PAT-17',
    ]);
  });

  it('marca afectaBytes solo en PAT-3 y PAT-10 como falso', () => {
    expect(IDS_ISSUE_PATAGONIA.filter((id) => !ISSUES_PATAGONIA[id].afectaBytes)).toEqual([
      'PAT-3',
      'PAT-10',
    ]);
  });

  it('PAT-17 queda INTERPRETACION_PENDIENTE y afecta bytes', () => {
    expect(ISSUES_PATAGONIA['PAT-17']).toEqual({
      estado: 'INTERPRETACION_PENDIENTE',
      afectaBytes: true,
      tema: 'Código de banco del registro 2 frente a la restricción actual de entidad Patagonia 034',
    });
  });

  it('conserva la geometría 93 y la longitud documental 96 separadas', () => {
    expect(PAT1_LONGITUD_GEOMETRICA).toBe(93);
    expect(PAT1_LONGITUD_DECLARADA_DOCUMENTAL).toBe(96);
    expect(PAT1_LONGITUD_GEOMETRICA).not.toBe(PAT1_LONGITUD_DECLARADA_DOCUMENTAL);
  });

  it('documenta que el tipo 2 es Plan Sueldos y el tipo 4 queda fuera de alcance F6', () => {
    expect(PAT_TIPO_MOVIMIENTO_PLAN_SUELDOS).toBe('2');
    expect(PAT_TIPO_MOVIMIENTO_FUERA_DE_ALCANCE_F6).toBe('4');
    expect(PAT_TIPO_MOVIMIENTO_PLAN_SUELDOS).not.toBe(PAT_TIPO_MOVIMIENTO_FUERA_DE_ALCANCE_F6);
  });
});
