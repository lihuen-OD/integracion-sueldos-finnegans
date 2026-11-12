// @vitest-environment jsdom
// El flujo principal ya no pide una clasificación interna (período / tipo normalizado):
// la resolución de los TXT se apoya en las selecciones explícitas por banco. Este test fija
// que la UI no exponga esos controles y que la configuración bancaria siga disponible.
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
import { BANCO_NACION, BANCO_PATAGONIA } from '../../fixtures/synthetic/finnegansLike';

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
    expect(screen.getByTestId('panel-identificador-haberes-bna')).toBeInTheDocument();
    expect(screen.getByTestId('panel-tipo-liquidacion-patagonia')).toBeInTheDocument();
  });
}

afterEach(cleanup);

describe('App · configuración bancaria sin clasificación interna', () => {
  it('no pide período ni tipo interno y ofrece las selecciones por banco', async () => {
    const usuario = userEvent.setup();
    const [una, dos] = personas(2, 20261104);
    if (una === undefined || dos === undefined) {
      throw new Error('personas esperadas');
    }
    render(<App />);
    await subirFinnegans(usuario, [
      filaFinnegans(una, { Banco: BANCO_NACION, Descripcion: 'JULIO Agrario' }),
      filaFinnegans(dos, { Banco: BANCO_PATAGONIA, Descripcion: 'JULIO Agrario' }),
    ]);

    expect(screen.queryByTestId('panel-clasificacion-liquidaciones')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Clasificar esta descripción')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Período explícito')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Clasificación interna explícita')).not.toBeInTheDocument();

    expect(screen.getByTestId('paso-selecciones')).toHaveTextContent('Configurar tipos de haberes');
    expect(screen.getByTestId('panel-identificador-haberes-bna')).toHaveTextContent(
      'Sin preselección',
    );
    expect(screen.getByTestId('panel-tipo-liquidacion-patagonia')).toHaveTextContent('Provisional');
    expect(screen.queryByRole('button', { name: /TXT|archivo bancario/i })).not.toBeInTheDocument();
    expect(screen.getByText('No apto para pagos.')).toBeInTheDocument();
  });

  it('una selección BNA parcial no completa el paso ni aplica ninguna fila', async () => {
    const usuario = userEvent.setup();
    const [una, dos] = personas(2, 20261105);
    if (una === undefined || dos === undefined) {
      throw new Error('personas esperadas');
    }
    render(<App />);
    await usuario.upload(
      screen.getByLabelText('Archivo de la liquidación', { exact: true }),
      archivo(
        finnegansXlsx([
          filaFinnegans(una, { Banco: BANCO_NACION, Descripcion: 'JULIO Liq final ' }),
          filaFinnegans(dos, { Banco: BANCO_NACION, Descripcion: 'JULIO Liq Final' }),
        ]),
      ),
    );
    await waitFor(() => {
      expect(screen.getByTestId('panel-identificador-haberes-bna')).toBeInTheDocument();
    });

    const pasoConfiguracion = () =>
      within(screen.getByRole('navigation', { name: 'Pasos del asistente' })).getByRole('link', {
        name: /Configurar tipos de haberes/,
      });

    // Las dos variantes son descripciones distintas por el espacio final: se piden por separado.
    expect(screen.getAllByLabelText('Identificador de haberes')).toHaveLength(2);
    expect(pasoConfiguracion()).toHaveTextContent('En curso');

    const selectores = screen.getAllByLabelText('Identificador de haberes');
    const primero = selectores[0];
    if (primero === undefined) throw new Error('selector BNA esperado');
    await usuario.selectOptions(primero, '0003');

    // Elegir una sola descripción deja una pendiente: la cobertura sigue incompleta.
    expect(pasoConfiguracion()).toHaveTextContent('En curso');
    expect(screen.getByTestId('aviso-cobertura-bna')).toHaveTextContent(
      'Faltan 1 descripción por seleccionar',
    );

    await usuario.click(
      screen.getByRole('button', { name: 'Aplicar identificadores de haberes BNA' }),
    );

    // El borrador parcial no se presenta como cobertura completa ni completa el paso 2.
    expect(screen.getByTestId('resultado-identificador-haberes-bna')).toHaveTextContent(
      'con selección propuesta',
    );
    expect(screen.getByTestId('borrador-parcial-bna')).toBeInTheDocument();
    expect(screen.getByTestId('pendientes-bna')).toHaveTextContent('«JULIO Liq Final»');
    expect(pasoConfiguracion()).toHaveTextContent('En curso');
    expect(pasoConfiguracion()).not.toHaveTextContent('Completo');
  });
});
