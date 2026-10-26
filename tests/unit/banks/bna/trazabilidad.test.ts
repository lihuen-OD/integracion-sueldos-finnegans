// Trazabilidad contractual BNA (CP-F5-A): origen, documento, páginas e issues por campo.
import { describe, expect, it } from 'vitest';
import { DOCS_BANCARIOS, ORIGENES_BANCARIOS } from '../../../../src/banks/trazabilidad';
import { IDS_ISSUE_BNA, REGISTROS_BNA, type BnaIssueId } from '../../../../src/banks/bna';

const ISSUES_ESPERADOS: Readonly<Record<string, readonly BnaIssueId[]>> = {
  r1_sucursalEmpresa: ['BNA-6'],
  r1_fechaCompensacion: ['BNA-7'],
  r1_infoCriterioEmpresa: ['BNA-11'],
  r1_codigoConvenio: ['BNA-5'],
  r2_entidad: ['BNA-6'],
  r2_sucursal: ['BNA-6'],
  r2_bloque2Cuenta: ['BNA-2'],
  r2_identificacionBeneficiario: ['BNA-11'],
  r2_tipoDocumento: ['BNA-1'],
};

const CAMPOS = REGISTROS_BNA.flatMap((registro) => registro.fields);

describe('trazabilidad BNA', () => {
  it('el catálogo bancario es el documentado y no incluye documentos productivos nuevos', () => {
    expect(DOCS_BANCARIOS).toEqual(['BNA', 'PAT_DR', 'PAT_XL']);
    expect(ORIGENES_BANCARIOS).toEqual([
      'FINNEGANS',
      'MAESTRO',
      'PERFIL',
      'ENVIO',
      'DERIVADO',
      'FIJO',
    ]);
  });

  it('cada campo tiene origen válido, fuente BNA y al menos una página', () => {
    for (const campo of CAMPOS) {
      expect(ORIGENES_BANCARIOS).toContain(campo.origin);
      expect(campo.source.doc).toBe('BNA');
      expect(campo.source.paginas.length).toBeGreaterThan(0);
      for (const pagina of campo.source.paginas) {
        expect(Number.isInteger(pagina) && pagina >= 1 && pagina <= 16).toBe(true);
      }
    }
  });

  it('los issues por campo son exactamente los documentados, sin inventar otros', () => {
    for (const campo of CAMPOS) {
      expect(campo.issues ?? []).toEqual(ISSUES_ESPERADOS[campo.id] ?? []);
    }
  });

  it('todos los issues conocidos están en el registro contractual', () => {
    for (const campo of CAMPOS) {
      for (const issue of campo.issues ?? []) {
        expect(IDS_ISSUE_BNA).toContain(issue);
      }
    }
  });
});
