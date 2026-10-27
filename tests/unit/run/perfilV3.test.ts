// D-089 (CP-F7-0-B): la fachada BNA acepta CompanyProfileV2 y CompanyProfileV3
// usando exclusivamente la sección `bna` común. v3 no se convierte ni se migra, y la
// sección Patagonia no influye en el PerfilBna derivado. BNA-1 sigue bloqueando la
// generación productiva.
import { describe, expect, it } from 'vitest';
import type { CompanyProfileV3 } from '../../../src/profile';
import {
  evaluarGeneracionBna,
  generarBna,
  perfilBnaDesdePerfil,
} from '../../../src/run/generacionBna';
import {
  conciliacionGoldenBna,
  parametrosGoldenBna,
  perfilV2Golden,
} from '../../fixtures/synthetic/goldenBna';

function perfilV3(numeroEmpresa = '1234'): CompanyProfileV3 {
  const v2 = perfilV2Golden();
  return {
    schemaVersion: '3',
    cuitEmpresa: v2.cuitEmpresa,
    nombreEmpresa: v2.nombreEmpresa,
    catalogoBancos: v2.catalogoBancos,
    bna: v2.bna,
    patagonia: { numeroEmpresa },
    mapeosLiquidacion: [],
  };
}

describe('perfil v3 en la evaluación BNA', () => {
  it('atraviesa la compuerta de versión: solo faltan parámetros', () => {
    const resultado = evaluarGeneracionBna({
      perfil: perfilV3(),
      conciliacion: null,
      parametros: null,
    });
    expect(resultado.estado).toBe('CONFIGURACION_INCOMPLETA');
    if (resultado.estado === 'CONFIGURACION_INCOMPLETA') {
      expect(resultado.motivos).toEqual(['PARAMETROS_AUSENTES']);
      expect(resultado.perfilVersion).toBe('3');
      expect('bytes' in resultado).toBe(false);
    }
  });

  it('v2 y v3 equivalentes producen exactamente el mismo PerfilBna', () => {
    const desdeV2 = perfilBnaDesdePerfil(perfilV2Golden());
    const desdeV3 = perfilBnaDesdePerfil(perfilV3());
    expect(desdeV3).toEqual(desdeV2);
    expect(Object.keys(desdeV3).sort()).toEqual([
      'cbuEmpresa',
      'codigoConvenio',
      'cuitEmpresa',
      'moneda',
    ]);
  });

  it('patagonia.numeroEmpresa no influye en el PerfilBna derivado', () => {
    const primero = perfilV3('1');
    const segundo = perfilV3('9999');
    expect(primero.patagonia.numeroEmpresa).not.toBe(segundo.patagonia.numeroEmpresa);
    expect(perfilBnaDesdePerfil(primero)).toEqual(perfilBnaDesdePerfil(segundo));
  });

  it('no transforma el perfil v3 recibido', () => {
    const perfil = perfilV3('4321');
    evaluarGeneracionBna({
      perfil,
      conciliacion: conciliacionGoldenBna(),
      parametros: parametrosGoldenBna(),
    });
    expect(perfil.schemaVersion).toBe('3');
    expect(perfil.patagonia.numeroEmpresa).toBe('4321');
  });

  it('aceptar v3 no habilita la generación: BNA-1 sigue bloqueando', () => {
    const resultado = generarBna({
      perfil: perfilV3(),
      conciliacion: conciliacionGoldenBna(),
      parametros: parametrosGoldenBna(),
    });
    expect(resultado.estado).toBe('CONTRATO_BNA_BLOQUEADO');
    if (resultado.estado === 'CONTRATO_BNA_BLOQUEADO') {
      expect(resultado.referencias).toContain('BNA-1');
      expect(resultado.bloqueos).toEqual([
        { tipo: 'campo', registroId: 'BNA_R2', campoId: 'r2_tipoDocumento' },
      ]);
    }
    expect('bytes' in resultado).toBe(false);
  });
});
