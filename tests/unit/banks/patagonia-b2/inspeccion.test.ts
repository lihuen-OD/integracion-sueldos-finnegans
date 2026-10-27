// Inspector Patagonia B.2 (CP-F6-C): reconstruye totales y cantidades desde bytes y
// detecta mutaciones directas sin confiar en el mapper ni en los modelos de generación.
import { describe, expect, it } from 'vitest';
import {
  ID_REGISTRO_PAT_0,
  ID_REGISTRO_PAT_1,
  ID_REGISTRO_PAT_2,
  crearSpecPatagoniaB2,
  inspeccionarPatagonia,
  resuelto,
  serializarPatagonia,
  type ErrorInspeccionPatagonia,
  type LotePropuestoPatagonia,
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

function bytesDe(
  pagos: readonly PagoPatagonia[],
  parametros: ParametrosEnvioPatagonia,
  lotes?: readonly LotePropuestoPatagonia[],
): Uint8Array {
  const politica = politicaSintetica(lotes === undefined ? {} : { loteo: () => resuelto(lotes) });
  const resultado = serializarPatagonia(perfilPatagonia(), parametros, pagos, politica);
  if (!resultado.ok) {
    throw new Error(`no se pudo preparar el fixture: ${JSON.stringify(resultado.error)}`);
  }
  return resultado.value.bytes;
}

function dosLotes(pagos: readonly PagoPatagonia[]): readonly LotePropuestoPatagonia[] {
  const primero = pagos[0];
  const segundo = pagos[1];
  if (primero === undefined || segundo === undefined) {
    throw new Error('se esperaban dos pagos');
  }
  return [loteSintetico('0001', [primero]), loteSintetico('0002', [segundo])];
}

function campoDe(
  parametros: ParametrosEnvioPatagonia,
  bytes: Uint8Array,
  indiceRegistro: number,
  campoId: string,
): { readonly start: number; readonly end: number; readonly recordLength: number } {
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
  return { start: field.start, end: field.end, recordLength: registro.recordLength };
}

function mutarCampo(
  parametros: ParametrosEnvioPatagonia,
  bytes: Uint8Array,
  indiceRegistro: number,
  campoId: string,
  nuevo: string,
): Uint8Array {
  const field = campoDe(parametros, bytes, indiceRegistro, campoId);
  const inicio =
    indiceRegistro * (field.recordLength + parametros.lineSeparator.length) + field.start - 1;
  if (nuevo.length !== field.end - field.start + 1) {
    throw new Error(`mutación de longitud incorrecta para ${campoId}`);
  }
  const mutado = bytes.slice();
  for (let indice = 0; indice < nuevo.length; indice += 1) {
    mutado[inicio + indice] = nuevo.charCodeAt(indice);
  }
  return mutado;
}

function codigos(resultado: {
  ok: boolean;
  error?: readonly ErrorInspeccionPatagonia[];
}): string[] {
  return resultado.ok ? [] : (resultado.error ?? []).map((error) => error.codigo);
}

function valor(resultado: {
  ok: boolean;
  value?: {
    cantidadLotesDeclarada: number;
    cantidadLotesCalculada: number;
    cantidadPagosDeclarada: number;
    cantidadPagosCalculada: number;
    totalDeclarado: bigint;
    totalCalculado: bigint;
    lotes: readonly {
      numeroLote: string;
      cantidadDeclarada: number;
      cantidadCalculada: number;
      importeDeclarado: bigint;
      importeCalculado: bigint;
    }[];
  };
  error?: readonly ErrorInspeccionPatagonia[];
}) {
  if (!resultado.ok || resultado.value === undefined) {
    throw new Error(`inspección rechazada: ${JSON.stringify(resultado.error)}`);
  }
  return resultado.value;
}

describe('inspector Patagonia B.2', () => {
  it('reconstruye cantidades, totales y lotes desde bytes de un solo lote', () => {
    const parametros = parametrosSinteticos();
    const pago = pagoSintetico(0);
    const inspeccion = valor(inspeccionarPatagonia(bytesDe([pago], parametros), parametros));
    expect(inspeccion.cantidadLotesDeclarada).toBe(1);
    expect(inspeccion.cantidadLotesCalculada).toBe(1);
    expect(inspeccion.cantidadPagosDeclarada).toBe(1);
    expect(inspeccion.cantidadPagosCalculada).toBe(1);
    expect(inspeccion.totalDeclarado).toBe(pago.neto);
    expect(inspeccion.totalCalculado).toBe(pago.neto);
    expect(inspeccion.lotes).toEqual([
      {
        numeroLote: '0001',
        cantidadDeclarada: 1,
        cantidadCalculada: 1,
        importeDeclarado: pago.neto,
        importeCalculado: pago.neto,
      },
    ]);
  });

  it('reconstruye múltiples lotes y pagos en orden', () => {
    const parametros = parametrosSinteticos({ lineSeparator: '\r\n', trailingSeparator: true });
    const p0 = pagoSintetico(0);
    const p1 = pagoSintetico(1);
    const bytes = bytesDe([p0, p1], parametros, dosLotes([p0, p1]));
    const inspeccion = valor(inspeccionarPatagonia(bytes, parametros));
    expect(inspeccion.cantidadLotesCalculada).toBe(2);
    expect(inspeccion.cantidadPagosCalculada).toBe(2);
    expect(inspeccion.totalCalculado).toBe(p0.neto + p1.neto);
    expect(inspeccion.lotes.map((lote) => lote.numeroLote)).toEqual(['0001', '0002']);
    expect(inspeccion.lotes.map((lote) => lote.importeCalculado)).toEqual([p0.neto, p1.neto]);
  });

  it('acepta PAT-1 ceros y PAT-2 alfanumérica sin convertir pendientes en error', () => {
    const parametros = parametrosSinteticos({
      hipotesisRellenoPat1: 'CEROS',
      hipotesisDependenciaPat2: 'ALFANUMERICA',
    });
    const bytes = bytesDe([pagoSintetico(0, { codigoDependencia: 'AB12' })], parametros);
    expect(inspeccionarPatagonia(bytes, parametros).ok).toBe(true);
  });

  it('rechaza un archivo con separador alterado', () => {
    const parametros = parametrosSinteticos();
    const bytes = bytesDe([pagoSintetico(0)], parametros);
    const mutado = bytes.slice();
    mutado[200] = 0x0d;
    const resultado = inspeccionarPatagonia(mutado, parametros);
    expect(resultado.ok).toBe(false);
    expect(codigos(resultado)).toEqual(['ARCHIVO_PATAGONIA_INVALIDO']);
  });

  it('rechaza un archivo truncado', () => {
    const parametros = parametrosSinteticos();
    const bytes = bytesDe([pagoSintetico(0)], parametros);
    const resultado = inspeccionarPatagonia(bytes.slice(0, -1), parametros);
    expect(resultado.ok).toBe(false);
    expect(codigos(resultado)).toEqual(['ARCHIVO_PATAGONIA_INVALIDO']);
  });

  it('detecta cantidad de lotes declarada distinta', () => {
    const parametros = parametrosSinteticos();
    const bytes = bytesDe([pagoSintetico(0)], parametros);
    const resultado = inspeccionarPatagonia(
      mutarCampo(parametros, bytes, 0, 'r0_cantidadLotes', '0002'),
      parametros,
    );
    expect(codigos(resultado)).toContain('CANTIDAD_LOTES_DISTINTA');
  });

  it('detecta cantidad de detalles declarada distinta', () => {
    const parametros = parametrosSinteticos();
    const bytes = bytesDe([pagoSintetico(0), pagoSintetico(1)], parametros);
    const resultado = inspeccionarPatagonia(
      mutarCampo(parametros, bytes, 1, 'r1_cantidadLote', '001'),
      parametros,
    );
    expect(codigos(resultado)).toContain('CANTIDAD_DETALLE_DISTINTA');
    expect(codigos(resultado)).toContain('CANTIDAD_PAGOS_DISTINTA');
  });

  it('detecta importe total declarado distinto', () => {
    const parametros = parametrosSinteticos();
    const bytes = bytesDe([pagoSintetico(0)], parametros);
    const resultado = inspeccionarPatagonia(
      mutarCampo(parametros, bytes, 0, 'r0_importeLotes', '000000000123457'),
      parametros,
    );
    expect(codigos(resultado)).toContain('IMPORTE_TOTAL_DISTINTO');
  });

  it('detecta importe de lote declarado distinto', () => {
    const parametros = parametrosSinteticos();
    const bytes = bytesDe([pagoSintetico(0)], parametros);
    const resultado = inspeccionarPatagonia(
      mutarCampo(parametros, bytes, 1, 'r1_importeLote', '000000000123457'),
      parametros,
    );
    expect(codigos(resultado)).toContain('IMPORTE_LOTE_DISTINTO');
  });

  it('detecta importe de detalle mutado', () => {
    const parametros = parametrosSinteticos();
    const bytes = bytesDe([pagoSintetico(0)], parametros);
    const resultado = inspeccionarPatagonia(
      mutarCampo(parametros, bytes, 2, 'r2_importeNeto', '00000123457'),
      parametros,
    );
    expect(codigos(resultado)).toContain('IMPORTE_LOTE_DISTINTO');
    expect(codigos(resultado)).toContain('IMPORTE_TOTAL_DISTINTO');
  });

  it('detecta importe de detalle no positivo', () => {
    const parametros = parametrosSinteticos();
    const bytes = bytesDe([pagoSintetico(0)], parametros);
    const resultado = inspeccionarPatagonia(
      mutarCampo(parametros, bytes, 2, 'r2_importeNeto', '00000000000'),
      parametros,
    );
    expect(codigos(resultado)).toContain('IMPORTE_DETALLE_FUERA_DE_LAYOUT');
    expect(codigos(resultado)).toContain('IMPORTE_LOTE_FUERA_DE_LAYOUT');
    expect(codigos(resultado)).toContain('IMPORTE_TOTAL_FUERA_DE_LAYOUT');
  });

  it('detecta número de lote de R1 distinto del R2', () => {
    const parametros = parametrosSinteticos();
    const bytes = bytesDe([pagoSintetico(0)], parametros);
    const resultado = inspeccionarPatagonia(
      mutarCampo(parametros, bytes, 1, 'r1_numeroLote', '0002'),
      parametros,
    );
    expect(codigos(resultado)).toContain('NUMERO_LOTE_INCONSISTENTE');
  });

  it('detecta número de lote de R2 distinto del R1', () => {
    const parametros = parametrosSinteticos();
    const bytes = bytesDe([pagoSintetico(0)], parametros);
    const resultado = inspeccionarPatagonia(
      mutarCampo(parametros, bytes, 2, 'r2_numeroLote', '0002'),
      parametros,
    );
    expect(codigos(resultado)).toContain('NUMERO_LOTE_INCONSISTENTE');
  });

  it('detecta número de lote repetido entre lotes', () => {
    const parametros = parametrosSinteticos();
    const p0 = pagoSintetico(0);
    const p1 = pagoSintetico(1);
    const bytes = bytesDe([p0, p1], parametros, dosLotes([p0, p1]));
    const resultado = inspeccionarPatagonia(
      mutarCampo(parametros, bytes, 3, 'r1_numeroLote', '0001'),
      parametros,
    );
    expect(codigos(resultado)).toContain('NUMERO_LOTE_REPETIDO');
  });

  it('detecta EMPRESA inconsistente en R0, R1 y R2', () => {
    const parametros = parametrosSinteticos();
    const bytes = bytesDe([pagoSintetico(0)], parametros);
    const enR0 = inspeccionarPatagonia(
      mutarCampo(parametros, bytes, 0, 'r0_numeroEmpresaFinal', '1235'),
      parametros,
    );
    const enR1 = inspeccionarPatagonia(
      mutarCampo(parametros, bytes, 1, 'r1_numeroEmpresa', '1235'),
      parametros,
    );
    const enR2 = inspeccionarPatagonia(
      mutarCampo(parametros, bytes, 2, 'r2_numeroEmpresa', '1235'),
      parametros,
    );
    expect(codigos(enR0)).toContain('EMPRESA_INCONSISTENTE');
    expect(codigos(enR1)).toContain('EMPRESA_INCONSISTENTE');
    expect(codigos(enR2)).toContain('EMPRESA_INCONSISTENTE');
  });

  it('detecta número de envío inconsistente entre R0 y R1', () => {
    const parametros = parametrosSinteticos();
    const bytes = bytesDe([pagoSintetico(0)], parametros);
    const resultado = inspeccionarPatagonia(
      mutarCampo(parametros, bytes, 1, 'r1_numeroEnvio', '02'),
      parametros,
    );
    expect(codigos(resultado)).toContain('NUMERO_ENVIO_INCONSISTENTE');
  });
});
