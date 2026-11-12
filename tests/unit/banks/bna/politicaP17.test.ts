// P-17: decisión técnica interna provisional. Estos casos usan identidades sintéticas,
// no cambian BNA-11 ni la compuerta productiva y no convierten A1 en política efectiva.
import { describe, expect, it } from 'vitest';
import {
  ISSUES_BNA,
  POLITICA_BNA_PRODUCTIVA,
  crearSpecBna,
  mapearBna,
  produccionBnaHabilitada,
  serializarBna,
  type ErrorMapeoBna,
  type PoliticaBna,
  type ResultadoMapeoBna,
} from '../../../../src/banks/bna';
import type { FileSpec } from '../../../../src/banks/fixed-width';
import {
  pagoSintetico,
  parametrosSinteticos,
  perfilSintetico,
  politicaSintetica,
} from './auxiliares';

function politicaTecnicaConP17(): PoliticaBna {
  return {
    ...politicaSintetica(),
    infoCriterio: POLITICA_BNA_PRODUCTIVA.infoCriterio,
    camposBeneficiario: POLITICA_BNA_PRODUCTIVA.camposBeneficiario,
  };
}

function valorMapeo(resultado: {
  readonly ok: boolean;
  readonly value?: ResultadoMapeoBna;
  readonly error?: readonly ErrorMapeoBna[];
}): ResultadoMapeoBna {
  if (!resultado.ok || resultado.value === undefined) {
    throw new Error(`mapeo rechazado: ${JSON.stringify(resultado.error)}`);
  }
  return resultado.value;
}

function codigos(resultado: {
  readonly ok: boolean;
  readonly error?: readonly ErrorMapeoBna[];
}): readonly string[] {
  return resultado.ok ? [] : (resultado.error ?? []).map((error) => error.codigo);
}

function campo(linea: string, spec: FileSpec, recordId: string, campoId: string): string {
  const registro = spec.records.find((candidato) => candidato.id === recordId);
  const definicion = registro?.fields.find((candidato) => candidato.id === campoId);
  if (definicion === undefined) throw new Error(`campo inexistente: ${campoId}`);
  return linea.slice(definicion.start - 1, definicion.end);
}

describe('POLITICA_BNA_PRODUCTIVA · P-17 provisional', () => {
  it('toma criterio y referencia explícitos y el CUIL validado de cada pago', () => {
    const parametros = parametrosSinteticos({
      infoCriterioEmpresa: 'CRITERIO CORRIDA',
      referenciaUnivoca: 'REF P17',
    });
    const pagos = [pagoSintetico(1), pagoSintetico(2)];
    const resultado = valorMapeo(
      mapearBna(perfilSintetico(), parametros, pagos, politicaTecnicaConP17()),
    );
    const r1 = resultado.entradas.find((entrada) => entrada.recordId === 'BNA_R1');
    const r2 = resultado.entradas.filter((entrada) => entrada.recordId === 'BNA_R2');

    expect(r1?.valores['r1_infoCriterioEmpresa']).toBe(parametros.infoCriterioEmpresa);
    expect(r2).toHaveLength(2);
    expect(r2.map((entrada) => entrada.valores['r2_identificacionBeneficiario'])).toEqual(
      pagos.map((pago) => String(pago.cuil)),
    );
    expect(r2.map((entrada) => entrada.valores['r2_referencia'])).toEqual([
      parametros.referenciaUnivoca,
      parametros.referenciaUnivoca,
    ]);
    expect(r2.map((entrada) => entrada.valores['r2_datosEmpresa'])).toEqual(['', '']);
  });

  it('no infiere ni completa valores de los parámetros', () => {
    const perfil = perfilSintetico();
    const pago = pagoSintetico(1);
    const parametrosVacios = parametrosSinteticos({ infoCriterioEmpresa: '' });

    expect(POLITICA_BNA_PRODUCTIVA.infoCriterio(perfil, parametrosVacios)).toEqual({
      estado: 'RESUELTO',
      valor: '',
    });
    expect(POLITICA_BNA_PRODUCTIVA.camposBeneficiario(pago, parametrosVacios)).toEqual({
      estado: 'RESUELTO',
      valor: { identificacionBeneficiario: String(pago.cuil), datosEmpresa: '' },
    });
  });

  it.each([
    ['criterio demasiado largo', { infoCriterioEmpresa: 'A'.repeat(21) }, 'LONGITUD_EXCEDIDA'],
    [
      'criterio con alfabeto inválido',
      { infoCriterioEmpresa: 'criterio' },
      'ALFABETO_BNA8_INVALIDO',
    ],
    ['referencia demasiado larga', { referenciaUnivoca: 'R'.repeat(16) }, 'LONGITUD_EXCEDIDA'],
    ['referencia con alfabeto inválido', { referenciaUnivoca: 'REF-17' }, 'ALFABETO_BNA8_INVALIDO'],
  ])('rechaza %s antes de serializar', (_caso, cambios, codigo) => {
    const resultado = mapearBna(
      perfilSintetico(),
      parametrosSinteticos(cambios),
      [pagoSintetico(1)],
      politicaTecnicaConP17(),
    );

    expect(resultado.ok).toBe(false);
    expect(codigos(resultado)).toContain(codigo);
    expect('value' in resultado).toBe(false);
  });

  it('serializa el padding A existente, incluidos 13 espacios para datos de empresa', () => {
    const parametros = parametrosSinteticos({
      infoCriterioEmpresa: 'CRITERIO EXPLICITO',
      referenciaUnivoca: 'REF CORRIDA 17',
      lineSeparator: '\n',
      trailingSeparator: false,
    });
    const pago = pagoSintetico(1);
    const archivo = serializarBna(perfilSintetico(), parametros, [pago], politicaTecnicaConP17());
    if (!archivo.ok) throw new Error(`serialización rechazada: ${JSON.stringify(archivo.error)}`);
    const spec = crearSpecBna(parametros);
    const [r1, r2] = new TextDecoder().decode(archivo.value.bytes).split('\n');
    if (r1 === undefined || r2 === undefined) throw new Error('registros BNA incompletos');

    expect(campo(r1, spec, 'BNA_R1', 'r1_infoCriterioEmpresa')).toBe(
      parametros.infoCriterioEmpresa.padEnd(20, ' '),
    );
    expect(campo(r2, spec, 'BNA_R2', 'r2_referencia')).toBe(
      parametros.referenciaUnivoca.padEnd(15, ' '),
    );
    expect(campo(r2, spec, 'BNA_R2', 'r2_identificacionBeneficiario')).toBe(
      String(pago.cuil).padEnd(22, ' '),
    );
    expect(campo(r2, spec, 'BNA_R2', 'r2_datosEmpresa')).toBe(' '.repeat(13));
  });

  it('mantiene BNA-11 pendiente y la generación productiva bloqueada', () => {
    expect(ISSUES_BNA['BNA-11'].estado).toBe('INTERPRETACION_PENDIENTE');
    expect(produccionBnaHabilitada()).toBe(false);
  });
});
