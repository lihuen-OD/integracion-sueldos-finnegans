// Regresiones F12-B · C-1 a C-5 sobre el camino técnico.
//
// Usa `POLITICA_BNA_PRODUCTIVA` (C-1..C-4 + P-17) y solo sustituye P-09/P-10 para poder
// serializar. No toca la compuerta productiva ni declara homologación: la generación real
// sigue cerrada. Todos los CUIL/CBU son sintéticos y se generan con los oráculos de tests.
import { describe, expect, it } from 'vitest';
import {
  ISSUES_BNA,
  POLITICA_BNA_PRODUCTIVA,
  inspeccionarBna,
  mapearBna,
  produccionBnaHabilitada,
  resuelto,
  serializarBna,
  type PoliticaBna,
} from '../../../../src/banks/bna';
import { parseCbu, type Cbu } from '../../../../src/domain/cbu';
import {
  createRandom,
  syntheticCbu,
  syntheticCuenta,
} from '../../../fixtures/synthetic/identities.ts';
import { pagoSintetico, parametrosSinteticos, perfilSintetico } from './auxiliares';

/** Política productiva con P-09/P-10 resuelto SOLO para recorrer la serialización. */
const POLITICA_TECNICA: PoliticaBna = {
  ...POLITICA_BNA_PRODUCTIVA,
  identificadorPrestamo: () => resuelto('0000'),
};

function cbuCon(entidad: string, sucursal: string, semilla: number): Cbu {
  const resultado = parseCbu(
    syntheticCbu(entidad, sucursal, syntheticCuenta(createRandom(semilla))),
  );
  if (!resultado.ok) {
    throw new Error(`CBU sintético rechazado: ${resultado.error}`);
  }
  return resultado.value;
}

function lineas(bytes: Uint8Array, separador: string, trailing: boolean): string[] {
  const completo = new TextDecoder('utf-8').decode(bytes);
  const sinFinal =
    trailing && completo.endsWith(separador) ? completo.slice(0, -separador.length) : completo;
  return sinFinal.split(separador);
}

/** Posiciones 1-based e inclusivas, tal como las documenta la spec. */
function campo(linea: string, inicio: number, fin: number): string {
  return linea.slice(inicio - 1, fin);
}

function generar(
  numeroPagos: number,
  opciones: {
    readonly referenciaUnivoca?: string;
    readonly fechaCompensacion?: string;
  } = {},
) {
  const pagos = Array.from({ length: numeroPagos }, (_, indice) => pagoSintetico(indice + 1));
  const parametros = parametrosSinteticos({
    lineSeparator: '\r\n',
    trailingSeparator: true,
    ...opciones,
  });
  const resultado = serializarBna(perfilSintetico(), parametros, pagos, POLITICA_TECNICA);
  if (!resultado.ok) {
    throw new Error(`serialización rechazada: ${JSON.stringify(resultado.error)}`);
  }
  return {
    pagos,
    parametros,
    resultado: resultado.value,
    filas: lineas(resultado.value.bytes, '\r\n', true),
  };
}

describe('C-1 · referencia unívoca vacía', () => {
  it('acepta la referencia vacía y ocupa exactamente 15 espacios en el R2', () => {
    const { filas } = generar(1, { referenciaUnivoca: '' });
    for (const linea of filas.slice(1, -1)) {
      expect(campo(linea, 35, 49)).toBe(' '.repeat(15));
      expect(campo(linea, 35, 49)).toHaveLength(15);
    }
  });

  it('conserva la validación de alfabeto y longitud para referencias no vacías', () => {
    const alfabeto = mapearBna(
      perfilSintetico(),
      parametrosSinteticos({ referenciaUnivoca: 'haberes' }),
      [pagoSintetico(1)],
      POLITICA_TECNICA,
    );
    expect(alfabeto.ok).toBe(false);
    const longitud = mapearBna(
      perfilSintetico(),
      parametrosSinteticos({ referenciaUnivoca: 'A'.repeat(16) }),
      [pagoSintetico(1)],
      POLITICA_TECNICA,
    );
    expect(longitud.ok).toBe(false);
  });
});

describe('registros de 200 caracteres y separadores', () => {
  it('emite R1 + R2* + R3 de 200 bytes con CRLF y salto final', () => {
    const { filas, resultado } = generar(3);
    expect(filas).toHaveLength(5);
    expect(filas.every((linea) => linea.length === 200)).toBe(true);
    expect(resultado.bytes).toHaveLength(5 * 200 + 5 * 2);
    expect(new TextDecoder().decode(resultado.bytes).endsWith('\r\n')).toBe(true);
    expect(filas.map((linea) => linea[0])).toEqual(['1', '2', '2', '2', '3']);
  });
});

describe('C-2 · CBU del beneficiario en cada R2', () => {
  it('usa el CBU de cada pago y nunca el CBU empresarial en el bloque 2 del R2', () => {
    const perfil = {
      ...perfilSintetico(),
      cbuEmpresa: cbuCon('011', '0001', 101),
    };
    const pagos = [
      pagoSintetico(1, { cbu: cbuCon('007', '1234', 501) }),
      pagoSintetico(2, { cbu: cbuCon('017', '0599', 502) }),
      pagoSintetico(3, { cbu: cbuCon('011', '4321', 503) }),
    ];
    const parametros = parametrosSinteticos({
      lineSeparator: '\r\n',
      trailingSeparator: true,
    });
    const resultado = serializarBna(perfil, parametros, pagos, POLITICA_TECNICA);
    if (!resultado.ok) throw new Error('serialización rechazada');
    const filas = lineas(resultado.value.bytes, '\r\n', true);
    const cabecera = filas[0];
    const detalles = filas.slice(1, -1);
    if (cabecera === undefined) throw new Error('sin R1');

    expect(campo(cabecera, 17, 30)).toBe(String(perfil.cbuEmpresa).slice(8, 22));
    detalles.forEach((linea, indice) => {
      const cbu = String(pagos[indice]?.cbu);
      expect(campo(linea, 10, 10)).toBe(cbu.slice(7, 8));
      expect(campo(linea, 11, 24)).toBe(cbu.slice(8, 22));
      expect(campo(linea, 11, 24)).not.toBe(campo(cabecera, 17, 30));
    });
  });

  it('preserva el orden de los pagos y su referencia de origen', () => {
    const pagos = [pagoSintetico(1), pagoSintetico(2), pagoSintetico(3)];
    const resultado = mapearBna(perfilSintetico(), parametrosSinteticos(), pagos, POLITICA_TECNICA);
    if (!resultado.ok) throw new Error('mapeo rechazado');
    const detalles = resultado.value.entradas.filter((entrada) => entrada.recordId === 'BNA_R2');
    expect(detalles.map((entrada) => entrada.valores['r2_numeroDocumento'])).toEqual(
      pagos.map((pago) => String(pago.cuil)),
    );
    expect(detalles.map((entrada) => entrada.valores['r2_importe'])).toEqual(
      pagos.map((pago) => String(pago.neto)),
    );
  });
});

describe('C-3 · entidad, sucursal y dígitos de control', () => {
  it.each([
    { entidad: '007', sucursal: '1234', semilla: 601 },
    { entidad: '011', sucursal: '0599', semilla: 602 },
    { entidad: '017', sucursal: '4321', semilla: 603 },
  ])(
    'deriva entidad 0+$entidad, sucursal $sucursal y DV desde el CBU del beneficiario',
    ({ entidad, sucursal, semilla }) => {
      const cbu = cbuCon(entidad, sucursal, semilla);
      const perfil = { ...perfilSintetico(), cbuEmpresa: cbuCon('011', '0001', 101) };
      const parametros = parametrosSinteticos({
        lineSeparator: '\r\n',
        trailingSeparator: true,
      });
      const resultado = serializarBna(
        perfil,
        parametros,
        [pagoSintetico(1, { cbu })],
        POLITICA_TECNICA,
      );
      if (!resultado.ok) throw new Error('serialización rechazada');
      const filas = lineas(resultado.value.bytes, '\r\n', true);
      const detalle = filas[1];
      if (detalle === undefined) throw new Error('sin R2');

      expect(campo(detalle, 2, 5)).toBe(`0${entidad}`);
      expect(campo(detalle, 6, 9)).toBe(sucursal);
      expect(campo(detalle, 10, 10)).toBe(String(cbu).slice(7, 8));
      expect(String(perfil.cbuEmpresa).slice(3, 7)).toBe('0001');
      expect(campo(filas[0] ?? '', 13, 16)).toBe('0001');
    },
  );
});

describe('C-4 · clase 1, tipo 02 y CUIL', () => {
  // BNA-1 queda CONFIRMADA por el diseño documental (p.11), no por homologación bancaria.
  it('identifica al beneficiario con 1/02 y sus 11 dígitos de CUIL', () => {
    const { pagos, filas } = generar(2);
    filas.slice(1, -1).forEach((linea, indice) => {
      const pago = pagos[indice];
      if (pago === undefined) throw new Error('pago ausente');
      expect(campo(linea, 72, 72)).toBe('1');
      expect(campo(linea, 73, 74)).toBe('02');
      expect(campo(linea, 75, 85)).toBe(String(pago.cuil));
      expect(campo(linea, 75, 85)).toMatch(/^[0-9]{11}$/);
      expect(campo(linea, 73, 74)).not.toBe('96');
    });
  });
});

describe('C-5 · fecha calendario real en el archivo', () => {
  it('acepta un 29 de febrero bisiesto y lo escribe en el R1', () => {
    const { filas } = generar(1, { fechaCompensacion: '20240229' });
    expect(campo(filas[0] ?? '', 32, 39)).toBe('20240229');
  });

  it('rechaza el 31 de febrero antes de serializar', () => {
    const resultado = serializarBna(
      perfilSintetico(),
      parametrosSinteticos({ fechaCompensacion: '20260231' }),
      [pagoSintetico(1)],
      POLITICA_TECNICA,
    );
    expect(resultado.ok).toBe(false);
  });
});

describe('totales, cantidad y cierre seguro', () => {
  it('declara en R3 el total y la cantidad de empleados de la misma lista', () => {
    const { pagos, filas, resultado } = generar(3);
    const total = pagos.reduce((suma, pago) => suma + pago.neto, 0n);
    expect(resultado.totales).toEqual({ totalImporte: total, cantidad: 3 });
    const r3 = filas.at(-1) ?? '';
    expect(campo(r3, 2, 16)).toBe(String(total).padStart(15, '0'));
    expect(campo(r3, 17, 23)).toBe('0000003');
    const inspeccion = inspeccionarBna(resultado.bytes, {
      lineSeparator: '\r\n',
      trailingSeparator: true,
    });
    expect(inspeccion.ok).toBe(true);
    if (inspeccion.ok) {
      expect(inspeccion.value.totalDeclarado).toBe(total);
      expect(inspeccion.value.cantidadCalculada).toBe(3);
    }
  });

  it('la política productiva sin P-09/P-10 no produce bytes', () => {
    const resultado = serializarBna(
      perfilSintetico(),
      parametrosSinteticos(),
      [pagoSintetico(1)],
      POLITICA_BNA_PRODUCTIVA,
    );
    expect(resultado.ok).toBe(false);
    const mapeo = mapearBna(
      perfilSintetico(),
      parametrosSinteticos(),
      [pagoSintetico(1)],
      POLITICA_BNA_PRODUCTIVA,
    );
    expect(mapeo.ok).toBe(false);
    if (!mapeo.ok) {
      const puntos = new Set(
        mapeo.error.map((error) => ('punto' in error ? error.punto : undefined)),
      );
      expect(puntos).toEqual(new Set(['P-09/P-10']));
    }
  });

  it('las compuertas productivas y la homologación siguen cerradas', () => {
    expect(produccionBnaHabilitada()).toBe(false);
    expect(ISSUES_BNA['BNA-1'].estado).toBe('CONFIRMADA');
    const estados: readonly string[] = Object.values(ISSUES_BNA).map((issue) => issue.estado);
    expect(estados.filter((estado) => estado === 'BLOQUEADA')).toEqual([]);
  });
});
