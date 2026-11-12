// Aptitud BNA (CP-F5-A): D-075/D-078. B bloquea; I no se convierte en B; la
// homologación sigue pendiente. C-4 confirma BNA-1 por el camino CUIL según el diseño
// documental (no por homologación bancaria) y deja la spec sin campos BLOQUEADA, pero la
// compuerta productiva no depende de eso.
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

/** Copia sintética con el tipo documental BLOQUEADA: prueba que el motor B sigue vivo. */
function conBloqueoB(original: FileSpec): FileSpec {
  return {
    ...original,
    records: original.records.map((registro) => ({
      ...registro,
      fields: registro.fields.map((campo) =>
        campo.id === ID_CAMPO_BNA_TIPO_DOCUMENTO
          ? { ...campo, status: 'BLOQUEADA' as const }
          : campo,
      ),
    })),
  };
}

describe('estados contractuales BNA', () => {
  it('BNA-1 queda CONFIRMADA por el camino CUIL y no hay issues BLOQUEADA', () => {
    expect(ISSUES_BNA['BNA-1'].estado).toBe('CONFIRMADA');
    expect(ISSUES_BNA['BNA-1'].afectaBytes).toBe(true);
    const estados: readonly string[] = Object.values(ISSUES_BNA).map((issue) => issue.estado);
    expect(estados.filter((estado) => estado === 'BLOQUEADA')).toEqual([]);
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
  it('la spec canónica no tiene campos BLOQUEADA', () => {
    expect(CAMPOS.filter((campo) => campo.status === 'BLOQUEADA')).toEqual([]);
  });

  it('BNA-1 se aplica al tipo de documento, que queda CONFIRMADA', () => {
    const tipoDocumento = campoPorId(ID_CAMPO_BNA_TIPO_DOCUMENTO);
    expect(tipoDocumento?.issues).toContain('BNA-1');
    expect(tipoDocumento?.status).toBe('CONFIRMADA');
  });

  it('una copia sintética BLOQUEADA sigue generando un bloqueo B y no altera la spec', () => {
    expect(aptitudBna(conBloqueoB(spec())).bloqueos).toEqual([
      { tipo: 'campo', registroId: 'BNA_R2', campoId: ID_CAMPO_BNA_TIPO_DOCUMENTO },
    ]);
    expect(aptitudBna(conBloqueoB(spec())).generadorHabilitado).toBe(false);
    expect(campoPorId(ID_CAMPO_BNA_TIPO_DOCUMENTO)?.status).toBe('CONFIRMADA');
  });
});

describe('aptitudBna', () => {
  it('sin B en la spec habilita técnicamente pero no homologa', () => {
    const aptitud = aptitudBna(spec());
    expect(aptitud.bloqueos).toEqual([]);
    expect(aptitud.generadorHabilitado).toBe(true);
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
    expect(aptitud.bloqueos).toHaveLength(0);
  });

  it('D-075: una I no bloquea ni convierte el resultado en confirmado', () => {
    const aptitud = aptitudBna(spec());
    expect(aptitud.interpretacionesByte).toContain('BNA-2');
    expect(aptitud.bloqueos).toEqual([]);
    expect(aptitud.homologacion).toBe('PENDIENTE_DE_HOMOLOGACION');
  });
});
