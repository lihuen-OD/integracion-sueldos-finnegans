// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { produccionPatagoniaHabilitada } from '../../../src/banks/patagonia-b2';
import { App } from '../../../src/ui/App';
import {
  filaFinnegans,
  finnegansXlsx,
  personas,
  type FilaFinnegans,
} from '../../fixtures/synthetic/escenarios';
import { BANCO_NACION, BANCO_PATAGONIA } from '../../fixtures/synthetic/finnegansLike';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function archivo(filas: readonly FilaFinnegans[]): File {
  const bytes = finnegansXlsx(filas);
  const copia = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  copia.set(bytes);
  return new File([copia], 'finnegans_patagonia_sintetico.xlsx', { type: XLSX_MIME });
}

async function subirFinnegans(
  usuario: ReturnType<typeof userEvent.setup>,
  filas: readonly FilaFinnegans[],
) {
  await usuario.upload(
    screen.getByLabelText('Archivo de la liquidación', { exact: true }),
    archivo(filas),
  );
  await waitFor(() => {
    expect(screen.getByTestId('panel-tipo-liquidacion-patagonia')).toBeInTheDocument();
  });
}

afterEach(cleanup);

describe('App · tipo de liquidación Banco Patagonia C3', () => {
  it('agrupa solo filas Patagonia y permite seleccionar, corregir, compartir código y retirar', async () => {
    const usuario = userEvent.setup();
    const [una, dos, tres, cuatro] = personas(4, 20261109);
    if (una === undefined || dos === undefined || tres === undefined || cuatro === undefined) {
      throw new Error('personas esperadas');
    }
    render(<App />);
    await subirFinnegans(usuario, [
      filaFinnegans(una, { Banco: BANCO_PATAGONIA, Descripcion: 'JULIO Agrario' }),
      filaFinnegans(dos, { Banco: BANCO_NACION, Descripcion: 'JULIO Agrario' }),
      filaFinnegans(tres, { Banco: BANCO_PATAGONIA, Descripcion: 'JULIO Agrario' }),
      filaFinnegans(cuatro, { Banco: BANCO_PATAGONIA, Descripcion: 'AGOSTO Comercio ' }),
    ]);

    const panel = screen.getByTestId('panel-tipo-liquidacion-patagonia');
    const grupos = within(panel).getAllByTestId(/^descripcion-patagonia-/);
    expect(grupos).toHaveLength(2);
    expect(grupos[0]).toHaveTextContent('JULIO Agrario · 2 filas Patagonia');
    expect(grupos[1]).toHaveTextContent('AGOSTO Comercio · 1 fila Patagonia');
    expect(within(panel).getAllByText('Pendiente de selección.')).toHaveLength(2);

    const selectores = within(panel).getAllByLabelText('Concepto bancario');
    const [agrario, comercio] = selectores;
    if (agrario === undefined || comercio === undefined) throw new Error('selectores esperados');
    expect(agrario).toHaveValue('');
    expect(within(panel).queryByRole('option', { name: /005/ })).not.toBeInTheDocument();

    await usuario.selectOptions(agrario, '001');
    await usuario.selectOptions(comercio, '001');
    await usuario.click(
      within(panel).getByRole('button', { name: 'Aplicar tipos de liquidación Patagonia' }),
    );
    expect(within(panel).getByTestId('resultado-tipo-liquidacion-patagonia')).toHaveTextContent(
      '3 filas Patagonia con selección validada; 0 filas Patagonia pendientes.',
    );
    expect(within(panel).getByTestId('resultado-tipo-liquidacion-patagonia')).toHaveTextContent(
      'JULIO Agrario: 001 — SUELDO; 2 filas Patagonia',
    );
    expect(within(panel).getByTestId('resultado-tipo-liquidacion-patagonia')).toHaveTextContent(
      'AGOSTO Comercio : 001 — SUELDO; 1 fila Patagonia',
    );

    await usuario.selectOptions(agrario, '002');
    await usuario.selectOptions(comercio, '');
    await usuario.click(
      within(panel).getByRole('button', { name: 'Aplicar tipos de liquidación Patagonia' }),
    );
    expect(within(panel).getByTestId('resultado-tipo-liquidacion-patagonia')).toHaveTextContent(
      '2 filas Patagonia con selección validada; 1 fila Patagonia pendiente.',
    );
    expect(within(panel).getByTestId('resultado-tipo-liquidacion-patagonia')).toHaveTextContent(
      'JULIO Agrario: 002 — S.A.C.; 2 filas Patagonia',
    );
    expect(within(panel).getByText('Pendiente de selección.')).toBeInTheDocument();

    expect(produccionPatagoniaHabilitada()).toBe(false);
    expect(screen.queryByRole('button', { name: /TXT|archivo bancario/i })).not.toBeInTheDocument();
    expect(
      screen.getAllByRole('note').some((nota) => nota.textContent.includes('No apto para pagos')),
    ).toBe(true);
  });

  it('descarta selecciones al reimportar el mismo archivo y al reemplazarlo por otro', async () => {
    const usuario = userEvent.setup();
    const [una, dos] = personas(2, 20261110);
    if (una === undefined || dos === undefined) throw new Error('personas esperadas');
    const mismasFilas = [
      filaFinnegans(una, { Banco: BANCO_PATAGONIA, Descripcion: 'JULIO Directivos' }),
    ];
    render(<App />);
    await subirFinnegans(usuario, mismasFilas);

    let panel = screen.getByTestId('panel-tipo-liquidacion-patagonia');
    await usuario.selectOptions(within(panel).getByLabelText('Concepto bancario'), '003');
    await usuario.click(
      within(panel).getByRole('button', { name: 'Aplicar tipos de liquidación Patagonia' }),
    );
    expect(within(panel).getByTestId('resultado-tipo-liquidacion-patagonia')).toBeInTheDocument();

    await subirFinnegans(usuario, mismasFilas);
    await waitFor(() => {
      panel = screen.getByTestId('panel-tipo-liquidacion-patagonia');
      expect(within(panel).getByLabelText('Concepto bancario')).toHaveValue('');
      expect(
        within(panel).queryByTestId('resultado-tipo-liquidacion-patagonia'),
      ).not.toBeInTheDocument();
    });

    await usuario.selectOptions(within(panel).getByLabelText('Concepto bancario'), '004');
    await subirFinnegans(usuario, [
      filaFinnegans(dos, { Banco: BANCO_PATAGONIA, Descripcion: 'AGOSTO Liq Final' }),
    ]);
    await waitFor(() => {
      panel = screen.getByTestId('panel-tipo-liquidacion-patagonia');
      expect(within(panel).queryByText('JULIO Directivos')).not.toBeInTheDocument();
      expect(within(panel).getByText('AGOSTO Liq Final')).toBeInTheDocument();
      expect(within(panel).getByLabelText('Concepto bancario')).toHaveValue('');
    });
  });
});
