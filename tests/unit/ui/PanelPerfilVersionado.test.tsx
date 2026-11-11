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
import { formatearCuit } from '../../../src/profile/empresaFormulario';
import { plantillaPerfil } from '../../../src/profile/plantilla';
import {
  createRandom,
  syntheticCbu,
  syntheticCuenta,
  syntheticCuil,
} from '../../fixtures/synthetic/identities';

const CUIT_TEXTO = (() => {
  const texto = syntheticCuil('30', 23_456_789);
  if (texto === null) throw new Error('CUIT sintético esperado');
  return texto;
})();

function cuitEmpresa() {
  const resultado = parseCuitEmpresa(CUIT_TEXTO);
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
  return new File([JSON.stringify(perfil)], `configuracion-${perfil.schemaVersion}.json`, {
    type: 'application/json',
  });
}

async function completarDatosGenerales(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.type(screen.getByLabelText('CUIT de la empresa *'), CUIT_TEXTO);
  await usuario.type(screen.getByLabelText(/Nombre o razón social/), 'Empresa sintética');
}

async function completarBna(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.type(screen.getByLabelText('CBU de la empresa en Banco Nación'), cbuEmpresa());
  await usuario.type(screen.getByLabelText('Código de convenio de Banco Nación'), '4455');
  await usuario.selectOptions(screen.getByLabelText('Moneda de la cuenta de Banco Nación'), '0');
}

afterEach(() => {
  cleanup();
  mocks.descargarPerfilVersionado.mockReset();
});

describe('Configuración de la empresa · formulario y archivo', () => {
  it('arma una configuración de datos generales y la aplica al guardar', async () => {
    const usuario = userEvent.setup();
    const cargarPerfil = vi.fn();
    render(<PanelPerfil perfil={null} cargarPerfil={cargarPerfil} />);

    await completarDatosGenerales(usuario);
    await usuario.click(screen.getByTestId('boton-guardar-configuracion'));

    expect(cargarPerfil).toHaveBeenCalledTimes(1);
    const enviado = cargarPerfil.mock.calls[0]?.[0] as CompanyProfileImportado;
    expect(enviado.schemaVersion).toBe('1');
    expect(enviado.nombreEmpresa).toBe('Empresa sintética');
    expect(screen.getByTestId('perfil-ok')).toHaveTextContent('Configuración guardada');
    expect(screen.getByTestId('perfil-ok')).toHaveTextContent('datos generales');
  });

  it('arma Banco Nación cuando esos datos están completos', async () => {
    const usuario = userEvent.setup();
    const cargarPerfil = vi.fn();
    render(<PanelPerfil perfil={null} cargarPerfil={cargarPerfil} />);

    await completarDatosGenerales(usuario);
    await completarBna(usuario);
    await usuario.click(screen.getByTestId('boton-guardar-configuracion'));

    const enviado = cargarPerfil.mock.calls[0]?.[0] as CompanyProfileImportado;
    expect(enviado.schemaVersion).toBe('2');
    if (enviado.schemaVersion === '2') {
      expect(enviado.bna.codigoConvenio).toBe('4455');
      expect(enviado.bna.moneda).toBe('0');
    }
    expect(screen.getByTestId('perfil-ok')).toHaveTextContent('Banco Nación');
  });

  it('agrega Patagonia solo cuando se informa su número de empresa', async () => {
    const usuario = userEvent.setup();
    const cargarPerfil = vi.fn();
    render(<PanelPerfil perfil={null} cargarPerfil={cargarPerfil} />);

    await completarDatosGenerales(usuario);
    await completarBna(usuario);
    await usuario.type(screen.getByLabelText('Número de empresa de Banco Patagonia'), '1234');
    await usuario.click(screen.getByTestId('boton-guardar-configuracion'));

    const enviado = cargarPerfil.mock.calls[0]?.[0] as CompanyProfileImportado;
    expect(enviado.schemaVersion).toBe('3');
    if (enviado.schemaVersion === '3') {
      expect(enviado.patagonia.numeroEmpresa).toBe('1234');
    }
    expect(screen.getByTestId('perfil-ok')).toHaveTextContent('Banco Patagonia');
  });

  it('explica los datos faltantes y no aplica una configuración incompleta', async () => {
    const usuario = userEvent.setup();
    const cargarPerfil = vi.fn();
    render(<PanelPerfil perfil={null} cargarPerfil={cargarPerfil} />);

    await usuario.type(screen.getByLabelText('CUIT de la empresa *'), '30');
    await usuario.click(screen.getByTestId('boton-guardar-configuracion'));

    expect(cargarPerfil).not.toHaveBeenCalled();
    expect(screen.getByTestId('error-perfil')).toHaveTextContent(
      'Revisá los datos marcados para poder guardar la configuración.',
    );
    expect(screen.getByText('El CUIT debe tener 11 dígitos.')).toBeInTheDocument();
  });

  it('pide completar Banco Nación si se intenta configurar Patagonia sola', async () => {
    const usuario = userEvent.setup();
    const cargarPerfil = vi.fn();
    render(<PanelPerfil perfil={null} cargarPerfil={cargarPerfil} />);

    await completarDatosGenerales(usuario);
    await usuario.type(screen.getByLabelText('Número de empresa de Banco Patagonia'), '1234');
    await usuario.click(screen.getByTestId('boton-guardar-configuracion'));

    expect(cargarPerfil).not.toHaveBeenCalled();
    expect(
      screen.getByText('Ingresá el CBU de la cuenta de la empresa en Banco Nación.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Ingresá el código de convenio que asigna Banco Nación.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Elegí la moneda de la cuenta de Banco Nación.')).toBeInTheDocument();
  });

  it.each([
    ['1', v1],
    ['2', v2],
    ['3', v3],
  ] as const)(
    'importa y exporta una configuración de formato %s sin cambiar su contenido',
    async (version, perfil) => {
      const usuario = userEvent.setup();
      const cargarPerfil = vi.fn();
      const vista = render(<PanelPerfil perfil={null} cargarPerfil={cargarPerfil} />);

      await usuario.upload(
        screen.getByLabelText('¿Ya tenés una configuración guardada?'),
        archivo(perfil),
      );
      expect(cargarPerfil).toHaveBeenCalledWith(perfil);
      expect(screen.getByTestId('perfil-ok')).toHaveTextContent('Configuración importada');
      expect(screen.getByTestId('perfil-ok')).toHaveTextContent(
        version === '3' ? 'Banco Patagonia' : version === '2' ? 'Banco Nación' : 'Datos generales',
      );

      vista.rerender(<PanelPerfil perfil={perfil} cargarPerfil={cargarPerfil} />);
      expect(screen.getByTestId('version-perfil')).toHaveTextContent(
        `Formato de configuración: ${version}`,
      );
      await usuario.click(screen.getByTestId('boton-exportar-configuracion'));
      expect(mocks.descargarPerfilVersionado).toHaveBeenCalledWith(perfil, 'PERFIL_EMPRESA.json');
    },
  );

  it('rechaza un archivo desconocido con un mensaje operativo y deja el detalle plegado', async () => {
    const usuario = userEvent.setup();
    const cargarPerfil = vi.fn();
    render(<PanelPerfil perfil={null} cargarPerfil={cargarPerfil} />);
    const desconocido = { ...v3, schemaVersion: '4' };

    await usuario.upload(
      screen.getByLabelText('¿Ya tenés una configuración guardada?'),
      new File([JSON.stringify(desconocido)], 'configuracion.json', {
        type: 'application/json',
      }),
    );
    expect(cargarPerfil).not.toHaveBeenCalled();
    expect(screen.getByTestId('error-perfil')).toHaveTextContent(
      'No pudimos leer esa configuración.',
    );
    expect(screen.getByTestId('error-perfil')).toHaveTextContent('SCHEMA_VERSION_INCOMPATIBLE');
  });

  it('muestra en el formulario la configuración ya cargada', () => {
    render(<PanelPerfil perfil={v3} cargarPerfil={vi.fn()} />);

    expect(screen.getByLabelText('CUIT de la empresa *')).toHaveValue(formatearCuit(cuitEmpresa()));
    expect(screen.getByLabelText(/Nombre o razón social/)).toHaveValue('EMPRESA SINTÉTICA V3');
    expect(screen.getByLabelText('Código de convenio de Banco Nación')).toHaveValue('4455');
    expect(screen.getByLabelText('Moneda de la cuenta de Banco Nación')).toHaveValue('1');
    expect(screen.getByLabelText('Número de empresa de Banco Patagonia')).toHaveValue('1234');
  });
});
