// Comportamiento real del control de cobertura de pagos Patagonia (CP-F7-C2.4-A0).
// Los casos construyen la conciliación con los parsers reales y solo alteran el upstream
// cuando se quiere representar una inconsistencia que la conciliación no produce por sí sola.
import { describe, expect, it } from 'vitest';
import type { DatosPatagonia, TipoDocumentoPatagonia } from '../../../src/domain/maestro';
import type { PayrollLine } from '../../../src/domain/liquidacion';
import type { Centavos } from '../../../src/domain/money';
import type { ResultadoConciliacion } from '../../../src/reconciliation';
import { coberturaPagosPatagonia, generarPatagonia } from '../../../src/run/generacionPatagonia';
import { createRandom } from '../../fixtures/synthetic/identities';
import { filaFinnegans, registroPatagonia } from '../../fixtures/synthetic/escenarios';
import { BANCO_PATAGONIA } from '../../fixtures/synthetic/finnegansLike';
import {
  parametrosGoldenPatagoniaAlfanumerica,
  perfilV3Golden,
} from '../../fixtures/synthetic/goldenPatagonia';
import { escenario, gente } from '../reconciliation/helpers';

function base(): ResultadoConciliacion {
  const persona = gente(1, 2026)(0);
  return escenario(
    [filaFinnegans(persona, { Banco: BANCO_PATAGONIA })],
    [registroPatagonia(persona, createRandom(2026))],
  );
}

function conDatosPatagonia(
  resultado: ResultadoConciliacion,
  cambios: Partial<DatosPatagonia>,
  indice = 0,
): ResultadoConciliacion {
  const filas = resultado.filas.map((fila, posicion) => {
    if (posicion !== indice || fila.registro === null) {
      return fila;
    }
    return {
      ...fila,
      registro: {
        ...fila.registro,
        patagonia: { ...fila.registro.patagonia, ...cambios },
      },
    };
  });
  return { ...resultado, filas };
}

function conLinea(
  resultado: ResultadoConciliacion,
  cambios: Partial<PayrollLine>,
  indice = 0,
): ResultadoConciliacion {
  const filas = resultado.filas.map((fila, posicion) =>
    posicion === indice ? { ...fila, linea: { ...fila.linea, ...cambios } } : fila,
  );
  return { ...resultado, filas };
}

function entrada(resultado: ResultadoConciliacion) {
  return {
    perfil: perfilV3Golden(),
    conciliacion: resultado,
    parametros: parametrosGoldenPatagoniaAlfanumerica(),
  };
}

describe('control de cobertura Patagonia', () => {
  it('una fila convertible se convierte y la cobertura queda completa', () => {
    const conciliacion = base();
    const cobertura = coberturaPagosPatagonia(conciliacion);

    expect(cobertura.asignadas.cantidad).toBe(1);
    expect(cobertura.convertidas.cantidad).toBe(1);
    expect(cobertura.convertidas.importe).toBe(cobertura.asignadas.importe);
    expect(cobertura.noConvertibles).toEqual([]);
    expect(cobertura.excluidas).toEqual([]);
    expect(cobertura.refsUnicas).toBe(true);
    expect(cobertura.totalesCoinciden).toBe(true);
    expect(cobertura.globalCoincide).toBe(true);
    expect(cobertura.readinessCoincide).toBe(true);
    expect(cobertura.completa).toBe(true);

    const resultado = generarPatagonia(entrada(conciliacion));
    expect(resultado.estado).toBe('HOMOLOGACION_PATAGONIA_PENDIENTE');
    expect('bytes' in resultado).toBe(false);
  });

  it('cada campo Patagonia faltante conserva referencia, motivo y campo', () => {
    const campos = [
      ['numeroCuenta', 'PAT_NUMERO_CUENTA'],
      ['codigoBanco', 'PAT_CODIGO_BANCO'],
      ['codigoSucursal', 'PAT_CODIGO_SUCURSAL'],
      ['tipoDocumento', 'PAT_TIPO_DOCUMENTO'],
      ['numeroDocumento', 'PAT_NUMERO_DOCUMENTO'],
      ['codigoDependencia', 'PAT_CODIGO_DEPENDENCIA'],
    ] as const;

    for (const [campo, campoBancario] of campos) {
      const conciliacion = conDatosPatagonia(base(), { [campo]: { estado: 'VACIO' } });
      const cobertura = coberturaPagosPatagonia(conciliacion);

      expect(cobertura.convertidas.cantidad).toBe(0);
      expect(cobertura.noConvertibles).toHaveLength(1);
      const fila = cobertura.noConvertibles[0];
      expect(fila?.motivo).toBe('CAMPO_PATAGONIA_FALTANTE');
      expect(fila?.campo).toBe(campoBancario);
      expect(fila?.ref).toEqual(conciliacion.filas[0]?.linea.ref);
      expect(cobertura.completa).toBe(false);
    }
  });

  it('un tipo de documento 004 exige provincia válida y no la descarta', () => {
    const conciliacion = conDatosPatagonia(base(), {
      tipoDocumento: { estado: 'VALIDO', texto: '004', valor: '004' },
      provinciaDocumento: { estado: 'VACIO' },
    });
    const cobertura = coberturaPagosPatagonia(conciliacion);

    expect(cobertura.noConvertibles).toEqual([
      expect.objectContaining({
        motivo: 'CAMPO_PATAGONIA_FALTANTE',
        campo: 'PAT_PROVINCIA_DOCUMENTO',
      }),
    ]);
    expect(cobertura.completa).toBe(false);
  });

  it('un neto ausente no se convierte y los totales quedan sin importe', () => {
    const conciliacion = conLinea(base(), { neto: null });
    const cobertura = coberturaPagosPatagonia(conciliacion);

    expect(cobertura.asignadas).toEqual({ cantidad: 1, importe: null, filasSinImporte: 1 });
    expect(cobertura.convertidas).toEqual({ cantidad: 0, importe: 0n, filasSinImporte: 0 });
    expect(cobertura.noConvertibles).toEqual([expect.objectContaining({ motivo: 'NETO_AUSENTE' })]);
    expect(cobertura.noConvertibles[0]?.campo).toBeUndefined();
    expect(cobertura.totalesCoinciden).toBe(false);
    expect(cobertura.completa).toBe(false);
  });

  it('un neto cero dentro de una fila incluida se informa como no convertible', () => {
    const conciliacion = conLinea(base(), { neto: 0n as Centavos });
    const cobertura = coberturaPagosPatagonia(conciliacion);

    expect(cobertura.asignadas.importe).toBe(0n);
    expect(cobertura.noConvertibles).toEqual([expect.objectContaining({ motivo: 'NETO_CERO' })]);
    expect(cobertura.completa).toBe(false);
  });

  it('una fila sin maestro conserva la referencia y el motivo', () => {
    const conciliacion = base();
    const filas = conciliacion.filas.map((fila) => ({ ...fila, registro: null }));
    const cobertura = coberturaPagosPatagonia({ ...conciliacion, filas });

    expect(cobertura.noConvertibles).toEqual([
      expect.objectContaining({ motivo: 'SIN_MAESTRO', ref: conciliacion.filas[0]?.linea.ref }),
    ]);
    expect(cobertura.noConvertibles[0]?.campo).toBeUndefined();
    expect(cobertura.completa).toBe(false);
  });

  it('detecta que el total convertido difiere de global.patagonia', () => {
    const conciliacion = base();
    const global = conciliacion.global.patagonia;
    if (global.importe === null) {
      throw new Error('el escenario base debe tener importe calculable');
    }
    const alterada: ResultadoConciliacion = {
      ...conciliacion,
      global: {
        ...conciliacion.global,
        patagonia: { ...global, importe: (global.importe + 1n) as Centavos },
      },
    };

    const cobertura = coberturaPagosPatagonia(alterada);
    expect(cobertura.globalCoincide).toBe(false);
    expect(cobertura.totalesCoinciden).toBe(true);
    expect(cobertura.completa).toBe(false);
  });

  it('detecta que readiness.asignadas no coincide con las filas asignadas', () => {
    const conciliacion = base();
    const cobertura = coberturaPagosPatagonia(conciliacion, {
      cantidad: 2,
      importe: conciliacion.global.patagonia.importe,
      filasSinImporte: 0,
    });

    expect(cobertura.readinessCoincide).toBe(false);
    expect(cobertura.globalCoincide).toBe(true);
    expect(cobertura.completa).toBe(false);
  });

  it('una fila Patagonia con tipo de documento no confirmado no llega a cobertura', () => {
    const conciliacion = conDatosPatagonia(base(), {
      tipoDocumento: { estado: 'VALIDO', texto: '002', valor: '002' as TipoDocumentoPatagonia },
    });

    const resultado = generarPatagonia(entrada(conciliacion));
    expect(resultado.estado).toBe('TIPO_DOCUMENTO_NO_CONFIRMADO');
    expect('bytes' in resultado).toBe(false);
  });
});
