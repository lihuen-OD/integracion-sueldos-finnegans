// CP-F7-C2.4-A2.3: PAT-16 resuelto por decisión técnica interna. Solo el legajo `null`
// habilita `0000000`; un legajo presente se conserva si es numérico de 1–7 y bloquea si
// es inválido. Usa datos 100 % sintéticos y no abre la compuerta productiva.
import { describe, expect, it } from 'vitest';
import {
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

function politicaConComprobanteAprobado() {
  return politicaSintetica({
    comprobanteNoInformado: POLITICA_PATAGONIA_PRODUCTIVA.comprobanteNoInformado,
  });
}

function registrosSerializados(legajo: string | null): string[] {
  const resultado = serializarPatagonia(
    perfilPatagonia(),
    parametrosSinteticos(),
    [pagoSintetico(0, { legajo })],
    politicaConComprobanteAprobado(),
  );
  if (!resultado.ok) {
    throw new Error(`serialización inesperada: ${JSON.stringify(resultado.error)}`);
  }
  return Buffer.from(resultado.value.bytes).toString('latin1').split('\n');
}

function comprobanteEnBytes(legajo: string | null): string {
  const registros = registrosSerializados(legajo);
  expect(registros).toHaveLength(3);
  for (const registro of registros) {
    expect(registro).toHaveLength(200);
  }
  return registros[2]?.slice(27, 34) ?? '';
}

describe('PAT-16 · comprobante no informado', () => {
  it('la política productiva solo resuelve el comprobante cuando el legajo es null', () => {
    expect(
      POLITICA_PATAGONIA_PRODUCTIVA.comprobanteNoInformado(pagoSintetico(0, { legajo: null })),
    ).toEqual({ estado: 'RESUELTO', valor: '0000000' });
    expect(
      POLITICA_PATAGONIA_PRODUCTIVA.comprobanteNoInformado(pagoSintetico(0, { legajo: '0007' })),
    ).toEqual({ estado: 'SIN_RESOLUCION', punto: 'PAT-16' });
  });

  it('conserva el legajo numérico válido, incluidos los ceros iniciales', () => {
    for (const legajo of ['1', '0007', '050', '1234567', '0000000']) {
      const resultado = mapearPatagonia(
        perfilPatagonia(),
        parametrosSinteticos(),
        [pagoSintetico(0, { legajo })],
        politicaSintetica({
          comprobanteNoInformado: () => {
            throw new Error('no debe usarse la política con un legajo válido');
          },
        }),
      );
      expect(resultado.ok).toBe(true);
      if (resultado.ok) {
        const r2 = resultado.value.entradas.find((entrada) => entrada.recordId === 'PAT_R2');
        expect(r2?.valores['r2_numeroComprobante']).toBe(legajo);
      }
    }
  });

  it('usa 0000000 solo cuando el legajo está realmente ausente', () => {
    const resultado = mapearPatagonia(
      perfilPatagonia(),
      parametrosSinteticos(),
      [pagoSintetico(0, { legajo: null })],
      politicaConComprobanteAprobado(),
    );
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      const r2 = resultado.value.entradas.find((entrada) => entrada.recordId === 'PAT_R2');
      expect(r2?.valores['r2_numeroComprobante']).toBe('0000000');
    }
  });

  it('bloquea un legajo presente inválido sin reemplazarlo por ceros', () => {
    for (const legajo of ['', 'ABCD', '12A4', ' 12', '12345678', '123456789']) {
      const resultado = mapearPatagonia(
        perfilPatagonia(),
        parametrosSinteticos(),
        [pagoSintetico(0, { legajo })],
        politicaSintetica({
          comprobanteNoInformado: () => {
            throw new Error('no debe usarse la política con un legajo inválido');
          },
        }),
      );
      expect(resultado.ok).toBe(false);
      if (!resultado.ok) {
        expect(resultado.error).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              codigo: 'COMPROBANTE_INVALIDO',
              campoId: 'r2_numeroComprobante',
              indicePago: 0,
            }),
          ]),
        );
      }
    }
  });

  it('rellena el comprobante a siete posiciones sin alterar importes ni empleados', () => {
    const conLegajo = registrosSerializados('0007');
    const sinLegajo = registrosSerializados(null);

    expect(comprobanteEnBytes('0007')).toBe('0000007');
    expect(comprobanteEnBytes('50')).toBe('0000050');
    expect(comprobanteEnBytes(null)).toBe('0000000');

    // El importe neto (17–27), el apellido/nombre (35–54) y el resto del registro no
    // dependen del comprobante: solo cambian las posiciones 28–34.
    expect(conLegajo[2]?.slice(16, 27)).toBe(sinLegajo[2]?.slice(16, 27));
    expect(conLegajo[2]?.slice(34, 54)).toBe(sinLegajo[2]?.slice(34, 54));
    expect(conLegajo[2]?.slice(0, 27)).toBe(sinLegajo[2]?.slice(0, 27));
    expect(conLegajo[2]?.slice(34)).toBe(sinLegajo[2]?.slice(34));
  });

  it('la compuerta productiva sigue cerrada', () => {
    expect(produccionPatagoniaHabilitada()).toBe(false);
  });
});
