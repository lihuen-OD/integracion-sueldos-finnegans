// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../../../src/ui/App';
import {
  filaFinnegans,
  finnegansXlsx,
  personas,
  type FilaFinnegans,
} from '../../fixtures/synthetic/escenarios';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function archivo(bytes: Uint8Array): File {
  const copia = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  copia.set(bytes);
  return new File([copia], 'finnegans_sintetico.xlsx', { type: XLSX_MIME });
}

async function subirFinnegans(
  usuario: ReturnType<typeof userEvent.setup>,
  filas: readonly FilaFinnegans[],
) {
  await usuario.upload(
    screen.getByLabelText('Archivo de la liquidación', { exact: true }),
    archivo(finnegansXlsx(filas)),
  );
  await waitFor(() => {
    expect(screen.getByTestId('panel-clasificacion-liquidaciones')).toBeInTheDocument();
  });
}

afterEach(cleanup);

describe('App · clasificación explícita de la corrida', () => {
  it('agrupa descripciones, permite categorías compartidas, corrección y retiro', async () => {
    const usuario = userEvent.setup();
    const [una, dos, tres] = personas(3, 20261104);
    if (una === undefined || dos === undefined || tres === undefined) {
      throw new Error('personas esperadas');
    }
    render(<App />);
    await subirFinnegans(usuario, [
      filaFinnegans(una, { Descripcion: 'JULIO Agrario' }),
      filaFinnegans(dos, { Descripcion: 'JULIO Agrario' }),
      filaFinnegans(tres, { Descripcion: 'AGOSTO Comercio' }),
    ]);

    const filas = screen.getAllByTestId(/^descripcion-liquidacion-/);
    expect(filas).toHaveLength(2);
    expect(filas[0]).toHaveTextContent('JULIO Agrario · 2 líneas');
    expect(filas[1]).toHaveTextContent('AGOSTO Comercio · 1 línea');

    const checks = screen.getAllByLabelText('Clasificar esta descripción');
    const periodos = screen.getAllByLabelText('Período explícito');
    const tipos = screen.getAllByLabelText('Clasificación interna explícita');
    const [checkJulio, checkAgosto] = checks;
    const [periodoJulio, periodoAgosto] = periodos;
    const [tipoJulio, tipoAgosto] = tipos;
    if (
      checkJulio === undefined ||
      checkAgosto === undefined ||
      periodoJulio === undefined ||
      periodoAgosto === undefined ||
      tipoJulio === undefined ||
      tipoAgosto === undefined
    ) {
      throw new Error('controles de clasificación esperados');
    }
    await usuario.click(checkJulio);
    await usuario.click(checkAgosto);
    await usuario.type(periodoJulio, '2026-07');
    await usuario.type(periodoAgosto, '2026-08');
    await usuario.type(tipoJulio, 'MENSUAL');
    await usuario.type(tipoAgosto, 'MENSUAL');
    await usuario.click(screen.getByRole('button', { name: 'Aplicar clasificación explícita' }));

    await waitFor(() => {
      expect(screen.getByTestId('resultado-clasificacion')).toHaveTextContent(
        '3 líneas clasificadas; 0 líneas permanecen pendientes.',
      );
    });
    expect(screen.getByTestId('resultado-clasificacion')).toHaveTextContent(
      'JULIO Agrario: 2 líneas afectadas',
    );
    expect(screen.getByTestId('resultado-clasificacion')).toHaveTextContent(
      'AGOSTO Comercio: 1 línea afectada',
    );

    await usuario.clear(periodoJulio);
    await usuario.type(periodoJulio, '2026-09');
    await usuario.clear(tipoJulio);
    await usuario.type(tipoJulio, 'RECTIFICATIVA');
    await usuario.click(checkAgosto);
    await usuario.click(screen.getByRole('button', { name: 'Aplicar clasificación explícita' }));

    await waitFor(() => {
      expect(screen.getByTestId('resultado-clasificacion')).toHaveTextContent(
        '2 líneas clasificadas; 1 línea permanece pendiente.',
      );
    });
    expect(screen.getByTestId('resultado-clasificacion')).not.toHaveTextContent(
      'AGOSTO Comercio: 1 línea afectada',
    );
    expect(
      within(screen.getByTestId('panel-clasificacion-liquidaciones')).queryAllByRole('option'),
    ).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /TXT|archivo bancario/i })).not.toBeInTheDocument();
    expect(screen.getByText('No apto para pagos.')).toBeInTheDocument();
  });

  it('muestra errores y una importación nueva descarta selecciones y borradores anteriores', async () => {
    const usuario = userEvent.setup();
    const [una, dos] = personas(2, 20261105);
    if (una === undefined || dos === undefined) {
      throw new Error('personas esperadas');
    }
    render(<App />);
    await subirFinnegans(usuario, [filaFinnegans(una, { Descripcion: 'CORRIDA ANTERIOR' })]);

    await usuario.click(screen.getByLabelText('Clasificar esta descripción'));
    await usuario.click(screen.getByRole('button', { name: 'Aplicar clasificación explícita' }));
    expect(screen.getByRole('alert')).toHaveTextContent('requiere periodo');
    expect(screen.getByRole('alert')).toHaveTextContent('requiere tipoLiquidacionNormalizado');

    await usuario.type(screen.getByLabelText('Período explícito'), '2026-07');
    await usuario.type(screen.getByLabelText('Clasificación interna explícita'), 'MENSUAL');
    await usuario.click(screen.getByRole('button', { name: 'Aplicar clasificación explícita' }));
    await waitFor(() => {
      expect(screen.getByTestId('resultado-clasificacion')).toHaveTextContent(
        '1 línea clasificada',
      );
    });

    await subirFinnegans(usuario, [filaFinnegans(dos, { Descripcion: 'CORRIDA NUEVA' })]);
    await waitFor(() => {
      expect(screen.getByTestId('panel-clasificacion-liquidaciones')).toHaveTextContent(
        'CORRIDA NUEVA',
      );
    });
    const panel = screen.getByTestId('panel-clasificacion-liquidaciones');
    expect(within(panel).queryAllByText('CORRIDA ANTERIOR')).toHaveLength(0);
    expect(within(panel).getByText('CORRIDA NUEVA')).toBeInTheDocument();
    expect(within(panel).getByLabelText('Clasificar esta descripción')).not.toBeChecked();
    expect(within(panel).getByLabelText('Período explícito')).toBeDisabled();
    expect(within(panel).getByLabelText('Período explícito')).toHaveValue('');
    expect(within(panel).getByLabelText('Clasificación interna explícita')).toHaveValue('');
    expect(within(panel).queryByTestId('resultado-clasificacion')).not.toBeInTheDocument();
  });
});
