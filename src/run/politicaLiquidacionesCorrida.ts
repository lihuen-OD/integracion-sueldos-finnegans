// Composición por destino de las políticas de liquidación de una corrida. Cada selector
// conserva su resolución y revisión propias; este módulo solo enruta y no interpreta
// códigos ni descripciones bancarias.
import type { PoliticaLiquidaciones } from '../reconciliation';
import type { EstadoCorrida } from './corrida';
import { politicaLiquidacionesDesdeSeleccionBna } from './seleccionIdentificadorHaberesBna';
import { politicaLiquidacionesDesdeSeleccionPatagonia } from './seleccionLiquidacionPatagonia';

export function politicaLiquidacionesDeCorrida(estado: EstadoCorrida): PoliticaLiquidaciones {
  const bna = politicaLiquidacionesDesdeSeleccionBna(estado);
  const patagonia = politicaLiquidacionesDesdeSeleccionPatagonia(estado);
  return {
    resolver: (linea, destino) =>
      destino === 'BNA_GT_HABERES'
        ? bna.resolver(linea, destino)
        : patagonia.resolver(linea, destino),
    ...(bna.revisionSeleccionIdentificadorHaberesBna === undefined
      ? {}
      : {
          revisionSeleccionIdentificadorHaberesBna: bna.revisionSeleccionIdentificadorHaberesBna,
        }),
    ...(patagonia.revisionSeleccionLiquidacionPatagonia === undefined
      ? {}
      : {
          revisionSeleccionLiquidacionPatagonia: patagonia.revisionSeleccionLiquidacionPatagonia,
        }),
  };
}
