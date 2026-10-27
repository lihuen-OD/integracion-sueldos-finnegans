// Nombre Patagonia: se implementan solo las transformaciones aprobadas. Orden, separador,
// recorte, colapso y truncamiento son decisiones explícitas de PAT-9/P-14; no hay defaults.
import { describe, expect, it } from 'vitest';
import {
  construirNombrePatagonia,
  normalizarComponenteNombre,
  type DecisionNombrePatagonia,
} from '../../../../src/banks/patagonia-b2';

function decision(cambios: Partial<DecisionNombrePatagonia> = {}): DecisionNombrePatagonia {
  return {
    orden: 'APELLIDO_NOMBRE',
    separador: ' ',
    recortarExtremos: true,
    colapsarEspaciosInternos: true,
    truncamiento: 'RECHAZAR',
    ...cambios,
  };
}

describe('nombre Patagonia · transformaciones aprobadas', () => {
  it('aplica mayúsculas, quita acentos/diéresis y convierte Ñ en N', () => {
    expect(normalizarComponenteNombre('Pérez')).toEqual({
      valor: 'PEREZ',
      transformado: true,
    });
    expect(normalizarComponenteNombre('Muñoz')).toEqual({
      valor: 'MUNOZ',
      transformado: true,
    });
    expect(normalizarComponenteNombre('Güemes')).toEqual({
      valor: 'GUEMES',
      transformado: true,
    });
    expect(normalizarComponenteNombre('PEREZ')).toEqual({
      valor: 'PEREZ',
      transformado: false,
    });
  });

  it('no elimina ni reemplaza caracteres no respaldados', () => {
    expect(normalizarComponenteNombre('Pérez@')).toEqual({
      valor: 'PEREZ@',
      transformado: true,
    });
  });
});

describe('nombre Patagonia · composición y truncamiento explícitos', () => {
  it('compone en el orden y separador elegidos, con auditoría', () => {
    const resultado = construirNombrePatagonia('Pérez', 'Ana', decision());
    expect(resultado).toEqual({
      ok: true,
      value: {
        original: 'Pérez Ana',
        generado: 'PEREZ ANA',
        transformado: true,
        truncado: false,
      },
    });
  });

  it('no asume orden Apellido/Nombre: el orden inverso es explícito', () => {
    const resultado = construirNombrePatagonia(
      'Pérez',
      'Ana',
      decision({ orden: 'NOMBRE_APELLIDO' }),
    );
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.value.generado).toBe('ANA PEREZ');
    }
  });

  it('no recorta ni colapsa espacios si la decisión no lo pide', () => {
    const resultado = construirNombrePatagonia(
      '  Pérez  ',
      ' Ana ',
      decision({ recortarExtremos: false, colapsarEspaciosInternos: false }),
    );
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.value.generado).toBe('  PEREZ    ANA ');
    }
  });

  it('rechaza más de 20 sin truncamiento autorizado', () => {
    const resultado = construirNombrePatagonia(
      'APELLIDO MUY LARGO',
      'NOMBRE MUY LARGO',
      decision(),
    );
    expect(resultado).toEqual({ ok: false, error: 'NOMBRE_LONGITUD_EXCEDIDA' });
  });

  it('trunca a 20 solo cuando la decisión lo autoriza y lo informa', () => {
    const resultado = construirNombrePatagonia(
      'APELLIDO MUY LARGO',
      'NOMBRE MUY LARGO',
      decision({ truncamiento: 'TRUNCAR_A_20' }),
    );
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.value.generado).toHaveLength(20);
      expect(resultado.value.truncado).toBe(true);
      expect(resultado.value.transformado).toBe(true);
    }
  });

  it('acepta exactamente 20 caracteres sin marcar truncamiento', () => {
    const resultado = construirNombrePatagonia('A', 'B'.repeat(18), decision());
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.value.generado).toHaveLength(20);
      expect(resultado.value.truncado).toBe(false);
    }
  });

  it('rechaza caracteres no respaldados incluso si quedarían fuera del corte', () => {
    const resultado = construirNombrePatagonia(
      'A@B',
      'C',
      decision({ truncamiento: 'TRUNCAR_A_20' }),
    );
    expect(resultado).toEqual({
      ok: false,
      error: 'NOMBRE_CARACTER_NO_RESPALDADO',
    });
  });

  it('exige una decisión válida y no usa defaults', () => {
    const sinDecision = construirNombrePatagonia(
      'PEREZ',
      'ANA',
      undefined as unknown as DecisionNombrePatagonia,
    );
    expect(sinDecision).toEqual({ ok: false, error: 'DECISION_REQUERIDA' });

    const invalida = construirNombrePatagonia('PEREZ', 'ANA', {
      ...decision(),
      orden: 'OTRO',
    } as unknown as DecisionNombrePatagonia);
    expect(invalida).toEqual({ ok: false, error: 'DECISION_INVALIDA' });
  });

  it('rechaza un nombre compuesto vacío', () => {
    const resultado = construirNombrePatagonia('   ', '   ', decision());
    expect(resultado).toEqual({ ok: false, error: 'NOMBRE_VACIO' });
  });
});
