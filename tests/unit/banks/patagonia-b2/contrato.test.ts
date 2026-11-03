import { describe, expect, it } from 'vitest';
import {
  IDS_ISSUE_PATAGONIA,
  ISSUES_PATAGONIA,
  PAT1_LONGITUD_DECLARADA_DOCUMENTAL,
  PAT1_LONGITUD_GEOMETRICA,
  PAT2_LONGITUD,
  PAT2_POSICION_FIN,
  PAT2_POSICION_INICIO,
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
      'PAT-1': 'CONFIRMADA',
      'PAT-2': 'CONFIRMADA',
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

  it('no quedan issues BLOQUEADA; las I no se convierten en B', () => {
    expect(Object.values(ISSUES_PATAGONIA).map((issue) => issue.estado)).not.toContain('BLOQUEADA');
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

  it('PC-01: PAT-1 queda CONFIRMADA con la geometría de 93 posiciones', () => {
    expect(ISSUES_PATAGONIA['PAT-1']).toEqual({
      estado: 'CONFIRMADA',
      afectaBytes: true,
      tema: 'Registro 2 campo 16: 93 posiciones reales (104–196) completadas con 93 espacios; PAT-DR declara 96 y tipo N',
    });
    expect(ISSUES_PATAGONIA['PAT-1'].tema).toContain('104–196');
    expect(ISSUES_PATAGONIA['PAT-1'].tema).toContain('93 espacios');
  });

  it('PC-02: PAT-2 queda CONFIRMADA con 15 posiciones alfanuméricas', () => {
    expect(ISSUES_PATAGONIA['PAT-2']).toEqual({
      estado: 'CONFIRMADA',
      afectaBytes: true,
      tema: 'Código de dependencia: alfanumérico de 15 posiciones (85–99), alineado a la izquierda y completado con espacios a la derecha; debe coincidir con el alta',
    });
    expect(ISSUES_PATAGONIA['PAT-2'].tema).toContain('85–99');
    expect(ISSUES_PATAGONIA['PAT-2'].tema).toContain('15 posiciones');
  });

  it('PC-02: la geometría de PAT-2 es 85–99 y 15 posiciones', () => {
    expect(PAT2_POSICION_INICIO).toBe(85);
    expect(PAT2_POSICION_FIN).toBe(99);
    expect(PAT2_LONGITUD).toBe(15);
    expect(PAT2_POSICION_FIN - PAT2_POSICION_INICIO + 1).toBe(PAT2_LONGITUD);
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
