// La fachada BNA puede representar un perfil v3 sin consumirlo: solo informa su versión
// en CONFIGURACION_INCOMPLETA. BNA sigue exigiendo su bloque `bna` (D-079, D-087).
import { describe, expect, it } from 'vitest';
import type { CompanyProfileV3 } from '../../../src/profile';
import { evaluarGeneracionBna } from '../../../src/run/generacionBna';
import { perfilV2Golden } from '../../fixtures/synthetic/goldenBna';

function perfilV3(): CompanyProfileV3 {
  const v2 = perfilV2Golden();
  return {
    schemaVersion: '3',
    cuitEmpresa: v2.cuitEmpresa,
    nombreEmpresa: v2.nombreEmpresa,
    catalogoBancos: v2.catalogoBancos,
    bna: v2.bna,
    patagonia: { numeroEmpresa: '1234' },
    mapeosLiquidacion: [],
  };
}

describe('perfil v3 en la evaluación BNA', () => {
  it('atraviesa los tipos y reporta perfilVersion "3" cuando la configuración está incompleta', () => {
    const resultado = evaluarGeneracionBna({
      perfil: perfilV3(),
      conciliacion: null,
      parametros: null,
    });
    expect(resultado.estado).toBe('CONFIGURACION_INCOMPLETA');
    if (resultado.estado === 'CONFIGURACION_INCOMPLETA') {
      expect(resultado.perfilVersion).toBe('3');
      expect('bytes' in resultado).toBe(false);
    }
  });
});
