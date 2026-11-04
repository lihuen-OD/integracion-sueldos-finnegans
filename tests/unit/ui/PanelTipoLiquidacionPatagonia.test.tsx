// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { PanelTipoLiquidacionPatagonia } from '../../../src/ui/PanelTipoLiquidacionPatagonia';

afterEach(cleanup);

describe('PanelTipoLiquidacionPatagonia', () => {
  it('presenta de forma comprensible los errores tipados devueltos por C2', async () => {
    const usuario = userEvent.setup();
    render(
      <PanelTipoLiquidacionPatagonia
        huellaFinnegans="huella-sintetica"
        descripciones={[
          {
            descripcionOriginal: 'JULIO Agrario',
            cantidadFilasPatagonia: 1,
            refs: [{ archivo: 'FINNEGANS', hoja: 'sintetica', fila: 2 }],
          },
        ]}
        aplicar={() => ({
          ok: false,
          error: [
            {
              codigo: 'CODIGO_FUERA_CATALOGO',
              indiceSeleccion: 0,
              codigoTipoLiquidacion: '005',
            },
          ],
        })}
      />,
    );

    await usuario.selectOptions(screen.getByLabelText('Concepto bancario'), '001');
    await usuario.click(
      screen.getByRole('button', { name: 'Aplicar tipos de liquidación Patagonia' }),
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'El código 005 no pertenece al catálogo provisional disponible.',
    );
  });
});
