// Evidencia sintética BNA-B2 para pruebas de fachadas posteriores a la conciliación.
// Construye el snapshot mediante la API B1 real y estampa exactamente su revisión; no
// inventa snapshots ni se usa desde src/.
import {
  identificarDescripcionesLiquidacionBna,
  type CodigoIdentificadorHaberesBna,
} from '../../../src/banks/bna';
import type { LecturaFinnegans } from '../../../src/domain/liquidacion';
import type { ResultadoConciliacion } from '../../../src/reconciliation';
import { conFinnegans, nuevaCorrida } from '../../../src/run/corrida';
import {
  aplicarSeleccionesIdentificadorHaberesBnaCorrida,
  resolverSeleccionIdentificadorHaberesBna,
  revisionSeleccionIdentificadorHaberesBna,
  type SnapshotSeleccionIdentificadorHaberesBna,
} from '../../../src/run/seleccionIdentificadorHaberesBna';

export interface EvidenciaSeleccionBnaSintetica {
  readonly conciliacion: ResultadoConciliacion;
  readonly seleccionIdentificadorHaberesBna: SnapshotSeleccionIdentificadorHaberesBna;
  readonly huellaFinnegans: string;
}

export function evidenciaSeleccionBnaSintetica(
  conciliacion: ResultadoConciliacion,
  huellaFinnegans = 'huella-sintetica-bna-b2',
  codigoIdentificadorHaberes: CodigoIdentificadorHaberesBna = '0000',
): EvidenciaSeleccionBnaSintetica {
  const lineas = conciliacion.filas.map((fila) => fila.linea);
  const lectura: LecturaFinnegans = {
    hoja: 'Liquidacion sintetica',
    visibilidadHoja: 'visible',
    lineas,
    hallazgos: [],
  };
  const base = conFinnegans(nuevaCorrida(), lectura, huellaFinnegans);
  const aplicacion = aplicarSeleccionesIdentificadorHaberesBnaCorrida(
    base,
    identificarDescripcionesLiquidacionBna(lineas).map((item) => ({
      huellaFinnegans,
      descripcionOriginal: item.descripcionOriginal,
      destino: 'BNA_GT_HABERES',
      codigoIdentificadorHaberes,
    })),
  );
  if (!aplicacion.ok) throw new Error('selección sintética BNA inválida');
  const snapshot = aplicacion.value.estado.seleccionIdentificadorHaberesBna;
  if (snapshot === null) throw new Error('snapshot sintético BNA ausente');
  const resolucion = resolverSeleccionIdentificadorHaberesBna(snapshot, huellaFinnegans, lineas);
  if (resolucion === null || resolucion.pendientes.length > 0) {
    throw new Error('resolución sintética BNA incompleta');
  }
  return {
    conciliacion: {
      ...conciliacion,
      revisionSeleccionIdentificadorHaberesBna:
        revisionSeleccionIdentificadorHaberesBna(resolucion),
    },
    seleccionIdentificadorHaberesBna: snapshot,
    huellaFinnegans,
  };
}
