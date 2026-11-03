// Golden técnico 100 % sintético Patagonia B.2 con PAT-2 confirmada (CP-F7-C2.3).
// Compone directo perfil, parámetros, política de test, mapper, serializer e inspector.
// NO pasa por la fachada productiva, NO homologa el banco y NO habilita pagos reales.
// El golden anterior (PAT-2 numérica) se conserva sin cambios en su archivo y SHA.
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
  parametrosGoldenPatagoniaAlfanumerica,
  perfilPatagoniaGolden,
} from '../fixtures/synthetic/goldenPatagonia';

interface GoldenPatagoniaPat2 {
  readonly etiqueta: string;
  readonly descripcion: string;
  readonly checkpoint: string;
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

interface GoldenPatagoniaAnterior {
  readonly sha256: string;
  readonly pat2: 'NUMERICA' | 'ALFANUMERICA';
}

const golden = JSON.parse(
  readFileSync(
    new URL(
      '../fixtures/synthetic/golden/patagonia-b2-tecnico-pat2-sintetico.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as GoldenPatagoniaPat2;

const anterior = JSON.parse(
  readFileSync(
    new URL('../fixtures/synthetic/golden/patagonia-b2-tecnico-sintetico.json', import.meta.url),
    'utf8',
  ),
) as GoldenPatagoniaAnterior;

const SHA_ANTERIOR = '36f55f2a0aee04e944c5347ecde62f6c8722418f8b0bca86ebf1a408848a7ade';

function bytesGolden(): Uint8Array {
  return Uint8Array.from(Buffer.from(golden.bytesHex, 'hex'));
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function pagosGolden(): ReturnType<typeof pagosGoldenPatagonia> {
  return pagosGoldenPatagonia().map((pago) => ({ ...pago, codigoDependencia: 'DEP001' }));
}

function archivoGolden() {
  const parametros = parametrosGoldenPatagoniaAlfanumerica();
  const pagos = pagosGolden();
  const lotes = lotesGoldenPatagonia(pagos);
  return serializarPatagonia(
    perfilPatagoniaGolden(),
    parametros,
    pagos,
    politicaSintetica({ loteo: () => resuelto(lotes) }),
  );
}

describe('golden técnico sintético Patagonia B.2 · PAT-2 confirmada', () => {
  it('está etiquetado como NO HOMOLOGADO y versionado en C2.3', () => {
    expect(golden.etiqueta).toBe('GOLDEN TÉCNICO SINTÉTICO — NO HOMOLOGADO POR BANCO PATAGONIA.');
    expect(golden.descripcion).toContain('sin homologar');
    expect(golden.checkpoint).toBe('CP-F7-C2.3');
    expect(golden.pat1).toBe('ESPACIOS');
    expect(golden.pat2).toBe('ALFANUMERICA');
    expect(golden.lineSeparator).toBe('LF');
    expect(golden.trailingSeparator).toBe(false);
    expect(golden.cantidadLotes).toBe(2);
    expect(golden.cantidadPagos).toBe(2);
    expect(golden.totalImporteCentavos).toBe('84000050');
  });

  it('es un golden nuevo y distinto del anterior, que conserva su SHA', () => {
    expect(anterior.sha256).toBe(SHA_ANTERIOR);
    expect(anterior.pat2).toBe('NUMERICA');
    expect(golden.sha256).not.toBe(SHA_ANTERIOR);
    expect(sha256(bytesGolden())).toBe(golden.sha256);
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

  it('PC-02: cada R2 mide 200 y tiene DEP001 + espacios en 85–99', () => {
    const bytes = Buffer.from(golden.bytesHex, 'hex');
    const separador = golden.lineSeparator === 'LF' ? 1 : 2;
    const largo = 200 + separador;
    expect(bytes).toHaveLength(5 * largo - separador);

    const lineas: Buffer[] = [];
    for (let inicio = 0; inicio + 200 <= bytes.length; inicio += largo) {
      lineas.push(bytes.subarray(inicio, inicio + 200));
    }
    const r2 = lineas.filter((linea) => linea[0] === 0x32);
    expect(r2).toHaveLength(golden.cantidadPagos);

    for (const linea of r2) {
      expect(linea).toHaveLength(200);
      expect(linea.subarray(84, 99).toString('ascii')).toBe('DEP001' + ' '.repeat(9));
      expect(linea.subarray(83, 84).toString('ascii')).toBe('0');
      expect(linea.subarray(99, 100).toString('ascii')).toBe(' ');
      expect(linea.subarray(103, 196).every((byte) => byte === 0x20)).toBe(true);
      expect(linea.subarray(196, 200).toString('ascii')).toBe('1234');
    }
  });

  it('la spec confirma PAT-2 en 85–99 y conserva el registro de 200', () => {
    const parametros = parametrosGoldenPatagoniaAlfanumerica();
    const spec = crearSpecPatagoniaB2(parametros);
    const r2 = spec.records.find((registro) => registro.id === ID_REGISTRO_PAT_2);
    const dependencia = r2?.fields.find((campo) => campo.id === 'r2_codigoDependencia');
    if (dependencia === undefined || r2 === undefined) {
      throw new Error('campo de dependencia ausente');
    }
    expect(dependencia.start).toBe(85);
    expect(dependencia.end).toBe(99);
    expect(dependencia.declaredLength).toBe(15);
    expect(dependencia.type).toBe('A');
    expect(dependencia.padding).toEqual({ kind: 'SPACE_RIGHT' });
    expect(dependencia.status).toBe('CONFIRMADA');
    expect(r2.recordLength).toBe(200);
  });

  it('el inspector independiente revalida el golden con la hipótesis confirmada', () => {
    const parametros = parametrosGoldenPatagoniaAlfanumerica();
    const inspeccion = inspeccionarPatagonia(bytesGolden(), parametros);
    expect(inspeccion.ok).toBe(true);
    if (!inspeccion.ok) {
      return;
    }
    expect(inspeccion.value.cantidadLotesCalculada).toBe(golden.cantidadLotes);
    expect(inspeccion.value.cantidadPagosCalculada).toBe(golden.cantidadPagos);
    expect(inspeccion.value.totalCalculado).toBe(84_000_050n);
  });
});
