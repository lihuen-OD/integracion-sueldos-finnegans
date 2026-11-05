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
    await usuario.selectOptions(primerSelector, '0000');
    expect(invalidar).toHaveBeenCalledTimes(1);
    expect(screen.getByText('SE CONSIDERAN PARA EL COBRO DE CUOTAS DE PRESTAMOS')).toBeVisible();

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
      '2 empleados BNA con selección validada',
    );
  });
});
