// Pruebas del formulario puro: compone los contratos v1/v2/v3 existentes sin agregar
// campos ni relajar validaciones. Los valores son sintéticos (D-042).
import { describe, expect, it } from 'vitest';
import { parseCbu } from '../../../src/domain/cbu';
import { parseCuitEmpresa } from '../../../src/domain/cuitEmpresa';
import { CATALOGO_BANCOS } from '../../../src/domain/destino';
import {
  construirConfiguracionEmpresa,
  datosConfiguracionDesdePerfil,
  datosConfiguracionVacios,
  describirAlcance,
  formatearCuit,
  type DatosConfiguracionEmpresa,
} from '../../../src/profile/empresaFormulario';
import type { CompanyProfileImportado } from '../../../src/profile/contrato';
import {
  createRandom,
  syntheticCbu,
  syntheticCuenta,
  syntheticCuil,
} from '../../fixtures/synthetic/identities';

const CUIT = (() => {
  const texto = syntheticCuil('30', 12_345_678);
  if (texto === null) throw new Error('CUIT sintético esperado');
  return texto;
})();

const CBU = syntheticCbu('011', '0001', syntheticCuenta(createRandom(99)));

function datos(parcial: Partial<DatosConfiguracionEmpresa> = {}): DatosConfiguracionEmpresa {
  return {
    ...datosConfiguracionVacios(),
    cuitEmpresa: CUIT,
    nombreEmpresa: 'Empresa sintética',
    ...parcial,
  };
}

describe('construirConfiguracionEmpresa', () => {
  it('con solo datos generales genera el contrato v1 sin bloque bancario', () => {
    const resultado = construirConfiguracionEmpresa(datos());
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.value.alcance).toBe('datos-comunes');
    expect(resultado.value.perfil.schemaVersion).toBe('1');
    expect(resultado.value.perfil.nombreEmpresa).toBe('Empresa sintética');
  });

  it('con datos de Banco Nación genera el contrato v2', () => {
    const resultado = construirConfiguracionEmpresa(
      datos({ bnaCbuEmpresa: CBU, bnaCodigoConvenio: '4455', bnaMoneda: '0' }),
    );
    expect(resultado.ok).toBe(true);
    if (!resultado.ok || resultado.value.perfil.schemaVersion !== '2') return;
    expect(resultado.value.alcance).toBe('banco-nacion');
    expect(resultado.value.perfil.bna.cbuEmpresa).toBe(CBU);
    expect(resultado.value.perfil.bna.moneda).toBe('0');
  });

  it('con datos de ambos bancos genera el contrato v3', () => {
    const resultado = construirConfiguracionEmpresa(
      datos({
        bnaCbuEmpresa: CBU,
        bnaCodigoConvenio: '12345678',
        bnaMoneda: '1',
        patagoniaNumeroEmpresa: '1234',
      }),
    );
    expect(resultado.ok).toBe(true);
    if (!resultado.ok || resultado.value.perfil.schemaVersion !== '3') return;
    expect(resultado.value.alcance).toBe('banco-nacion-patagonia');
    expect(resultado.value.perfil.patagonia.numeroEmpresa).toBe('1234');
  });

  it('no inventa datos: Patagonia exige completar Banco Nación', () => {
    const resultado = construirConfiguracionEmpresa(datos({ patagoniaNumeroEmpresa: '1234' }));
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.error.map((problema) => problema.campo)).toEqual([
      'bnaCbuEmpresa',
      'bnaCodigoConvenio',
      'bnaMoneda',
    ]);
  });

  it('rechaza un convenio de 5 dígitos y un CBU con verificación inválida', () => {
    const cbuInvalido = `${CBU.slice(0, 21)}${CBU.endsWith('9') ? '8' : '9'}`;
    const resultado = construirConfiguracionEmpresa(
      datos({ bnaCbuEmpresa: cbuInvalido, bnaCodigoConvenio: '12345', bnaMoneda: '0' }),
    );
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    const mensajes = resultado.error.map((problema) => problema.mensaje);
    expect(mensajes).toContain('El CBU no pasa la verificación. Revisá los 22 dígitos.');
    expect(mensajes).toContain('El código de convenio debe tener 4 u 8 dígitos.');
  });

  it('explica un CUIT incompleto', () => {
    const resultado = construirConfiguracionEmpresa(datos({ cuitEmpresa: '30' }));
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.error).toEqual([
      { campo: 'cuitEmpresa', mensaje: 'El CUIT debe tener 11 dígitos.' },
    ]);
  });
});

describe('datosConfiguracionDesdePerfil', () => {
  const cuit = parseCuitEmpresa(CUIT);
  const cbu = parseCbu(CBU);
  if (!cuit.ok || !cbu.ok) throw new Error('datos sintéticos inválidos');
  const perfil: CompanyProfileImportado = {
    schemaVersion: '3',
    cuitEmpresa: cuit.value,
    nombreEmpresa: 'Empresa sintética',
    catalogoBancos: [...CATALOGO_BANCOS],
    bna: { cbuEmpresa: cbu.value, codigoConvenio: '4455', moneda: '0' },
    patagonia: { numeroEmpresa: '1234' },
    mapeosLiquidacion: [],
  };

  it('vuelca los datos del contrato al formulario con el CUIT presentado', () => {
    const datosFormulario = datosConfiguracionDesdePerfil(perfil);
    expect(datosFormulario.cuitEmpresa).toBe(formatearCuit(perfil.cuitEmpresa));
    expect(datosFormulario.bnaCbuEmpresa).toBe(CBU);
    expect(datosFormulario.patagoniaNumeroEmpresa).toBe('1234');
    expect(describirAlcance(perfil)).toBe('Datos generales, Banco Nación y Banco Patagonia');
  });

  it('sin configuración devuelve todos los campos vacíos', () => {
    expect(datosConfiguracionDesdePerfil(null)).toEqual(datosConfiguracionVacios());
  });
});
