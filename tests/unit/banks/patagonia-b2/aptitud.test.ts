import { describe, expect, it } from 'vitest';
import type { FileSpec } from '../../../../src/banks/fixed-width';
import {
  ID_CAMPO_PAT_DEPENDENCIA,
  ID_CAMPO_PAT_RELLENO_PAT1,
  ID_REGISTRO_PAT_2,
  ISSUES_PATAGONIA,
  aptitudPatagonia,
  crearSpecPatagoniaB2,
  type ConfiguracionTecnicaPatagonia,
} from '../../../../src/banks/patagonia-b2';

const BASE = {
  hipotesisRellenoPat1: 'ESPACIOS',
  hipotesisDependenciaPat2: 'NUMERICA',
  lineSeparator: '\n',
  trailingSeparator: false,
} as const satisfies ConfiguracionTecnicaPatagonia;

function spec(overrides: Partial<ConfiguracionTecnicaPatagonia> = {}): FileSpec {
  return crearSpecPatagoniaB2({ ...BASE, ...overrides });
}

function sinBloqueosB(archivo: FileSpec): FileSpec {
  return {
    ...archivo,
    records: archivo.records.map((registro) => ({
      ...registro,
      fields: registro.fields.map((campo) =>
        campo.status === 'BLOQUEADA' ? { ...campo, status: 'CONFIRMADA' as const } : campo,
      ),
    })),
  };
}

describe('aptitud contractual Patagonia B.2', () => {
  it('NUMERICA mantiene PAT-2 BLOQUEADA e impide habilitar el generador', () => {
    const aptitud = aptitudPatagonia(spec({ hipotesisDependenciaPat2: 'NUMERICA' }));
    expect(aptitud.bloqueos).toEqual([
      { tipo: 'campo', registroId: ID_REGISTRO_PAT_2, campoId: ID_CAMPO_PAT_DEPENDENCIA },
    ]);
    expect(aptitud.generadorHabilitado).toBe(false);
    expect(aptitud.homologacion).toBe('PENDIENTE_DE_HOMOLOGACION');
  });

  it('ALFANUMERICA es la hipótesis confirmada y no deja bloqueos contractuales', () => {
    const aptitud = aptitudPatagonia(spec({ hipotesisDependenciaPat2: 'ALFANUMERICA' }));
    expect(aptitud.bloqueos).toEqual([]);
    expect(aptitud.generadorHabilitado).toBe(true);
    expect(aptitud.homologacion).toBe('PENDIENTE_DE_HOMOLOGACION');
    expect(aptitud.interpretacionesByte).not.toContain('PAT-2');
  });

  it.each([
    ['ESPACIOS', 'NUMERICA', 1],
    ['ESPACIOS', 'ALFANUMERICA', 0],
    ['CEROS', 'NUMERICA', 2],
    ['CEROS', 'ALFANUMERICA', 1],
  ] as const)(
    'la hipótesis %s/%s deja %i bloqueo(s): las hipótesis históricas siguen BLOQUEADAS',
    (hipotesisRellenoPat1, hipotesisDependenciaPat2, cantidad) => {
      const aptitud = aptitudPatagonia(spec({ hipotesisRellenoPat1, hipotesisDependenciaPat2 }));
      expect(aptitud.generadorHabilitado).toBe(cantidad === 0);
      expect(aptitud.bloqueos).toHaveLength(cantidad);
      if (hipotesisDependenciaPat2 === 'NUMERICA') {
        expect(aptitud.bloqueos).toContainEqual({
          tipo: 'campo',
          registroId: ID_REGISTRO_PAT_2,
          campoId: ID_CAMPO_PAT_DEPENDENCIA,
        });
      }
      if (hipotesisRellenoPat1 === 'CEROS') {
        expect(aptitud.bloqueos).toContainEqual({
          tipo: 'campo',
          registroId: ID_REGISTRO_PAT_2,
          campoId: ID_CAMPO_PAT_RELLENO_PAT1,
        });
      }
    },
  );

  it('no convierte interpretaciones pendientes en bloqueos', () => {
    const aptitud = aptitudPatagonia(spec());
    expect(aptitud.interpretacionesByte).toEqual([
      'PAT-4',
      'PAT-5',
      'PAT-6',
      'PAT-7',
      'PAT-8',
      'PAT-9',
      'PAT-11',
      'PAT-12',
      'PAT-13',
      'PAT-14',
      'PAT-15',
      'PAT-16',
      'PAT-17',
    ]);
    expect(aptitud.interpretacionesSinBytes).toEqual(['PAT-3', 'PAT-10']);
    expect(aptitud.interpretacionesByte).not.toContain('PAT-1');
    expect(aptitud.interpretacionesByte).not.toContain('PAT-2');
  });

  it('PAT-17 sigue INTERPRETACION_PENDIENTE y nunca se lista como bloqueo', () => {
    expect(ISSUES_PATAGONIA['PAT-17'].estado).toBe('INTERPRETACION_PENDIENTE');
    const aptitud = aptitudPatagonia(spec());
    expect(aptitud.interpretacionesByte).toContain('PAT-17');
    expect(aptitud.bloqueos).not.toContainEqual({
      tipo: 'campo',
      registroId: ID_REGISTRO_PAT_2,
      campoId: 'r2_codigoBanco',
    });
  });

  it('si se liberan los bloqueos el generador queda habilitado sin borrar las I', () => {
    const liberado = sinBloqueosB(spec());
    const aptitud = aptitudPatagonia(liberado);
    expect(aptitud.bloqueos).toEqual([]);
    expect(aptitud.generadorHabilitado).toBe(true);
    expect(aptitud.interpretacionesByte).toContain('PAT-17');
    expect(aptitudPatagonia(spec()).generadorHabilitado).toBe(false);
  });

  it('no evalúa conciliación, P-09/P-10, empleados, readiness ni perfil', () => {
    const aptitud = aptitudPatagonia(spec());
    expect(Object.keys(aptitud).sort()).toEqual([
      'bloqueos',
      'generadorHabilitado',
      'homologacion',
      'interpretacionesByte',
      'interpretacionesSinBytes',
    ]);
  });
});
