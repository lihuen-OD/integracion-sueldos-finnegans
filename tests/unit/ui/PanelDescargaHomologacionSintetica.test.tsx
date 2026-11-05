// @vitest-environment jsdom
import { createHash } from 'node:crypto';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ downloadBytes: vi.fn() }));

vi.mock('../../../src/export/download', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../src/export/download')>();
  return { ...original, downloadBytes: mocks.downloadBytes };
});

import { PanelDescargaHomologacionSintetica } from '../../../src/ui/PanelDescargaHomologacionSintetica';
import * as orquestacion from '../../../src/ui/orquestacion';

afterEach(() => {
  cleanup();
  mocks.downloadBytes.mockReset();
  vi.restoreAllMocks();
});

describe('PanelDescargaHomologacionSintetica', () => {
  it('muestra vista previa y permite cancelar sin descargar', async () => {
    const usuario = userEvent.setup();
    render(<PanelDescargaHomologacionSintetica />);

    expect(screen.getByText(/No contienen los empleados ni los importes/)).toBeVisible();
    await usuario.click(screen.getByTestId('preparar-sintetico-bna'));
    expect(await screen.findByTestId('vista-previa-sintetica')).toBeVisible();
    expect(screen.getByTestId('sintetico-banco')).toHaveTextContent('Banco Nación · GT 200');
    expect(screen.getByTestId('sintetico-nombre')).toHaveTextContent(
      'PRUEBA_SINTETICA_BNA_GT200_NO_PRODUCTIVA.TXT',
    );
    expect(screen.getByTestId('sintetico-bytes')).toHaveTextContent('803');
    expect(screen.getByTestId('sintetico-sha256')).toHaveTextContent(
      'b72a7e942249a75298bb6041e96b7b4d6505775d22a21f23e600adff40b426de',
    );
    expect(mocks.downloadBytes).not.toHaveBeenCalled();

    await usuario.click(screen.getByTestId('cancelar-descarga-sintetica'));
    expect(screen.queryByTestId('vista-previa-sintetica')).not.toBeInTheDocument();
    expect(screen.getByTestId('diagnostico-sintetico')).toHaveTextContent('Descarga cancelada');
    expect(mocks.downloadBytes).not.toHaveBeenCalled();
  });

  it('invalida la vista previa anterior cuando se prepara el otro banco', async () => {
    const usuario = userEvent.setup();
    render(<PanelDescargaHomologacionSintetica />);

    await usuario.click(screen.getByTestId('preparar-sintetico-bna'));
    expect(await screen.findByText('PRUEBA_SINTETICA_BNA_GT200_NO_PRODUCTIVA.TXT')).toBeVisible();
    await usuario.click(screen.getByTestId('preparar-sintetico-patagonia'));
    expect(await screen.findByText('ACREXXXX.TXT')).toBeVisible();
    expect(
      screen.queryByText('PRUEBA_SINTETICA_BNA_GT200_NO_PRODUCTIVA.TXT'),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('sintetico-inspeccion')).toHaveTextContent('pagos=2');
  });

  it('exige confirmación y descarga los mismos bytes cuya huella volvió a comprobar', async () => {
    const usuario = userEvent.setup();
    render(<PanelDescargaHomologacionSintetica />);

    await usuario.click(screen.getByTestId('preparar-sintetico-patagonia'));
    expect(await screen.findByTestId('vista-previa-sintetica')).toBeVisible();
    expect(mocks.downloadBytes).not.toHaveBeenCalled();
    await usuario.click(screen.getByTestId('confirmar-descarga-sintetica'));

    await waitFor(() => {
      expect(mocks.downloadBytes).toHaveBeenCalledOnce();
    });
    const [bytes, nombre, mime] = mocks.downloadBytes.mock.calls[0] as [Uint8Array, string, string];
    expect(nombre).toBe('ACREXXXX.TXT');
    expect(mime).toBe('text/plain;charset=us-ascii');
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      '004140b216b76fc56b7a08ac3edde1524df8e7dd8f860ed7fbabed0ddd671a4d',
    );
    expect(screen.queryByTestId('vista-previa-sintetica')).not.toBeInTheDocument();
    expect(screen.getByTestId('diagnostico-sintetico')).toHaveTextContent(
      'Descarga sintética iniciada',
    );
  });

  it('rechaza la descarga si la recomposición difiere de la vista previa', async () => {
    const usuario = userEvent.setup();
    const prepararReal = orquestacion.prepararDescargaHomologacionSintetica;
    const preparada = await prepararReal('PATAGONIA', 'VALIDA');
    if (preparada.estado !== 'PREPARADA') throw new Error('Preparación sintética esperada');
    const bytesAlterados = preparada.bytes.slice();
    bytesAlterados[0] = (bytesAlterados[0] ?? 0) ^ 0xff;
    const alterada = { ...preparada, bytes: bytesAlterados };
    vi.spyOn(orquestacion, 'prepararDescargaHomologacionSintetica')
      .mockResolvedValueOnce(preparada)
      .mockResolvedValueOnce(alterada);
    render(<PanelDescargaHomologacionSintetica />);

    await usuario.click(screen.getByTestId('preparar-sintetico-patagonia'));
    expect(await screen.findByTestId('vista-previa-sintetica')).toBeVisible();
    await usuario.click(screen.getByTestId('confirmar-descarga-sintetica'));

    expect(await screen.findByTestId('diagnostico-sintetico')).toHaveTextContent(
      'La integridad cambió desde la vista previa',
    );
    expect(mocks.downloadBytes).not.toHaveBeenCalled();
  });
});
