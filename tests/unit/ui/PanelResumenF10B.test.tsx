// @vitest-environment jsdom
// F10-B: el estado global "Conciliación cerrada" no debe leerse como "listo para pagar"
// cuando quedan bloqueos por fila de alcance bancario.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PanelResumen } from '../../../src/ui/PanelResumen';
import { createRandom } from '../../fixtures/synthetic/identities';
import { filaFinnegans, personas, registroBna } from '../../fixtures/synthetic/escenarios';
import { escenario } from '../reconciliation/helpers';

afterEach(cleanup);

function conciliacionBna(sinMapeo: boolean) {
  const [persona] = personas(1, 20261121);
  if (persona === undefined) throw new Error('persona insuficiente');
  const random = createRandom(20261121);
  return escenario(
    [filaFinnegans(persona, { Banco: 'BANCO DE LA NACION ARGENTINA' })],
    [registroBna(persona, random)],
    // `null` usa la política de producción (sin mapeos aprobados); omitir mantiene TODO_MAPEADO.
    sinMapeo ? { liquidaciones: null } : {},
  );
}

describe('PanelResumen · bloqueos por fila con conciliación global cerrada', () => {
  it('advierte que no está listo para pagos aunque el estado global sea CERRADA', () => {
    const resultado = conciliacionBna(true);
    expect(resultado.global.estado).toBe('CERRADA');
    expect(
      resultado.incidencias.some(
        (incidencia) =>
          incidencia.codigo === 'LIQUIDACION_SIN_MAPEO' && incidencia.alcance === 'BNA_GT_HABERES',
      ),
    ).toBe(true);

    render(<PanelResumen resultado={resultado} />);
    expect(screen.getByTestId('estado-global')).toHaveTextContent('Conciliación cerrada');
    expect(screen.getByTestId('bloqueos-por-fila')).toHaveTextContent(
      'todavía no está lista para generar pagos',
    );
  });

  it('no agrega la advertencia cuando no hay bloqueos por fila', () => {
    const resultado = conciliacionBna(false);
    expect(resultado.global.estado).toBe('CERRADA');

    render(<PanelResumen resultado={resultado} />);
    expect(screen.queryByTestId('bloqueos-por-fila')).not.toBeInTheDocument();
  });
});
