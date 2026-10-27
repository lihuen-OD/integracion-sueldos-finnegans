import { describe, expect, it } from 'vitest';
import {
  DOCS_BANCARIOS,
  ORIGENES_BANCARIOS,
  type FieldSpecBancaria,
} from '../../../../src/banks/trazabilidad';
import {
  ID_CAMPO_PAT_CODIGO_BANCO,
  ID_CAMPO_PAT_DEPENDENCIA,
  ID_CAMPO_PAT_RELLENO_PAT1,
  IDS_ISSUE_PATAGONIA,
  crearSpecPatagoniaB2,
  type ConfiguracionTecnicaPatagonia,
  type PatagoniaIssueId,
} from '../../../../src/banks/patagonia-b2';

const CONFIG = {
  hipotesisRellenoPat1: 'ESPACIOS',
  hipotesisDependenciaPat2: 'NUMERICA',
  lineSeparator: '\n',
  trailingSeparator: false,
} as const satisfies ConfiguracionTecnicaPatagonia;

const CAMPOS: readonly FieldSpecBancaria<PatagoniaIssueId>[] = crearSpecPatagoniaB2(
  CONFIG,
).records.flatMap((registro) => registro.fields);

function campo(id: string): FieldSpecBancaria<PatagoniaIssueId> {
  const encontrado = CAMPOS.find((c) => c.id === id);
  if (encontrado === undefined) {
    throw new Error(`Campo inexistente: ${id}`);
  }
  return encontrado;
}

describe('trazabilidad Patagonia B.2', () => {
  it('usa el catálogo cerrado de orígenes y documentos existente', () => {
    expect(ORIGENES_BANCARIOS).toEqual([
      'FINNEGANS',
      'MAESTRO',
      'PERFIL',
      'ENVIO',
      'DERIVADO',
      'FIJO',
    ]);
    expect(DOCS_BANCARIOS).toEqual(['BNA', 'PAT_DR', 'PAT_XL']);
  });

  it('cada campo conserva origin, source.doc, source.paginas e issues', () => {
    for (const f of CAMPOS) {
      expect(ORIGENES_BANCARIOS).toContain(f.origin);
      expect(f.source.doc).toBe('PAT_DR');
      expect(f.source.paginas.length).toBeGreaterThan(0);
      for (const pagina of f.source.paginas) {
        expect(Number.isInteger(pagina)).toBe(true);
        expect(pagina).toBeGreaterThanOrEqual(1);
        expect(pagina).toBeLessThanOrEqual(10);
      }
      for (const issue of f.issues ?? []) {
        expect(IDS_ISSUE_PATAGONIA).toContain(issue);
      }
    }
  });

  it('conserva el mapa exacto de issues por campo', () => {
    const conIssues = Object.fromEntries(
      CAMPOS.filter((c) => c.issues !== undefined).map((c) => [c.id, c.issues]),
    );
    expect(conIssues).toEqual({
      r0_numeroEmpresa: ['PAT-6'],
      r0_numeroEnvio: ['PAT-5'],
      r0_numeroEmpresaFinal: ['PAT-6'],
      r1_numeroLote: ['PAT-13'],
      r1_concepto: ['PAT-12'],
      r1_cantidadLote: ['PAT-13'],
      r1_numeroEnvio: ['PAT-5'],
      r1_version: ['PAT-15'],
      r1_numeroEmpresa: ['PAT-6'],
      r2_numeroComprobante: ['PAT-16'],
      r2_apellidoNombre: ['PAT-9'],
      r2_codigoBanco: ['PAT-17'],
      r2_tipoDocumento: ['PAT-8'],
      r2_provinciaDocumento: ['PAT-4'],
      r2_codigoDependencia: ['PAT-2'],
      r2_tipoLiquidacion: ['PAT-7'],
      r2_rellenoPat1: ['PAT-1'],
      r2_numeroEmpresa: ['PAT-6'],
    });
  });

  it('documenta PAT-XL como fuente complementaria sin duplicar la trazabilidad', () => {
    for (const id of [
      'r0_numeroEmpresa',
      'r0_numeroEnvio',
      'r1_concepto',
      'r2_importeNeto',
      'r2_apellidoNombre',
      'r2_tipoDocumento',
      'r2_tipoLiquidacion',
    ]) {
      expect(campo(id).source.nota).toContain('PAT-XL');
    }
  });

  it('R2 campo 8 no fija 034 y conserva PAT-17', () => {
    const banco = campo(ID_CAMPO_PAT_CODIGO_BANCO);
    expect(banco.fixedValue).toBeUndefined();
    expect(banco.origin).toBe('MAESTRO');
    expect(banco.source.paginas).toEqual([9]);
    expect(banco.issues).toEqual(['PAT-17']);
    expect(campo('r0_codigoBanco').fixedValue).toBe('034');
  });

  it('conserva orígenes concretos sin inventar uno nuevo', () => {
    expect(campo(ID_CAMPO_PAT_DEPENDENCIA).origin).toBe('MAESTRO');
    expect(campo(ID_CAMPO_PAT_RELLENO_PAT1).origin).toBe('FIJO');
    expect(campo('r2_apellidoNombre').origin).toBe('FINNEGANS');
    expect(campo('r2_tipoLiquidacion').origin).toBe('DERIVADO');
    expect(campo('r0_numeroEnvio').origin).toBe('ENVIO');
    expect(campo('r2_numeroEmpresa').origin).toBe('PERFIL');
  });
});
