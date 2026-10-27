// Serialización Patagonia B.2 (CP-F6-C): bytes deterministas vía API pública F4, con
// separador, salto final, PAT-1 y PAT-2 explícitos. No hay defaults ni bytes parciales.
import { describe, expect, it } from 'vitest';
import type { Centavos } from '../../../../src/domain/money';
import {
  ID_REGISTRO_PAT_0,
  ID_REGISTRO_PAT_1,
  ID_REGISTRO_PAT_2,
  crearSpecPatagoniaB2,
  resuelto,
  serializarPatagonia,
  sinResolucion,
  type ErrorSerializacionPatagonia,
  type LotePropuestoPatagonia,
  type TotalesPatagonia,
  type PagoPatagonia,
  type ParametrosEnvioPatagonia,
} from '../../../../src/banks/patagonia-b2';
import {
  loteSintetico,
  pagoSintetico,
  parametrosSinteticos,
  perfilPatagonia,
  politicaSintetica,
} from './auxiliares';

function valor(resultado: {
  ok: boolean;
  value?: { bytes: Uint8Array; totales: TotalesPatagonia };
  error?: readonly ErrorSerializacionPatagonia[];
}) {
  if (!resultado.ok || resultado.value === undefined) {
    throw new Error(`serialización rechazada: ${JSON.stringify(resultado.error)}`);
  }
  return resultado.value;
}

function texto(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

function lineas(parametros: ParametrosEnvioPatagonia, bytes: Uint8Array): string[] {
  return texto(bytes).split(parametros.lineSeparator);
}

function campo(
  parametros: ParametrosEnvioPatagonia,
  bytes: Uint8Array,
  indiceRegistro: number,
  campoId: string,
): string {
  const spec = crearSpecPatagoniaB2(parametros);
  const inicioRegistro = indiceRegistro * (200 + parametros.lineSeparator.length);
  const tipo = String.fromCharCode(bytes[inicioRegistro] ?? 0);
  const registroId =
    tipo === '0' ? ID_REGISTRO_PAT_0 : tipo === '1' ? ID_REGISTRO_PAT_1 : ID_REGISTRO_PAT_2;
  const registro = spec.records.find((candidato) => candidato.id === registroId);
  if (registro === undefined) {
    throw new Error('registro inexistente');
  }
  const field = registro.fields.find((candidato) => candidato.id === campoId);
  if (field === undefined) {
    throw new Error(`campo inexistente: ${campoId}`);
  }
  return texto(bytes.slice(inicioRegistro + field.start - 1, inicioRegistro + field.end));
}

function dosLotes(pagos: readonly PagoPatagonia[]): readonly LotePropuestoPatagonia[] {
  const primero = pagos[0];
  const segundo = pagos[1];
  if (primero === undefined || segundo === undefined) {
    throw new Error('se esperaban dos pagos');
  }
  return [loteSintetico('0001', [primero]), loteSintetico('0002', [segundo])];
}

describe('serialización Patagonia B.2', () => {
  it('genera R0 + R1 + R2 con LF sin salto final y totales exactos', () => {
    const parametros = parametrosSinteticos();
    const pago = pagoSintetico(0);
    const resultado = valor(
      serializarPatagonia(perfilPatagonia(), parametros, [pago], politicaSintetica()),
    );

    expect(resultado.totales).toEqual({
      totalImporte: pago.neto,
      cantidadPagos: 1,
      cantidadLotes: 1,
      importesPorLote: [pago.neto],
    });
    expect(resultado.bytes).toHaveLength(3 * 200 + 2);
    const filas = lineas(parametros, resultado.bytes);
    expect(filas).toHaveLength(3);
    expect(filas[0]?.slice(0, 4)).toBe('0034');
    expect(filas[1]?.slice(0, 1)).toBe('1');
    expect(filas[2]?.slice(0, 1)).toBe('2');
    expect(campo(parametros, resultado.bytes, 0, 'r0_cantidadLotes')).toBe('0001');
    expect(campo(parametros, resultado.bytes, 0, 'r0_importeLotes')).toBe('000000000123456');
    expect(campo(parametros, resultado.bytes, 1, 'r1_cantidadLote')).toBe('001');
    expect(campo(parametros, resultado.bytes, 1, 'r1_importeLote')).toBe('000000000123456');
    expect(campo(parametros, resultado.bytes, 2, 'r2_importeNeto')).toBe('00000123456');
    expect(campo(parametros, resultado.bytes, 2, 'r2_numeroComprobante')).toBe('0001000');
    expect(campo(parametros, resultado.bytes, 2, 'r2_apellidoNombre').trimEnd()).toBe('PEREZ ANA');
    expect(campo(parametros, resultado.bytes, 2, 'r2_codigoBanco')).toBe('034');
    expect(campo(parametros, resultado.bytes, 2, 'r2_numeroEmpresa')).toBe('1234');
  });

  it('es determinista para la misma entrada', () => {
    const parametros = parametrosSinteticos();
    const politica = politicaSintetica();
    const primero = valor(
      serializarPatagonia(perfilPatagonia(), parametros, [pagoSintetico(0)], politica),
    );
    const segundo = valor(
      serializarPatagonia(perfilPatagonia(), parametros, [pagoSintetico(0)], politica),
    );
    expect(primero.bytes).toEqual(segundo.bytes);
    expect(primero.totales).toEqual(segundo.totales);
  });

  it('respeta CRLF y salto final explícitos, sin agregar defaults', () => {
    const parametros = parametrosSinteticos({
      lineSeparator: '\r\n',
      trailingSeparator: true,
    });
    const resultado = valor(
      serializarPatagonia(perfilPatagonia(), parametros, [pagoSintetico(0)], politicaSintetica()),
    );
    expect(resultado.bytes).toHaveLength(3 * 200 + 3 * 2);
    expect(texto(resultado.bytes).endsWith('\r\n')).toBe(true);
    expect(lineas(parametros, resultado.bytes)).toHaveLength(4);
  });

  it('preserva el orden de lotes y pagos y calcula un importe por lote', () => {
    const parametros = parametrosSinteticos();
    const p0 = pagoSintetico(0);
    const p1 = pagoSintetico(1);
    const politica = politicaSintetica({ loteo: (pagos) => resuelto(dosLotes(pagos)) });
    const resultado = valor(serializarPatagonia(perfilPatagonia(), parametros, [p0, p1], politica));

    expect(resultado.totales).toEqual({
      totalImporte: p0.neto + p1.neto,
      cantidadPagos: 2,
      cantidadLotes: 2,
      importesPorLote: [p0.neto, p1.neto],
    });
    expect(resultado.bytes).toHaveLength(5 * 200 + 4);
    expect(campo(parametros, resultado.bytes, 2, 'r2_numeroLote')).toBe('0001');
    expect(campo(parametros, resultado.bytes, 3, 'r1_numeroLote')).toBe('0002');
    expect(campo(parametros, resultado.bytes, 4, 'r2_numeroLote')).toBe('0002');
  });

  it('escribe PAT-1 como espacios o ceros según la hipótesis explícita', () => {
    const conEspacios = valor(
      serializarPatagonia(
        perfilPatagonia(),
        parametrosSinteticos({ hipotesisRellenoPat1: 'ESPACIOS' }),
        [pagoSintetico(0)],
        politicaSintetica(),
      ),
    );
    const conCeros = valor(
      serializarPatagonia(
        perfilPatagonia(),
        parametrosSinteticos({ hipotesisRellenoPat1: 'CEROS' }),
        [pagoSintetico(0)],
        politicaSintetica(),
      ),
    );
    expect(campo(parametrosSinteticos(), conEspacios.bytes, 2, 'r2_rellenoPat1')).toBe(
      ' '.repeat(93),
    );
    expect(campo(parametrosSinteticos(), conCeros.bytes, 2, 'r2_rellenoPat1')).toBe('0'.repeat(93));
  });

  it('escribe PAT-2 alfanumérico cuando la hipótesis lo autoriza', () => {
    const parametros = parametrosSinteticos({ hipotesisDependenciaPat2: 'ALFANUMERICA' });
    const resultado = valor(
      serializarPatagonia(
        perfilPatagonia(),
        parametros,
        [pagoSintetico(0, { codigoDependencia: 'AB12' })],
        politicaSintetica(),
      ),
    );
    expect(campo(parametros, resultado.bytes, 2, 'r2_codigoDependencia')).toBe(
      'AB12' + ' '.repeat(11),
    );
  });

  it('no devuelve bytes si una política no resuelve el loteo', () => {
    const resultado = serializarPatagonia(
      perfilPatagonia(),
      parametrosSinteticos(),
      [pagoSintetico(0)],
      politicaSintetica({ loteo: () => sinResolucion('P-20') }),
    );
    expect(resultado.ok).toBe(false);
    expect('value' in resultado).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.map((error) => error.codigo)).toEqual(['POLITICA_SIN_RESOLUCION']);
    }
  });

  it('no devuelve bytes si el mapper rechaza un neto no positivo', () => {
    const resultado = serializarPatagonia(
      perfilPatagonia(),
      parametrosSinteticos(),
      [pagoSintetico(0, { neto: 0n as Centavos })],
      politicaSintetica(),
    );
    expect(resultado.ok).toBe(false);
    expect('value' in resultado).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.map((error) => error.codigo)).toContain('NETO_NO_POSITIVO');
    }
  });

  it('no devuelve bytes si no hay pagos', () => {
    const resultado = serializarPatagonia(
      perfilPatagonia(),
      parametrosSinteticos(),
      [],
      politicaSintetica(),
    );
    expect(resultado.ok).toBe(false);
    expect('value' in resultado).toBe(false);
  });
});
