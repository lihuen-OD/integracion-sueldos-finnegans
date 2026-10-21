// @vitest-environment jsdom
// Pruebas de UI del asistente CP-F3-B. La UI no implementa reglas: aquí solo se prueban
// accesibilidad básica, avisos y estados de arranque.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../../../src/ui/App';

afterEach(cleanup);

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
});
