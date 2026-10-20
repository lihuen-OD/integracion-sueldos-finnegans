// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../../../src/ui/App';

afterEach(cleanup);

describe('App', () => {
  it('muestra el aviso de entorno no apto para pagos', () => {
    render(<App />);
    expect(screen.getByRole('note')).toHaveTextContent('No apto para pagos');
    expect(screen.getByRole('note')).toHaveTextContent('PENDIENTE DE HOMOLOGACION');
  });

  it('ofrece la carga de XLSX con etiqueta accesible y sin autocompletado', () => {
    render(<App />);
    const input = screen.getByLabelText('Archivo XLSX');
    expect(input).toHaveAttribute('type', 'file');
    expect(input).toHaveAttribute('autocomplete', 'off');
    expect(screen.getByRole('button', { name: 'Limpiar' })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Descargar plantilla de prueba (T11)' }),
    ).toBeEnabled();
  });

  it('ofrece la plantilla del maestro (T-F2-M1); la prellenada exige una liquidación cargada', () => {
    render(<App />);
    expect(
      screen.getByRole('button', { name: 'Descargar plantilla del maestro vacía (T-F2-M1)' }),
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Descargar maestro prellenado (T-F2-M1)' }),
    ).toBeDisabled();
    expect(screen.getByTestId('prellenado')).toHaveTextContent(
      'Para prellenar el maestro, cargar una liquidación de Finnegans.',
    );
  });

  it('no muestra ningún diagnóstico antes de cargar un archivo', () => {
    render(<App />);
    expect(screen.queryByTestId('diagnostico')).not.toBeInTheDocument();
  });
});
