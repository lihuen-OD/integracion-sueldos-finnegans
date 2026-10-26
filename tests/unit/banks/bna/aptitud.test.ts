// Aptitud BNA (CP-F5-A): D-075/D-078. B bloquea; I no se convierte en B; la
// homologación sigue pendiente. P-09/P-10 no se representan como ContractStatus.
import { describe, expect, it } from 'vitest';
import type { FileSpec } from '../../../../src/banks/fixed-width';
import {
  ID_CAMPO_BNA_TIPO_DOCUMENTO,
  ISSUES_BNA,
  REGISTROS_BNA,
  crearSpecBna,
  aptitudBna,
} from '../../../../src/banks/bna';

function spec(): FileSpec {
  return crearSpecBna({ lineSeparator: '\n', trailingSeparator: false });
}

const CAMPOS = REGISTROS_BNA.flatMap((registro) => registro.fields);

function campoPorId(id: string) {
  return CAMPOS.find((campo) => campo.id === id);
}

function sinBloqueoB(original: FileSpec): FileSpec {
  return {
    ...original,
    records: original.records.map((registro) => ({
      ...registro,
      fields: registro.fields.map((campo) =>
        campo.id === ID_CAMPO_BNA_TIPO_DOCUMENTO
          ? { ...campo, status: 'CONFIRMADA' as const }
          : campo,
      ),
    })),
  };
}

describe('estados contractuales BNA', () => {
  it('BNA-1 es el único bloqueo B', () => {
    expect(ISSUES_BNA['BNA-1'].estado).toBe('BLOQUEADA');
    expect(ISSUES_BNA['BNA-1'].afectaBytes).toBe(true);
    const b = Object.entries(ISSUES_BNA)
      .filter(([, issue]) => issue.estado === 'BLOQUEADA')
      .map(([id]) => id);
    expect(b).toEqual(['BNA-1']);
  });

  it.each(['BNA-2', 'BNA-5', 'BNA-6', 'BNA-7', 'BNA-8', 'BNA-9', 'BNA-11'] as const)(
    '%s sigue INTERPRETACION_PENDIENTE y afecta bytes',
    (id) => {
      expect(ISSUES_BNA[id].estado).toBe('INTERPRETACION_PENDIENTE');
      expect(ISSUES_BNA[id].afectaBytes).toBe(true);
    },
  );

  it('BNA-10 está documentada como I sin impacto en bytes', () => {
    expect(ISSUES_BNA['BNA-10'].estado).toBe('INTERPRETACION_PENDIENTE');
    expect(ISSUES_BNA['BNA-10'].afectaBytes).toBe(false);
  });

  it('BNA-3 documentada y BNA-4 confirmada no son pendientes', () => {
    expect(ISSUES_BNA['BNA-3'].estado).toBe('DOCUMENTADA');
    expect(ISSUES_BNA['BNA-4'].estado).toBe('CONFIRMADA');
  });
});

describe('consistencia entre ISSUES_BNA y la spec canónica', () => {
  it('todo campo BLOQUEADA tiene al menos un issue contractual BLOQUEADA', () => {
    const bloqueados = CAMPOS.filter((campo) => campo.status === 'BLOQUEADA');
    expect(bloqueados.length).toBeGreaterThan(0);
    for (const campo of bloqueados) {
      const issues = campo.issues ?? [];
      expect(issues.some((id) => ISSUES_BNA[id].estado === 'BLOQUEADA')).toBe(true);
    }
  });

  it('BNA-1 se aplica al tipo de documento y ese campo sigue BLOQUEADA', () => {
    const tipoDocumento = campoPorId(ID_CAMPO_BNA_TIPO_DOCUMENTO);
    expect(tipoDocumento?.issues).toContain('BNA-1');
    expect(tipoDocumento?.status).toBe('BLOQUEADA');
  });

  it('BNA-1 sigue siendo el único issue contractual BLOQUEADA', () => {
    const bloqueados = Object.entries(ISSUES_BNA)
      .filter(([, issue]) => issue.estado === 'BLOQUEADA')
      .map(([id]) => id);
    expect(bloqueados).toEqual(['BNA-1']);
  });

  it('la copia sintética de D-075 no modifica la spec canónica', () => {
    expect(aptitudBna(sinBloqueoB(spec())).bloqueos).toEqual([]);
    const tipoDocumento = campoPorId(ID_CAMPO_BNA_TIPO_DOCUMENTO);
    expect(tipoDocumento?.status).toBe('BLOQUEADA');
    expect(tipoDocumento?.issues).toContain('BNA-1');
    expect(aptitudBna(spec()).generadorHabilitado).toBe(false);
  });
});

describe('aptitudBna', () => {
  it('informa el bloqueo B de BNA-1 y no habilita el generador', () => {
    const aptitud = aptitudBna(spec());
    expect(aptitud.bloqueos).toEqual([
      {
        tipo: 'campo',
        registroId: 'BNA_R2',
        campoId: ID_CAMPO_BNA_TIPO_DOCUMENTO,
      },
    ]);
    expect(aptitud.generadorHabilitado).toBe(false);
    expect(aptitud.homologacion).toBe('PENDIENTE_DE_HOMOLOGACION');
  });

  it('separa las I que afectan bytes de las que no, sin convertirlas en B', () => {
    const aptitud = aptitudBna(spec());
    expect(aptitud.interpretacionesByte).toEqual([
      'BNA-2',
      'BNA-5',
      'BNA-6',
      'BNA-7',
      'BNA-8',
      'BNA-9',
      'BNA-11',
    ]);
    expect(aptitud.interpretacionesSinBytes).toEqual(['BNA-10']);
    expect(aptitud.bloqueos).toHaveLength(1);
  });

  it('D-075: sin B, una I no bloquea ni convierte el resultado en confirmado (spec sintética, no resuelve BNA-1)', () => {
    const sinBloqueo = sinBloqueoB(spec());
    const aptitud = aptitudBna(sinBloqueo);
    expect(aptitud.bloqueos).toEqual([]);
    expect(aptitud.generadorHabilitado).toBe(true);
    expect(aptitud.interpretacionesByte).toContain('BNA-2');
    expect(aptitud.homologacion).toBe('PENDIENTE_DE_HOMOLOGACION');
  });
});
