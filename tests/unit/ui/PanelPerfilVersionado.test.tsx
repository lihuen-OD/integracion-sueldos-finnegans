// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ descargarPerfilVersionado: vi.fn() }));

vi.mock('../../../src/profile/archivo', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../src/profile/archivo')>();
  return { ...original, descargarPerfilVersionado: mocks.descargarPerfilVersionado };
});

import { PanelPerfil } from '../../../src/ui/PanelPerfil';
import { parseCbu } from '../../../src/domain/cbu';
import { parseCuitEmpresa } from '../../../src/domain/cuitEmpresa';
import { CATALOGO_BANCOS } from '../../../src/domain/destino';
import type { CompanyProfileImportado } from '../../../src/profile/contrato';
import { plantillaPerfil } from '../../../src/profile/plantilla';
import {
  createRandom,
  syntheticCbu,
  syntheticCuenta,
  syntheticCuil,
} from '../../fixtures/synthetic/identities';

function cuitEmpresa() {
  const texto = syntheticCuil('30', 23_456_789);
  if (texto === null) throw new Error('CUIT sintético esperado');
  const resultado = parseCuitEmpresa(texto);
  if (!resultado.ok) throw new Error('CUIT sintético inválido');
  return resultado.value;
}

function cbuEmpresa() {
  const texto = syntheticCbu('011', '0001', syntheticCuenta(createRandom(808)));
  const resultado = parseCbu(texto);
  if (!resultado.ok) throw new Error('CBU sintético inválido');
  return resultado.value;
}

const v1: CompanyProfileImportado = {
  ...plantillaPerfil(cuitEmpresa()),
  nombreEmpresa: 'EMPRESA SINTÉTICA V1',
};

const v2: CompanyProfileImportado = {
  schemaVersion: '2',
  cuitEmpresa: cuitEmpresa(),
  nombreEmpresa: 'EMPRESA SINTÉTICA V2',
  catalogoBancos: [...CATALOGO_BANCOS],
  bna: { cbuEmpresa: cbuEmpresa(), codigoConvenio: '4455', moneda: '0' },
  mapeosLiquidacion: [],
};

const v3: CompanyProfileImportado = {
  schemaVersion: '3',
  cuitEmpresa: cuitEmpresa(),
  nombreEmpresa: 'EMPRESA SINTÉTICA V3',
  catalogoBancos: [...CATALOGO_BANCOS],
  bna: { cbuEmpresa: cbuEmpresa(), codigoConvenio: '4455', moneda: '1' },
  patagonia: { numeroEmpresa: '1234' },
  mapeosLiquidacion: [],
};

function archivo(perfil: CompanyProfileImportado): File {
  return new File([JSON.stringify(perfil)], `perfil-v${perfil.schemaVersion}.json`, {
    type: 'application/json',
  });
}

afterEach(() => {
  cleanup();
  mocks.descargarPerfilVersionado.mockReset();
});

describe('PanelPerfil · contratos versionados', () => {
  it.each([
    ['1', v1],
    ['2', v2],
    ['3', v3],
  ] as const)('importa y exporta v%s sin cambiar la versión declarada', async (version, perfil) => {
    const usuario = userEvent.setup();
    const cargarPerfil = vi.fn();
    const vista = render(<PanelPerfil perfil={null} cargarPerfil={cargarPerfil} />);

    await usuario.upload(screen.getByLabelText('Archivo del perfil (JSON)'), archivo(perfil));
    expect(cargarPerfil).toHaveBeenCalledWith(perfil);
    expect(screen.getByTestId('perfil-ok')).toHaveTextContent(`Perfil de empresa v${version}`);

    vista.rerender(<PanelPerfil perfil={perfil} cargarPerfil={cargarPerfil} />);
    expect(screen.getByTestId('version-perfil')).toHaveTextContent(
      `Versión del perfil: ${version}`,
    );
    await usuario.click(
      screen.getByRole('button', { name: 'Descargar perfil conservando su versión (JSON)' }),
    );
    expect(mocks.descargarPerfilVersionado).toHaveBeenCalledWith(perfil, 'PERFIL_EMPRESA.json');
  });

  it('rechaza una versión desconocida sin convertirla a un contrato conocido', async () => {
    const usuario = userEvent.setup();
    const cargarPerfil = vi.fn();
    render(<PanelPerfil perfil={null} cargarPerfil={cargarPerfil} />);
    const desconocido = { ...v3, schemaVersion: '4' };

    await usuario.upload(
      screen.getByLabelText('Archivo del perfil (JSON)'),
      new File([JSON.stringify(desconocido)], 'perfil-v4.json', { type: 'application/json' }),
    );
    expect(cargarPerfil).not.toHaveBeenCalled();
    expect(screen.getByTestId('error-perfil')).toHaveTextContent('SCHEMA_VERSION_INCOMPATIBLE');
  });
});
