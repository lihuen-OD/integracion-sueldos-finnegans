// CP-F7-C2.4-A2.6: PAT-9/P-14 resuelto por decisión técnica interna. Compone
// `APELLIDO NOMBRE`, normaliza mayúsculas/acentos/diéresis/Ñ, colapsa espacios y rechaza
// vacíos, caracteres no admitidos y más de 20 caracteres, sin truncar. Usa datos 100 %
// sintéticos y no abre la compuerta productiva.
import { describe, expect, it } from 'vitest';
import {
  DECISION_NOMBRE_PATAGONIA_PRODUCTIVA,
  POLITICA_PATAGONIA_PRODUCTIVA,
  construirNombrePatagonia,
  mapearPatagonia,
  produccionPatagoniaHabilitada,
  serializarPatagonia,
} from '../../../../src/banks/patagonia-b2';
import type { PagoPatagonia } from '../../../../src/banks/patagonia-b2';
import {
  pagoSintetico,
  parametrosSinteticos,
  perfilPatagonia,
  politicaSintetica,
} from './auxiliares';

function politicaConNombreAprobado() {
  return politicaSintetica({ nombre: POLITICA_PATAGONIA_PRODUCTIVA.nombre });
}

function nombreProductivo(pago: PagoPatagonia) {
  return POLITICA_PATAGONIA_PRODUCTIVA.nombre(pago);
}

function serializarConNombreAprobado(pago: PagoPatagonia) {
  return serializarPatagonia(
    perfilPatagonia(),
    parametrosSinteticos(),
    [pago],
    politicaConNombreAprobado(),
  );
}

describe('PAT-9/P-14 · composición del apellido y nombre', () => {
  it('compone APELLIDO NOMBRE con un espacio, auditoría y sin truncamiento', () => {
    const pago = pagoSintetico(0, { apellido: 'Pérez', nombre: 'Ana' });
    expect(nombreProductivo(pago)).toEqual({
      estado: 'RESUELTO',
      valor: {
        original: 'Pérez Ana',
        generado: 'PEREZ ANA',
        transformado: true,
        truncado: false,
      },
    });
  });

  it('recorta extremos y colapsa espacios internos antes de validar', () => {
    const pago = pagoSintetico(0, { apellido: '  Pérez   Gómez  ', nombre: '  Ana  ' });
    const resultado = nombreProductivo(pago);
    expect(resultado).toEqual({
      estado: 'RESUELTO',
      valor: {
        original: '  Pérez   Gómez     Ana  ',
        generado: 'PEREZ GOMEZ ANA',
        transformado: true,
        truncado: false,
      },
    });
  });

  it('normaliza tildes, diéresis y Ñ sin reemplazar otros caracteres', () => {
    for (const [apellido, nombre, generado] of [
      ['Muñoz', 'Güemes', 'MUNOZ GUEMES'],
      ['Ñandú', 'Íñigo', 'NANDU INIGO'],
      ['Cigüeña', 'Sofía', 'CIGUENA SOFIA'],
    ] as const) {
      const resultado = nombreProductivo(pagoSintetico(0, { apellido, nombre }));
      expect(resultado).toEqual({
        estado: 'RESUELTO',
        valor: {
          original: `${apellido} ${nombre}`,
          generado,
          transformado: true,
          truncado: false,
        },
      });
    }
  });

  it('rechaza vacío, caracteres no admitidos y más de 20 caracteres', () => {
    expect(construirNombrePatagonia('   ', '   ', DECISION_NOMBRE_PATAGONIA_PRODUCTIVA)).toEqual({
      ok: false,
      error: 'NOMBRE_VACIO',
    });
    expect(construirNombrePatagonia('Pérez@', 'Ana', DECISION_NOMBRE_PATAGONIA_PRODUCTIVA)).toEqual(
      { ok: false, error: 'NOMBRE_CARACTER_NO_RESPALDADO' },
    );
    expect(
      construirNombrePatagonia(
        'A'.repeat(10),
        'B'.repeat(10),
        DECISION_NOMBRE_PATAGONIA_PRODUCTIVA,
      ),
    ).toEqual({ ok: false, error: 'NOMBRE_LONGITUD_EXCEDIDA' });
  });

  it('la política productiva no devuelve un nombre inválido ni trunca silenciosamente', () => {
    expect(nombreProductivo(pagoSintetico(0, { apellido: '   ', nombre: '   ' }))).toEqual({
      estado: 'SIN_RESOLUCION',
      punto: 'PAT-9/P-14',
    });
    expect(nombreProductivo(pagoSintetico(0, { apellido: 'Pérez@', nombre: 'Ana' }))).toEqual({
      estado: 'SIN_RESOLUCION',
      punto: 'PAT-9/P-14',
    });
    expect(
      nombreProductivo(pagoSintetico(0, { apellido: 'A'.repeat(10), nombre: 'B'.repeat(10) })),
    ).toEqual({ estado: 'SIN_RESOLUCION', punto: 'PAT-9/P-14' });
  });

  it('acepta exactamente 20 caracteres y no marca truncamiento', () => {
    const resultado = construirNombrePatagonia(
      'A'.repeat(10),
      'B'.repeat(9),
      DECISION_NOMBRE_PATAGONIA_PRODUCTIVA,
    );
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.value.generado).toHaveLength(20);
      expect(resultado.value.truncado).toBe(false);
    }
  });

  it('serializa el nombre normalizado en 35–54 sin alterar importes, cuentas ni referencia', () => {
    const base = pagoSintetico(0, { apellido: 'Pérez', nombre: 'Ana' });
    const otro = pagoSintetico(0, { apellido: 'Muñoz', nombre: 'Güemes' });
    const primero = serializarConNombreAprobado(base);
    const segundo = serializarConNombreAprobado(otro);
    expect(primero.ok).toBe(true);
    expect(segundo.ok).toBe(true);
    if (!primero.ok || !segundo.ok) {
      return;
    }

    const registro1 = Buffer.from(primero.value.bytes).toString('latin1').split('\n');
    const registro2 = Buffer.from(segundo.value.bytes).toString('latin1').split('\n');
    expect(registro1[2]?.slice(34, 54)).toBe('PEREZ ANA'.padEnd(20, ' '));
    expect(registro2[2]?.slice(34, 54)).toBe('MUNOZ GUEMES'.padEnd(20, ' '));

    // Fuera de 35–54 solo cambia el nombre: importe, cuenta, documento y referencia siguen.
    expect(registro1[2]?.slice(0, 34)).toBe(registro2[2]?.slice(0, 34));
    expect(registro1[2]?.slice(54)).toBe(registro2[2]?.slice(54));
    expect(base.neto).toBe(otro.neto);
    expect(base.numeroCuenta).toBe(otro.numeroCuenta);
    expect(base.ref).toEqual(otro.ref);
  });

  it('el mapper usa la política aprobada y entrega 20 caracteres sin truncar', () => {
    const pago = pagoSintetico(0, { apellido: 'A'.repeat(10), nombre: 'B'.repeat(9) });
    const resultado = mapearPatagonia(
      perfilPatagonia(),
      parametrosSinteticos(),
      [pago],
      politicaConNombreAprobado(),
    );
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      const r2 = resultado.value.entradas.find((entrada) => entrada.recordId === 'PAT_R2');
      expect(r2?.valores['r2_apellidoNombre']).toBe('A'.repeat(10) + ' ' + 'B'.repeat(9));
    }
  });

  it('la compuerta productiva sigue cerrada', () => {
    expect(produccionPatagoniaHabilitada()).toBe(false);
  });
});
