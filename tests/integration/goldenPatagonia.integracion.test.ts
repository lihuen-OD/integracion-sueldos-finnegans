// Golden técnico 100 % sintético Patagonia B.2 (CP-F6-C). Compone directo perfil,
// parámetros, política de test, mapper, serializer e inspector. NO pasa por la fachada
// productiva, NO homologa el banco y NO habilita pagos reales.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ID_REGISTRO_PAT_2,
  crearSpecPatagoniaB2,
  inspeccionarPatagonia,
  resuelto,
  serializarPatagonia,
} from '../../src/banks/patagonia-b2';
import { politicaSintetica } from '../unit/banks/patagonia-b2/auxiliares';
import {
  lotesGoldenPatagonia,
  pagosGoldenPatagonia,
  parametrosGoldenPatagonia,
  perfilPatagoniaGolden,
} from '../fixtures/synthetic/goldenPatagonia';

interface GoldenPatagonia {
  readonly etiqueta: string;
  readonly descripcion: string;
  readonly pat1: 'ESPACIOS' | 'CEROS';
  readonly pat2: 'NUMERICA' | 'ALFANUMERICA';
  readonly lineSeparator: 'LF' | 'CRLF';
  readonly trailingSeparator: boolean;
  readonly cantidadLotes: number;
  readonly cantidadPagos: number;
  readonly totalImporteCentavos: string;
  readonly sha256: string;
  readonly bytesHex: string;
}

const golden = JSON.parse(
  readFileSync(
    new URL('../fixtures/synthetic/golden/patagonia-b2-tecnico-sintetico.json', import.meta.url),
    'utf8',
  ),
) as GoldenPatagonia;

function bytesGolden(): Uint8Array {
  return Uint8Array.from(Buffer.from(golden.bytesHex, 'hex'));
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function archivoGolden() {
  const parametros = parametrosGoldenPatagonia();
  const pagos = pagosGoldenPatagonia();
  const lotes = lotesGoldenPatagonia(pagos);
  return serializarPatagonia(
    perfilPatagoniaGolden(),
    parametros,
    pagos,
    politicaSintetica({ loteo: () => resuelto(lotes) }),
  );
}

describe('golden técnico sintético Patagonia B.2', () => {
  it('lleva la etiqueta exacta y metadatos técnicos explícitos', () => {
    expect(golden.etiqueta).toBe('GOLDEN TÉCNICO SINTÉTICO — NO HOMOLOGADO POR BANCO PATAGONIA.');
    expect(golden.descripcion).toContain('sin homologar');
    expect(golden.pat1).toBe('ESPACIOS');
    expect(golden.pat2).toBe('NUMERICA');
    expect(golden.lineSeparator).toBe('LF');
    expect(golden.trailingSeparator).toBe(false);
    expect(golden.cantidadLotes).toBe(2);
    expect(golden.cantidadPagos).toBe(2);
    expect(golden.totalImporteCentavos).toBe('84000050');
  });

  it('reproduce exactamente los bytes y el SHA-256 del fixture', () => {
    const archivo = archivoGolden();
    expect(archivo.ok).toBe(true);
    if (!archivo.ok) {
      return;
    }
    expect(archivo.value.bytes).toHaveLength(1004);
    expect(Buffer.from(archivo.value.bytes).toString('hex')).toBe(golden.bytesHex);
    expect(sha256(archivo.value.bytes)).toBe(golden.sha256);
    expect(archivo.value.totales).toEqual({
      totalImporte: 84_000_050n,
      cantidadPagos: golden.cantidadPagos,
      cantidadLotes: golden.cantidadLotes,
      importesPorLote: [42_000_025n, 42_000_025n],
    });
  });

  it('el inspector independiente revalida estructura, cantidades y totales desde bytes', () => {
    const parametros = parametrosGoldenPatagonia();
    const inspeccion = inspeccionarPatagonia(bytesGolden(), parametros);
    expect(inspeccion.ok).toBe(true);
    if (!inspeccion.ok) {
      return;
    }
    expect(inspeccion.value.cantidadLotesDeclarada).toBe(golden.cantidadLotes);
    expect(inspeccion.value.cantidadLotesCalculada).toBe(golden.cantidadLotes);
    expect(inspeccion.value.cantidadPagosDeclarada).toBe(golden.cantidadPagos);
    expect(inspeccion.value.cantidadPagosCalculada).toBe(golden.cantidadPagos);
    expect(inspeccion.value.totalDeclarado).toBe(84_000_050n);
    expect(inspeccion.value.totalCalculado).toBe(84_000_050n);
    expect(inspeccion.value.lotes.map((lote) => lote.numeroLote)).toEqual(['0001', '0002']);
  });

  it('una mutación de bytes invalida el golden aunque el archivo siga teniendo el mismo largo', () => {
    const bytes = bytesGolden();
    const especificacion = crearSpecPatagoniaB2(parametrosGoldenPatagonia());
    const r2 = especificacion.records.find((registro) => registro.id === ID_REGISTRO_PAT_2);
    const importe = r2?.fields.find((campo) => campo.id === 'r2_importeNeto');
    if (importe === undefined) {
      throw new Error('campo de importe ausente');
    }
    const lineaR2 = bytesGolden().findIndex((byte, indice) => indice % 201 === 0 && byte === 0x32);
    bytes[lineaR2 + importe.start - 1] = 0x39;
    const inspeccion = inspeccionarPatagonia(bytes, parametrosGoldenPatagonia());
    expect(inspeccion.ok).toBe(false);
    if (!inspeccion.ok) {
      expect(inspeccion.error.map((error) => error.codigo)).toContain('IMPORTE_LOTE_DISTINTO');
    }
  });
});
