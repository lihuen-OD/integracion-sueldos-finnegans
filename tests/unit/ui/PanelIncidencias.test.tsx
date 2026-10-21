// @vitest-environment jsdom
// Correctivo visual CP-F3-B: dos grupos con mismo código/nivel/alcance pero valores
// observados distintos deben verse DISTINTOS aun colapsados, sin inventar valores.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PanelIncidencias } from '../../../src/ui/PanelIncidencias';
import type { IncidenciaConciliada } from '../../../src/reconciliation';
import { etiquetaValoresGrupo } from '../../../src/ui/etiquetas';

afterEach(cleanup);

function incidencia(
  id: string,
  valores: Readonly<{ finnegans?: string; maestro?: string }> | undefined,
): IncidenciaConciliada {
  return {
    id,
    codigo: 'LIQUIDACION_SIN_MAPEO',
    nivel: 'BLOQUEANTE',
    alcance: 'BNA_GT_HABERES',
    refs: [],
    detalle: 'Tipo de liquidación sin mapeo aprobado al código bancario.',
    ...(valores === undefined ? {} : { valores }),
  };
}

describe('PanelIncidencias · valores que diferencian grupos colapsados', () => {
  it('dos grupos iguales en código, nivel y banco se muestran diferenciados por su valor', () => {
    render(
      <PanelIncidencias
        incidencias={[
          incidencia('i-1', { finnegans: 'JULIO Agrario' }),
          incidencia('i-2', { finnegans: 'JULIO Agrario' }),
          incidencia('i-3', { finnegans: 'JULIO Agrario' }),
          incidencia('i-4', { finnegans: 'JULIO Comercio ' }),
        ]}
      />,
    );
    const grupo1 = screen.getByTestId('grupo-caso-LIQUIDACION_SIN_MAPEO-1');
    const grupo2 = screen.getByTestId('grupo-caso-LIQUIDACION_SIN_MAPEO-2');
    const valor = (grupo: HTMLElement): string | undefined =>
      grupo.querySelector('p.text-slate-900')?.textContent.trim();
    expect(valor(grupo1)).toBe('JULIO Agrario');
    expect(valor(grupo2)).toBe('JULIO Comercio');
    // El conteo sigue derivado del motor, sin perder casos.
    expect(grupo1.textContent).toContain('3 casos');
    expect(grupo2.textContent).toContain('1 caso');
  });

  it('un grupo sin valor observado útil no muestra ningún valor inventado', () => {
    render(
      <PanelIncidencias
        incidencias={[incidencia('i-1', undefined), incidencia('i-2', undefined)]}
      />,
    );
    // Valores vacíos/ausentes: la etiqueta humana queda vacía (no se inventa nada).
    expect(etiquetaValoresGrupo({ finnegans: '' })).toBe('');
    expect(etiquetaValoresGrupo(undefined)).toBe('');
    // El grupo ≠ contenido: título, conteo y botón de detalle siguen presentes.
    const grupo = screen.getByTestId('grupo-caso-LIQUIDACION_SIN_MAPEO-1');
    expect(grupo).toBeTruthy();
    expect(screen.getByTestId('detalle-grupo-LIQUIDACION_SIN_MAPEO-1')).toBeTruthy();
    expect(grupo.textContent).toContain('2 casos');
    // Y ningún párrafo de valor (la clase reservada para el valor diferenciador).
    expect(document.querySelector('p.text-slate-900')).toBeNull();
  });
});
