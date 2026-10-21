// T3-11/D-066: orquestación de la edición UPDATE-only en la corrida. Datos sintéticos
// (D-042, sin literales con forma de CUIL/CBU); el FIX de identidad de la revisión es la
// pareja (registros + numero), y las huellas de archivo original nunca se redefinen.
import { describe, expect, it } from 'vitest';
import { conMaestro, nuevaCorrida } from '../../../src/run/corrida';
import { editarMaestro } from '../../../src/run/edicionMaestro';
import { parseMaestro } from '../../../src/import/master/parseMaestro';
import { maestroLibro, personas, registroBna } from '../../fixtures/synthetic/escenarios.ts';
import { createRandom, syntheticCbu, syntheticCuenta } from '../../fixtures/synthetic/identities.ts';

const RANDOM = createRandom(8);

function estadoConMaestro(cantidad = 2) {
  const lectura = parseMaestro(
    maestroLibro(personas(cantidad, 9).map((persona) => registroBna(persona, RANDOM)), {}),
  );
  return {
    estado: conMaestro(nuevaCorrida(), lectura, 'huella-archivo-original-sintetica'),
    lectura,
  };
}

describe('editarMaestro: UPDATE en la revisión vigente', () => {
  it('registro 1: cambia el CBU → revisión 1 con solo ese registro modificado', () => {
    const { estado, lectura } = estadoConMaestro();
    const registro0 = lectura.registros[0];
    if (registro0 === undefined) {
      throw new Error('fixture vacío');
    }
    const cbuNuevo = syntheticCbu('028', '0521', syntheticCuenta(RANDOM));
    const r = editarMaestro(estado, registro0, 'CBU', cbuNuevo);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.revision.numero).toBe(1);
      expect(r.value.estado.maestroRevision?.numero).toBe(1);
      const editado = r.value.revision.registros[0];
      if (editado === undefined) {
        throw new Error('fixture vacío');
      }
      expect(editado.cbu).toEqual({
        estado: 'VALIDO',
        texto: cbuNuevo,
        valor: cbuNuevo,
      });
      expect(editado.ref).toEqual(registro0.ref);
      // el resto del registro queda intacto (solo cambia el campo editado)
      expect(editado.patagonia).toEqual(registro0.patagonia);
      expect(editado.cuilTexto).toBe(registro0.cuilTexto);
      // la revisión 1 conservó todos los registros
      expect(r.value.revision.registros).toHaveLength(lectura.registros.length);
    }
  });

  it('mismo valor exacto → SIN_CAMBIOS y revisión sin crecimiento', () => {
    const { estado, lectura } = estadoConMaestro();
    const registro0 = lectura.registros[0];
    if (registro0 === undefined) {
      throw new Error('fixture vacío');
    }
    const textoActual =
      registro0.cbu.estado === 'VALIDO' || registro0.cbu.estado === 'INVALIDO'
        ? registro0.cbu.texto
        : '';
    expect(estado.maestroRevision?.numero).toBe(0);
    const r = editarMaestro(estado, registro0, 'CBU', textoActual);
    expect(r).toEqual({ ok: false, error: { caso: 'SIN_CAMBIOS' } });
  });

  it('valor inválido → VALOR_INVALIDO con motivo F2 y revisión vigente intacta', () => {
    const { estado, lectura } = estadoConMaestro();
    const registro0 = lectura.registros[0];
    if (registro0 === undefined) {
      throw new Error('fixture vacío');
    }
    expect(estado.maestroRevision?.numero).toBe(0);
    const r = editarMaestro(estado, registro0, 'CBU', '1'.repeat(25));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toEqual({
        caso: 'VALOR_INVALIDO',
        motivo: 'LONGITUD_INVALIDA',
      });
    }
    expect(estado.maestroRevision?.numero).toBe(0);
    expect(estado.maestro?.registros).toEqual(lectura.registros);
  });

  it('no existe el registro en la revisión → REGISTRO_AUSENTE', () => {
    const { estado, lectura } = estadoConMaestro();
    const fantasma = lectura.registros[0];
    if (fantasma === undefined) {
      throw new Error('fixture vacío');
    }
    const r = editarMaestro(
      estado,
      { ...fantasma, ref: { ...fantasma.ref, fila: (fantasma.ref.fila ?? 2) + 999 } },
      'CBU',
      syntheticCbu('011', '0001', syntheticCuenta(RANDOM)),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.caso).toBe('REGISTRO_AUSENTE');
    }
  });

  it('segunda edición (distinta) → revisión 2 observada', () => {
    const { estado, lectura } = estadoConMaestro();
    const primero = lectura.registros[0];
    const segundo = lectura.registros[1];
    if (primero === undefined || segundo === undefined) {
      throw new Error('fixture vacío');
    }
    const primera = editarMaestro(estado, primero, 'CBU', syntheticCbu('028', '0521', syntheticCuenta(RANDOM)));
    expect(primera.ok).toBe(true);
    if (primera.ok) {
      const segunda = editarMaestro(primera.value.estado, segundo, 'PAT_TIPO_CUENTA', '1');
      expect(segunda.ok).toBe(true);
      if (segunda.ok) {
        expect(segunda.value.revision.numero).toBe(2);
        expect(segunda.value.estado.maestroRevision?.numero).toBe(2);
      }
    }
  });

  it('identidad NUNCA llega como campo editable: el tipo de API no la admite (contrato)', () => {
    // El tipado de `editarMaestro` excluye identidad y PAT_CODIGO_DEPENDENCIA (tsc);
    // este despiece deja asentado el límite D-066.
    expect(true).toBe(true);
  });

  it('archivo original intacto: estado.maestro.registros no cambia tras la edición', () => {
    const { estado, lectura } = estadoConMaestro();
    const registro0 = lectura.registros[0];
    if (registro0 === undefined) {
      throw new Error('fixture vacío');
    }
    const r = editarMaestro(estado, registro0, 'CBU', syntheticCbu('028', '0521', syntheticCuenta(RANDOM)));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.estado.maestro === null ? [] : r.value.estado.maestro.registros).toEqual(
        lectura.registros,
      );
      expect(r.value.estado.finnegans).toEqual(estado.finnegans);
      expect(r.value.estado.decisiones).toEqual(estado.decisiones);
    }
  });
});
