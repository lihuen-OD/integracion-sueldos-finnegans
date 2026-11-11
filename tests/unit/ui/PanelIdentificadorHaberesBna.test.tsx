// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PanelIdentificadorHaberesBna } from '../../../src/ui/PanelIdentificadorHaberesBna';

afterEach(cleanup);

describe('PanelIdentificadorHaberesBna', () => {
  it('no preselecciona, explica el alcance grupal e invalida al modificar', async () => {
    const usuario = userEvent.setup();
    const invalidar = vi.fn();
    const aplicar = vi.fn(() => ({
      ok: true as const,
      value: {
        huellaFinnegans: 'huella-sintetica',
        lineas: [],
        seleccionesValidadas: [
          {
            huellaFinnegans: 'huella-sintetica',
            descripcionOriginal: 'JULIO Agrario',
            destino: 'BNA_GT_HABERES' as const,
            codigoIdentificadorHaberes: '0000' as const,
            descripcionCodigo: 'HABERES ORDINARIOS',
            consecuencia: 'SE CONSIDERAN PARA EL COBRO DE CUOTAS DE PRESTAMOS',
            seleccionAutomatica: false as const,
          },
        ],
        cantidadesAfectadas: [
          {
            descripcionOriginal: 'JULIO Agrario',
            cantidadFilasBna: 2,
            refs: [
              { archivo: 'FINNEGANS' as const, hoja: 'sintetica', fila: 2 },
              { archivo: 'FINNEGANS' as const, hoja: 'sintetica', fila: 3 },
            ],
          },
        ],
        pendientes: [
          {
            descripcionOriginal: 'SAC especial',
            cantidadFilasBna: 1,
            refs: [{ archivo: 'FINNEGANS' as const, hoja: 'sintetica', fila: 4 }],
          },
        ],
      },
    }));
    render(
      <PanelIdentificadorHaberesBna
        huellaFinnegans="huella-sintetica"
        descripciones={[
          {
            descripcionOriginal: 'JULIO Agrario',
            cantidadFilasBna: 2,
            refs: [
              { archivo: 'FINNEGANS', hoja: 'sintetica', fila: 2 },
              { archivo: 'FINNEGANS', hoja: 'sintetica', fila: 3 },
            ],
          },
          {
            descripcionOriginal: 'SAC especial',
            cantidadFilasBna: 1,
            refs: [{ archivo: 'FINNEGANS', hoja: 'sintetica', fila: 4 }],
          },
        ]}
        aplicar={aplicar}
        invalidar={invalidar}
      />,
    );

    const selectores = screen.getAllByLabelText('Identificador de haberes');
    expect(selectores).toHaveLength(2);
    expect(selectores[0]).toHaveValue('');
    expect(selectores[1]).toHaveValue('');
    expect(screen.getByRole('note')).toHaveTextContent('tratamientos distintos');

    const primerSelector = selectores[0];
    if (primerSelector === undefined) throw new Error('selector BNA esperado');
    expect(screen.getByText('0000')).toBeVisible();
    expect(screen.getByText('0003')).toBeVisible();
    await usuario.selectOptions(primerSelector, '0000');
    expect(invalidar).toHaveBeenCalledTimes(1);
    expect(
      screen.getAllByText(/SE CONSIDERAN PARA EL COBRO DE CUOTAS DE PRESTAMOS/).length,
    ).toBeGreaterThan(0);

    await usuario.click(
      screen.getByRole('button', { name: 'Aplicar identificadores de haberes BNA' }),
    );
    expect(aplicar).toHaveBeenCalledWith([
      {
        huellaFinnegans: 'huella-sintetica',
        descripcionOriginal: 'JULIO Agrario',
        destino: 'BNA_GT_HABERES',
        codigoIdentificadorHaberes: '0000',
      },
    ]);
    expect(screen.getByTestId('resultado-identificador-haberes-bna')).toHaveTextContent(
      '2 empleados BNA con selección propuesta; 1 empleado BNA pendiente.',
    );
    // La selección parcial NO resuelve filas: el panel lo dice explícitamente y enumera
    // las descripciones que faltan cubrir.
    expect(screen.getByTestId('borrador-parcial-bna')).toHaveTextContent(
      'no resuelve ninguna fila hasta cubrir todas las descripciones',
    );
    expect(screen.getByTestId('pendientes-bna')).toHaveTextContent('«SAC especial»');
    expect(screen.getByTestId('aviso-cobertura-bna')).toHaveTextContent(
      'Faltan 1 descripción por seleccionar',
    );
  });

  it('avisa la comparación exacta y expone espacios finales en la descripción', () => {
    render(
      <PanelIdentificadorHaberesBna
        huellaFinnegans="huella-sintetica"
        descripciones={[
          {
            descripcionOriginal: 'JULIO Liq final ',
            cantidadFilasBna: 2,
            refs: [
              { archivo: 'FINNEGANS', hoja: 'sintetica', fila: 17 },
              { archivo: 'FINNEGANS', hoja: 'sintetica', fila: 120 },
            ],
          },
          {
            descripcionOriginal: 'JULIO Liq Final',
            cantidadFilasBna: 2,
            refs: [
              { archivo: 'FINNEGANS', hoja: 'sintetica', fila: 121 },
              { archivo: 'FINNEGANS', hoja: 'sintetica', fila: 122 },
            ],
          },
        ]}
        aplicar={() => ({ ok: false as const, error: [] })}
        invalidar={() => undefined}
      />,
    );
    expect(screen.getByTestId('nota-comparacion-exacta-bna')).toHaveTextContent(
      'espacios finales cuentan como parte de la descripción',
    );
    // Los delimitadores hacen visible el espacio final, que de otro modo se pierde al leer.
    expect(screen.getByText('«JULIO Liq final »')).toBeVisible();
    expect(screen.getByText('«JULIO Liq Final»')).toBeVisible();
    expect(screen.getAllByTestId(/^descripcion-bna-/)).toHaveLength(2);
    expect(screen.getByTestId('aviso-cobertura-bna')).toHaveTextContent(
      'Faltan 2 descripciones por seleccionar',
    );
  });
});
