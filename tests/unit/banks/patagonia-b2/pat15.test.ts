// CP-F7-C2.4-A2.2: PAT-15 resuelto por decisión técnica interna (8 espacios ASCII en
// 189–196 de R0 y R1). Usa datos 100 % sintéticos y no abre la compuerta productiva.
import { describe, expect, it } from 'vitest';
import {
  ID_REGISTRO_PAT_1,
  POLITICA_PATAGONIA_PRODUCTIVA,
  mapearPatagonia,
  produccionPatagoniaHabilitada,
  serializarPatagonia,
} from '../../../../src/banks/patagonia-b2';
import {
  pagoSintetico,
  parametrosSinteticos,
  perfilPatagonia,
  politicaSintetica,
} from './auxiliares';

function politicaConVersionAprobada() {
  return politicaSintetica({
    versionLote: POLITICA_PATAGONIA_PRODUCTIVA.versionLote,
  });
}

function serializarConVersionAprobada() {
  return serializarPatagonia(
    perfilPatagonia(),
    parametrosSinteticos(),
    [pagoSintetico(0)],
    politicaConVersionAprobada(),
  );
}

describe('PAT-15 · versión de R0 y R1', () => {
  it('la política productiva resuelve la versión con una cadena vacía explícita', () => {
    expect(
      POLITICA_PATAGONIA_PRODUCTIVA.versionLote(perfilPatagonia(), parametrosSinteticos()),
    ).toEqual({ estado: 'RESUELTO', valor: '' });
  });

  it('R0 y R1 llevan exactamente ocho espacios ASCII en 189–196 y conservan 200 caracteres', () => {
    const resultado = serializarConVersionAprobada();
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) {
      return;
    }

    const registros = Buffer.from(resultado.value.bytes).toString('latin1').split('\n');
    expect(registros).toHaveLength(3);
    for (const registro of registros) {
      expect(registro).toHaveLength(200);
    }

    const bytesDeVersion = (registro: string): string[] =>
      Array.from(registro.slice(188, 196)).map((caracter) =>
        caracter.charCodeAt(0).toString(16).padStart(2, '0'),
      );
    const ochoEspacios = Array.from({ length: 8 }, () => '20');

    expect(registros[0]?.slice(188, 196)).toBe('        ');
    expect(registros[1]?.slice(188, 196)).toBe('        ');
    expect(bytesDeVersion(registros[0] ?? '')).toEqual(ochoEspacios);
    expect(bytesDeVersion(registros[1] ?? '')).toEqual(ochoEspacios);
  });

  it('el mapper entrega la versión sin contenido para que el motor la complete', () => {
    const resultado = mapearPatagonia(
      perfilPatagonia(),
      parametrosSinteticos(),
      [pagoSintetico(0)],
      politicaConVersionAprobada(),
    );
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) {
      return;
    }

    const registro1 = resultado.value.entradas.find(
      (entrada) => entrada.recordId === ID_REGISTRO_PAT_1,
    );
    expect(registro1?.valores['r1_version']).toBe('');
    expect(registro1?.valores['r1_version']).not.toBeUndefined();
  });

  it('la compuerta productiva sigue cerrada', () => {
    expect(produccionPatagoniaHabilitada()).toBe(false);
  });
});
