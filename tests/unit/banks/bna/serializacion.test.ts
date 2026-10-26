// Serialización BNA (CP-F5-B): bytes deterministas vía API pública F4, con separador y
// salto final explícitos (BNA-9), sin defaults. Nunca se serializa un mapeo con errores.
import { describe, expect, it } from 'vitest';
import {
  POLITICA_BNA_PRODUCTIVA,
  crearSpecBna,
  serializarBna,
  type ErrorSerializacionBna,
} from '../../../../src/banks/bna';
import type { FileSpec } from '../../../../src/banks/fixed-width';
import {
  pagoSintetico,
  parametrosSinteticos,
  perfilSintetico,
  politicaSintetica,
} from './auxiliares';

function valor(resultado: {
  ok: boolean;
  value?: { bytes: Uint8Array; totales: { totalImporte: bigint; cantidad: number } };
  error?: readonly ErrorSerializacionBna[];
}) {
  if (!resultado.ok || resultado.value === undefined) {
    throw new Error(`serialización rechazada: ${JSON.stringify(resultado.error)}`);
  }
  return resultado.value;
}

function codigos(resultado: { ok: boolean; error?: readonly ErrorSerializacionBna[] }): string[] {
  return resultado.ok ? [] : (resultado.error ?? []).map((error) => error.codigo);
}

function texto(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

function lineas(spec: FileSpec, bytes: Uint8Array): string[] {
  const separador = spec.lineSeparator.value;
  const completo = texto(bytes);
  const recortado =
    spec.trailingSeparator.value && completo.endsWith(separador)
      ? completo.slice(0, -separador.length)
      : completo;
  return recortado.split(separador);
}

function campo(linea: string, spec: FileSpec, recordId: string, campoId: string): string {
  const registro = spec.records.find((candidato) => candidato.id === recordId);
  const definicion = registro?.fields.find((candidato) => candidato.id === campoId);
  if (definicion === undefined) {
    throw new Error(`campo inexistente: ${campoId}`);
  }
  return linea.slice(definicion.start - 1, definicion.end);
}

describe('serializarBna · separadores explícitos BNA-9', () => {
  it('con LF y sin trailing genera 3 líneas de 200 bytes y no agrega salto final', () => {
    const parametros = parametrosSinteticos({ lineSeparator: '\n', trailingSeparator: false });
    const resultado = valor(
      serializarBna(perfilSintetico(), parametros, [pagoSintetico(1)], politicaSintetica()),
    );
    const spec = crearSpecBna(parametros);
    const separadas = lineas(spec, resultado.bytes);
    expect(separadas).toHaveLength(3);
    expect(separadas.map((linea) => linea.length)).toEqual([200, 200, 200]);
    expect(resultado.bytes).toHaveLength(602);
    expect(texto(resultado.bytes).endsWith('\n')).toBe(false);
  });

  it('con CRLF y trailing true respeta exactamente ambos y termina en CRLF', () => {
    const parametros = parametrosSinteticos({
      lineSeparator: '\r\n',
      trailingSeparator: true,
    });
    const resultado = valor(
      serializarBna(perfilSintetico(), parametros, [pagoSintetico(1)], politicaSintetica()),
    );
    const spec = crearSpecBna(parametros);
    const separadas = lineas(spec, resultado.bytes);
    expect(separadas).toHaveLength(3);
    expect(separadas.map((linea) => linea.length)).toEqual([200, 200, 200]);
    expect(resultado.bytes).toHaveLength(606);
    expect(texto(resultado.bytes).endsWith('\r\n')).toBe(true);
  });

  it('con LF y trailing true agrega exactamente un LF final', () => {
    const parametros = parametrosSinteticos({ lineSeparator: '\n', trailingSeparator: true });
    const resultado = valor(
      serializarBna(perfilSintetico(), parametros, [pagoSintetico(1)], politicaSintetica()),
    );
    expect(resultado.bytes).toHaveLength(603);
    expect(texto(resultado.bytes).endsWith('\n')).toBe(true);
  });

  it('es determinista para las mismas entradas y geometría', () => {
    const args = [
      perfilSintetico(),
      parametrosSinteticos(),
      [pagoSintetico(1), pagoSintetico(2)],
      politicaSintetica(),
    ] as const;
    const primera = valor(serializarBna(...args));
    const segunda = valor(serializarBna(...args));
    expect(primera.bytes).toEqual(segunda.bytes);
    expect(primera.totales).toEqual(segunda.totales);
  });
});

describe('serializarBna · contenido y totales', () => {
  it('escribe convenio de 10 bytes, cantidad y total en las posiciones documentadas', () => {
    const pagos = [pagoSintetico(1), pagoSintetico(2)];
    const parametros = parametrosSinteticos({ lineSeparator: '\n', trailingSeparator: false });
    const resultado = valor(
      serializarBna(perfilSintetico('4455'), parametros, pagos, politicaSintetica()),
    );
    const spec = crearSpecBna(parametros);
    const [r1, , r2, r3] = lineas(spec, resultado.bytes);
    expect(r1).toBeDefined();
    expect(r2).toBeDefined();
    expect(r3).toBeDefined();
    if (r1 === undefined || r2 === undefined || r3 === undefined) {
      throw new Error('faltan líneas');
    }
    expect(campo(r1, spec, 'BNA_R1', 'r1_codigoConvenio')).toBe('0044550000');
    expect(campo(r1, spec, 'BNA_R1', 'r1_codigoConvenio')).toHaveLength(10);
    expect(campo(r1, spec, 'BNA_R1', 'r1_fechaCompensacion')).toBe('20261030');
    expect(campo(r3, spec, 'BNA_R3', 'r3_totalCantidad')).toBe('0000002');
    expect(campo(r3, spec, 'BNA_R3', 'r3_totalImporte')).toBe(
      String(resultado.totales.totalImporte).padStart(15, '0'),
    );
    expect(campo(r2, spec, 'BNA_R2', 'r2_referencia')).toBe('HABERES OCTUBRE');
  });

  it('usa la misma lista para R2 y para los totales', () => {
    const pagos = [
      pagoSintetico(1, { neto: 1n as never }),
      pagoSintetico(2, { neto: 2n as never }),
      pagoSintetico(3, { neto: 3n as never }),
    ];
    const parametros = parametrosSinteticos();
    const resultado = valor(
      serializarBna(perfilSintetico(), parametros, pagos, politicaSintetica()),
    );
    expect(resultado.totales).toEqual({ totalImporte: 6n, cantidad: 3 });
    const spec = crearSpecBna(parametros);
    const filas = lineas(spec, resultado.bytes);
    const importes = filas
      .filter((linea) => linea.startsWith('2'))
      .map((linea) => campo(linea, spec, 'BNA_R2', 'r2_importe'));
    expect(importes).toEqual(['0000000001', '0000000002', '0000000003']);
  });
});

describe('serializarBna · errores', () => {
  it('no serializa si la política productiva deja decisiones abiertas', () => {
    const resultado = serializarBna(
      perfilSintetico(),
      parametrosSinteticos(),
      [pagoSintetico(1)],
      POLITICA_BNA_PRODUCTIVA,
    );
    expect(resultado.ok).toBe(false);
    expect(codigos(resultado)).toContain('POLITICA_SIN_RESOLUCION');
  });

  it('envuelve un error técnico de F4 sin devolver bytes parciales', () => {
    const perfil = { ...perfilSintetico(), cuitEmpresa: '1'.repeat(12) as never };
    const resultado = serializarBna(
      perfil,
      parametrosSinteticos(),
      [pagoSintetico(1)],
      politicaSintetica(),
    );
    expect(resultado.ok).toBe(false);
    expect(codigos(resultado)).toContain('ERROR_SERIALIZACION');
    if (resultado.ok) {
      throw new Error('bytes inesperados');
    }
    const error = resultado.error[0];
    expect(error?.codigo).toBe('ERROR_SERIALIZACION');
    expect(error !== undefined && 'errores' in error).toBe(true);
  });
});
