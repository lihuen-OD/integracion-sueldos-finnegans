// Diagnóstico de la política Patagonia (CP-F7-C2.4-A2.1/A2.2/A2.3/A2.4/A2.5/A2.6):
// catálogo de solo lectura, sin valores propuestos ni decisiones aprobadas embebidas. El
// catálogo conserva los seis requisitos conocidos (incluidos P-20, PAT-4, PAT-9/P-14,
// PAT-15 y PAT-16) y la lista productiva solo deja PAT-7/P-09/P-10.
import { describe, expect, it } from 'vitest';
import {
  REQUISITOS_PENDIENTES_PATAGONIA,
  REQUISITOS_POLITICA_PATAGONIA,
  diagnosticoPoliticaPatagonia,
  type OrigenRequisitoPatagonia,
  type PuntoPoliticaPatagonia,
  type ResponsableRequisitoPatagonia,
} from '../../../../src/banks/patagonia-b2';

const PUNTOS: readonly PuntoPoliticaPatagonia[] = [
  'P-20',
  'PAT-4',
  'PAT-7/P-09/P-10',
  'PAT-9/P-14',
  'PAT-15',
  'PAT-16',
];

const PENDIENTES: readonly PuntoPoliticaPatagonia[] = ['PAT-7/P-09/P-10'];

const RESPONSABLES: readonly ResponsableRequisitoPatagonia[] = [
  'BANCO',
  'EMPRESA',
  'RRHH',
  'USUARIO',
];

const ORIGENES: readonly OrigenRequisitoPatagonia[] = [
  'INFORMACION_BANCARIA',
  'DECISION_INTERNA',
  'DATO_DE_ENTRADA',
];

describe('diagnóstico de la política Patagonia', () => {
  it('el catálogo cubre los seis requisitos conocidos, sin duplicados', () => {
    expect(REQUISITOS_POLITICA_PATAGONIA.map((requisito) => requisito.punto)).toEqual(PUNTOS);
    expect(new Set(REQUISITOS_POLITICA_PATAGONIA.map((requisito) => requisito.punto)).size).toBe(
      PUNTOS.length,
    );
    expect(Object.isFrozen(REQUISITOS_POLITICA_PATAGONIA)).toBe(true);
  });

  it('la lista productiva contiene solo PAT-7/P-09/P-10', () => {
    expect(REQUISITOS_PENDIENTES_PATAGONIA.map((requisito) => requisito.punto)).toEqual(PENDIENTES);
    expect(REQUISITOS_PENDIENTES_PATAGONIA.map((requisito) => requisito.punto)).not.toContain(
      'P-20',
    );
    expect(REQUISITOS_PENDIENTES_PATAGONIA.map((requisito) => requisito.punto)).not.toContain(
      'PAT-4',
    );
    expect(REQUISITOS_PENDIENTES_PATAGONIA.map((requisito) => requisito.punto)).not.toContain(
      'PAT-9/P-14',
    );
    expect(REQUISITOS_PENDIENTES_PATAGONIA.map((requisito) => requisito.punto)).not.toContain(
      'PAT-15',
    );
    expect(REQUISITOS_PENDIENTES_PATAGONIA.map((requisito) => requisito.punto)).not.toContain(
      'PAT-16',
    );
    expect(Object.isFrozen(REQUISITOS_PENDIENTES_PATAGONIA)).toBe(true);
  });

  it('describe campo, requisito, responsables y origen sin valores de política', () => {
    for (const requisito of REQUISITOS_POLITICA_PATAGONIA) {
      expect(requisito.campo).not.toBe('');
      expect(requisito.requisito).not.toBe('');
      expect(requisito.responsables.length).toBeGreaterThan(0);
      expect(requisito.origenes.length).toBeGreaterThan(0);
      for (const responsable of requisito.responsables) {
        expect(RESPONSABLES).toContain(responsable);
      }
      for (const origen of requisito.origenes) {
        expect(ORIGENES).toContain(origen);
      }
      expect(requisito).not.toHaveProperty('valor');
      expect(requisito).not.toHaveProperty('default');
      expect(requisito).not.toHaveProperty('bytes');
    }
  });

  it('respeta todos los puntos recibidos, incluidos PAT-4, PAT-15 y PAT-16, en orden y sin duplicados', () => {
    expect(
      diagnosticoPoliticaPatagonia(['PAT-15', 'P-20']).map((requisito) => requisito.punto),
    ).toEqual(['PAT-15', 'P-20']);
    expect(
      diagnosticoPoliticaPatagonia(['PAT-4', 'PAT-16', 'PAT-15', 'P-20']).map(
        (requisito) => requisito.punto,
      ),
    ).toEqual(['PAT-4', 'PAT-16', 'PAT-15', 'P-20']);

    const puntos: readonly PuntoPoliticaPatagonia[] = ['PAT-16', 'P-20', 'PAT-16', 'PAT-4'];
    expect(diagnosticoPoliticaPatagonia(puntos).map((requisito) => requisito.punto)).toEqual([
      'PAT-16',
      'P-20',
      'PAT-4',
    ]);
  });

  it('el diagnóstico de la lista productiva solo informa PAT-7/P-09/P-10', () => {
    const diagnosticados = diagnosticoPoliticaPatagonia(PENDIENTES).map(
      (requisito) => requisito.punto,
    );
    expect(diagnosticados).toEqual(PENDIENTES);
    expect(diagnosticados).not.toContain('P-20');
    expect(diagnosticados).not.toContain('PAT-4');
    expect(diagnosticados).not.toContain('PAT-9/P-14');
    expect(diagnosticados).not.toContain('PAT-15');
    expect(diagnosticados).not.toContain('PAT-16');
  });

  it('no inventa requisitos para una lista vacía', () => {
    expect(diagnosticoPoliticaPatagonia([])).toEqual([]);
  });
});
