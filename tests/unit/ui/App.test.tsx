// @vitest-environment jsdom
// Pruebas de UI del asistente CP-F3-B. La UI no implementa reglas: aquí solo se prueban
// accesibilidad básica, avisos y estados de arranque.
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../../../src/ui/App';
import {
  filaFinnegans,
  finnegansXlsx,
  maestroXlsx,
  personas,
  registroBna,
} from '../../fixtures/synthetic/escenarios.ts';
import { createRandom } from '../../fixtures/synthetic/identities.ts';
import { plantillaPerfil } from '../../../src/profile/plantilla';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const NACION = 'BANCO DE LA NACION ARGENTINA';

/** File de prueba con copia de bytes de tipos alineados (Uint8Array<ArrayBuffer>). */
function archivo(bytes: Uint8Array, nombre: string, mime: string): File {
  const copia = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  copia.set(bytes);
  return new File([copia], nombre, { type: mime });
}

afterEach(cleanup);

/** Corrida mínima con conciliación visible usando archivos sintéticos reales. */
async function concilacionVisible(usuario: ReturnType<typeof userEvent.setup>) {
  const [una, dos] = personas(2, 20261020);
  if (una === undefined || dos === undefined) {
    throw new Error('personas esperadas');
  }
  await usuario.upload(
    screen.getByLabelText('Archivo de la liquidación', { exact: true }),
    archivo(
      finnegansXlsx([filaFinnegans(una, { Banco: NACION }), filaFinnegans(dos, { Banco: NACION })]),
      'finnegans_demo.xlsx',
      XLSX_MIME,
    ),
  );
  await usuario.upload(
    screen.getByLabelText('Archivo del maestro', { exact: true }),
    new File(
      [
        archivo(
          maestroXlsx([registroBna(una, createRandom(1)), registroBna(dos, createRandom(2))]),
          'maestro_demo.xlsx',
          XLSX_MIME,
        ),
      ],
      'maestro_demo.xlsx',
      { type: XLSX_MIME },
    ),
  );
  await waitFor(() => {
    expect(screen.getByTestId('resumen-carga')).toHaveTextContent(
      'Finnegans: cargada · Maestro: cargado',
    );
  });
  await usuario.click(screen.getByTestId('boton-conciliar'));
  await waitFor(() => {
    expect(screen.getByTestId('panel-resumen')).toBeInTheDocument();
  });
}

describe('App · corrida recién iniciada', () => {
  it('avisa que no apto para pagos y que las salidas quedan pendientes de homologación', () => {
    render(<App />);
    expect(screen.getByRole('note')).toHaveTextContent('No apto para pagos');
    expect(screen.getByRole('note')).toHaveTextContent('pendientes de homologación');
  });

  it('ofrece la carga de los dos archivos con etiquetas accesibles y sin autocompletado', () => {
    render(<App />);
    for (const label of ['Archivo de la liquidación', 'Archivo del maestro']) {
      const input = screen.getByLabelText(label);
      expect(input).toHaveAttribute('type', 'file');
      expect(input).toHaveAttribute('autocomplete', 'off');
    }
  });

  it('ofrece la plantilla del maestro; la prellenada exige la liquidación cargada', () => {
    render(<App />);
    expect(
      screen.getByRole('button', { name: 'Descargar plantilla del maestro (vacía)' }),
    ).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Descargar maestro prellenado' })).toBeDisabled();
    expect(screen.getByTestId('prellenado')).toHaveTextContent(
      'Cargá la liquidación de Finnegans para prellenar la plantilla del maestro.',
    );
  });

  it('sin archivos cargados no permite conciliar ni reinicia sin indicación', () => {
    render(<App />);
    expect(screen.getByTestId('boton-conciliar')).toBeDisabled();
    expect(screen.getByTestId('resumen-carga')).toHaveTextContent(
      'Finnegans: pendiente · Maestro: pendiente · Perfil: sin cargar',
    );
    expect(screen.queryByTestId('panel-resumen')).not.toBeInTheDocument();
  });

  it('el modo demo solo existe en desarrollo', () => {
    render(<App />);
    const enDev = import.meta.env.DEV;
    expect(screen.queryByTestId('boton-demo') === null).toBe(!enDev);
  });

  it('cargar un perfil después de conciliar invalida el resultado; vuelve al presionar Conciliar', async () => {
    const usuario = userEvent.setup();
    render(<App />);
    await concilacionVisible(usuario);
    expect(screen.getByTestId('resumen-carga')).toHaveTextContent('Perfil: sin cargar');

    // Perfil válido de la plantilla oficial de la UI, con CUIT estructural sintético en
    // runtime (D-042): mismo documento que PanelPerfil valida al vuelo.
    const cuit = ['30', '45678901', '3'].join('-');
    const perfilValido = {
      ...plantillaPerfil(cuit as never),
      nombreEmpresa: 'Empresa de prueba (sintética)',
    };
    await usuario.upload(
      screen.getByLabelText('Archivo del perfil (JSON)', { exact: true }),
      archivo(
        new TextEncoder().encode(JSON.stringify(perfilValido)),
        'perfil.json',
        'application/json',
      ),
    );
    expect(screen.getByTestId('perfil-ok')).toHaveTextContent('Perfil de empresa cargado.');
    expect(screen.getByTestId('resumen-carga')).toHaveTextContent('Perfil: cargado');

    // El resultado anterior ya no está en pantalla: la conciliación queda pendiente del
    // «Conciliar» explícito (nunca se recalcula solo porque cambió el perfil).
    expect(screen.queryByTestId('panel-resumen')).not.toBeInTheDocument();

    // Conciliar de nuevo usa el perfil vigente (readiness llega a cercanía de homologación).
    await usuario.click(screen.getByTestId('boton-conciliar'));
    await waitFor(() => {
      expect(screen.getByTestId('panel-resumen')).toBeInTheDocument();
    });
    expect(screen.getByTestId('perfil-activo')).toHaveTextContent('Empresa de prueba (sintética)');
    // Con el perfil el catálogo entra al motor: la corrida concilia con el perfil vigente
    // (el «motivo» de faltar datos de envío bancario sigue por diseño D-065; no lo afirmo).
  });
});
