// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ErrorConciliacionCorrida } from '../../../src/ui/orquestacion';
import type { Result } from '../../../src/shared/result';
import type { ResultadoConciliacion } from '../../../src/reconciliation';

const mocks = vi.hoisted(() => ({ conciliarCorrida: vi.fn() }));

vi.mock('../../../src/ui/orquestacion', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../src/ui/orquestacion')>();
  return { ...original, conciliarCorrida: mocks.conciliarCorrida };
});

import { App } from '../../../src/ui/App';
import {
  filaFinnegans,
  finnegansXlsx,
  maestroXlsx,
  personas,
  registroPatagonia,
} from '../../fixtures/synthetic/escenarios';
import { BANCO_PATAGONIA } from '../../fixtures/synthetic/finnegansLike';
import { createRandom } from '../../fixtures/synthetic/identities';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function archivo(bytes: Uint8Array, nombre: string): File {
  const copia = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  copia.set(bytes);
  return new File([copia], nombre, { type: XLSX_MIME });
}

function diferida<T>() {
  let resolver!: (valor: T) => void;
  const promise = new Promise<T>((resolve) => {
    resolver = resolve;
  });
  return { promise, resolver };
}

type Respuesta = Result<ResultadoConciliacion, ErrorConciliacionCorrida>;

async function cargarCorrida(usuario: ReturnType<typeof userEvent.setup>, descripcion: string) {
  const [persona] = personas(1, 20261114);
  if (persona === undefined) throw new Error('persona esperada');
  await usuario.upload(
    screen.getByLabelText('Archivo de la liquidación', { exact: true }),
    archivo(
      finnegansXlsx([filaFinnegans(persona, { Banco: BANCO_PATAGONIA, Descripcion: descripcion })]),
      'finnegans.xlsx',
    ),
  );
  await usuario.upload(
    screen.getByLabelText('Archivo del maestro', { exact: true }),
    archivo(maestroXlsx([registroPatagonia(persona, createRandom(7))]), 'maestro.xlsx'),
  );
  await waitFor(() => expect(screen.getByTestId('boton-conciliar')).toBeEnabled());
}

afterEach(() => {
  cleanup();
  mocks.conciliarCorrida.mockReset();
});

describe('App · protección contra conciliaciones asíncronas obsoletas', () => {
  it('una selección nueva invalida la conciliación que estaba en curso', async () => {
    const usuario = userEvent.setup();
    const pendiente = diferida<Respuesta>();
    mocks.conciliarCorrida.mockReturnValueOnce(pendiente.promise);
    render(<App />);
    await cargarCorrida(usuario, 'JULIO Agrario');

    await usuario.click(screen.getByTestId('boton-conciliar'));
    const panel = screen.getByTestId('panel-tipo-liquidacion-patagonia');
    await usuario.selectOptions(within(panel).getByLabelText('Concepto bancario'), '001');

    await act(() => {
      pendiente.resolver({ ok: false, error: 'FINNEGANS_AUSENTE' });
      return pendiente.promise;
    });
    expect(screen.queryByTestId('aviso-orquesta')).not.toBeInTheDocument();
    expect(screen.queryByTestId('panel-resumen')).not.toBeInTheDocument();
  });

  it.each([
    ['corrección', '002'],
    ['retiro', ''],
  ])('una %s de selección invalida la conciliación que estaba en curso', async (_, codigo) => {
    const usuario = userEvent.setup();
    const pendiente = diferida<Respuesta>();
    mocks.conciliarCorrida.mockReturnValueOnce(pendiente.promise);
    render(<App />);
    await cargarCorrida(usuario, 'JULIO Agrario');

    const panel = screen.getByTestId('panel-tipo-liquidacion-patagonia');
    await usuario.selectOptions(within(panel).getByLabelText('Concepto bancario'), '001');
    await usuario.click(
      within(panel).getByRole('button', { name: 'Aplicar tipos de liquidación Patagonia' }),
    );
    await usuario.click(screen.getByTestId('boton-conciliar'));
    await usuario.selectOptions(within(panel).getByLabelText('Concepto bancario'), codigo);

    await act(() => {
      pendiente.resolver({ ok: false, error: 'FINNEGANS_AUSENTE' });
      return pendiente.promise;
    });
    expect(screen.queryByTestId('aviso-orquesta')).not.toBeInTheDocument();
    expect(screen.queryByTestId('panel-resumen')).not.toBeInTheDocument();
  });

  it('una importación nueva invalida la conciliación anterior', async () => {
    const usuario = userEvent.setup();
    const pendiente = diferida<Respuesta>();
    mocks.conciliarCorrida.mockReturnValueOnce(pendiente.promise);
    render(<App />);
    await cargarCorrida(usuario, 'CORRIDA ANTERIOR');
    await usuario.click(screen.getByTestId('boton-conciliar'));

    const [otra] = personas(1, 20261115);
    if (otra === undefined) throw new Error('persona esperada');
    await usuario.upload(
      screen.getByLabelText('Archivo de la liquidación', { exact: true }),
      archivo(
        finnegansXlsx([
          filaFinnegans(otra, { Banco: BANCO_PATAGONIA, Descripcion: 'CORRIDA NUEVA' }),
        ]),
        'finnegans-nuevo.xlsx',
      ),
    );
    await waitFor(() =>
      expect(screen.getByTestId('panel-tipo-liquidacion-patagonia')).toHaveTextContent(
        'CORRIDA NUEVA',
      ),
    );
    await act(() => {
      pendiente.resolver({ ok: false, error: 'FINNEGANS_AUSENTE' });
      return pendiente.promise;
    });
    expect(screen.queryByTestId('aviso-orquesta')).not.toBeInTheDocument();
  });

  it('si empieza otra conciliación, sólo la más reciente puede publicar su resultado', async () => {
    const usuario = userEvent.setup();
    const primera = diferida<Respuesta>();
    const segunda = diferida<Respuesta>();
    mocks.conciliarCorrida
      .mockReturnValueOnce(primera.promise)
      .mockReturnValueOnce(segunda.promise);
    render(<App />);
    await cargarCorrida(usuario, 'JULIO Comercio');

    await usuario.click(screen.getByTestId('boton-conciliar'));
    await usuario.click(screen.getByTestId('boton-conciliar'));
    await act(() => {
      segunda.resolver({ ok: false, error: 'MAESTRO_AUSENTE' });
      return segunda.promise;
    });
    expect(screen.getByTestId('aviso-orquesta')).toHaveTextContent(
      'Todavía falta cargar el maestro de empleados.',
    );

    await act(() => {
      primera.resolver({ ok: false, error: 'FINNEGANS_AUSENTE' });
      return primera.promise;
    });
    expect(screen.getByTestId('aviso-orquesta')).toHaveTextContent(
      'Todavía falta cargar el maestro de empleados.',
    );
  });
});
