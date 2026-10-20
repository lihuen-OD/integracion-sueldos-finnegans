// Conciliación global (docs/03 §G.2, D-032): totales en cantidad y en centavos e invariantes.
//   TOTAL FINNEGANS = TOTAL BNA + TOTAL PATAGONIA + TOTAL EXCLUIDOS + TOTAL PENDIENTES
// y, con pendientes = 0, TOTAL FINNEGANS = TOTAL BNA + TOTAL PATAGONIA + TOTAL EXCLUIDOS.
// El total Finnegans se calcula directamente de las líneas, por separado de los estados, para
// que el invariante detecte filas perdidas. Nunca se fabrica un importe: si un neto no es
// interpretable, el importe queda null y la conciliación global BLOQUEADA; las cantidades se
// siguen conciliando.
import type { PayrollLine } from '../domain/liquidacion';
import type { Centavos } from '../domain/money';
import type { FilaConciliada, IncidenciaConciliada } from './tipos';

export interface Totales {
  readonly cantidad: number;
  /** Suma exacta de los netos; null si alguna fila tiene un neto no interpretable. */
  readonly importe: Centavos | null;
  readonly filasSinImporte: number;
}

export type MotivoGlobal =
  | 'BLOQUEANTES_GLOBALES'
  | 'IMPORTE_NO_CALCULABLE'
  | 'INVARIANTE_CANTIDAD'
  | 'INVARIANTE_IMPORTE'
  | 'FILAS_PENDIENTES'
  | 'REVISIONES_GLOBALES_SIN_RESOLVER';

export interface GlobalReconciliationStatus {
  readonly estado: 'CERRADA' | 'PENDIENTE' | 'BLOQUEADA';
  readonly finnegans: Totales;
  readonly bna: Totales;
  readonly patagonia: Totales;
  readonly excluidas: Totales;
  readonly pendientes: Totales;
  /** Finnegans = BNA + Patagonia + excluidas + pendientes, en cantidad. */
  readonly invarianteCantidad: boolean;
  /** Ídem en centavos; null si el importe no puede calcularse. */
  readonly invarianteImporte: boolean | null;
  /** Con pendientes = 0: Finnegans = BNA + Patagonia + excluidas (cantidad e importe). Null si hay pendientes o el importe no se puede calcular. */
  readonly invarianteSinPendientes: boolean | null;
  readonly bloqueantesGlobales: number;
  readonly revisionesGlobalesSinResolver: number;
  /** Todas las condiciones que impiden cerrar, en orden. */
  readonly motivos: readonly MotivoGlobal[];
}

export function totalesDe(lineas: readonly PayrollLine[]): Totales {
  let importe = 0n;
  let filasSinImporte = 0;
  for (const linea of lineas) {
    if (linea.neto === null) {
      filasSinImporte += 1;
    } else {
      importe += linea.neto;
    }
  }
  return {
    cantidad: lineas.length,
    importe: filasSinImporte > 0 ? null : (importe as Centavos),
    filasSinImporte,
  };
}

function sumaDe(partes: readonly Totales[]): { cantidad: number; importe: bigint | null } {
  let cantidad = 0;
  let importe: bigint | null = 0n;
  for (const parte of partes) {
    cantidad += parte.cantidad;
    importe = importe === null || parte.importe === null ? null : importe + parte.importe;
  }
  return { cantidad, importe };
}

export function conciliacionGlobal(
  lineas: readonly PayrollLine[],
  filas: readonly FilaConciliada[],
  incidencias: readonly IncidenciaConciliada[],
): GlobalReconciliationStatus {
  const en = (condicion: (fila: FilaConciliada) => boolean) =>
    totalesDe(filas.filter(condicion).map((fila) => fila.linea));
  const destinoEs = (destino: string) => (fila: FilaConciliada) =>
    fila.estado.estado === 'INCLUIDA' && fila.estado.destino === destino;

  const finnegans = totalesDe(lineas);
  const bna = en(destinoEs('BNA_GT_HABERES'));
  const patagonia = en(destinoEs('PATAGONIA_B2'));
  const excluidas = en((fila) => fila.estado.estado === 'EXCLUIDA');
  const pendientes = en((fila) => fila.estado.estado === 'PENDIENTE');

  const cuatro = sumaDe([bna, patagonia, excluidas, pendientes]);
  const tres = sumaDe([bna, patagonia, excluidas]);
  const invarianteCantidad = finnegans.cantidad === cuatro.cantidad;
  const invarianteImporte =
    finnegans.importe === null ? null : finnegans.importe === cuatro.importe;
  const invarianteSinPendientes =
    pendientes.cantidad > 0 || finnegans.importe === null
      ? null
      : finnegans.cantidad === tres.cantidad && finnegans.importe === tres.importe;

  const sinResolver = incidencias.filter(
    (i) => i.alcance === 'GLOBAL' && i.resolucion === undefined,
  );
  const bloqueantesGlobales = sinResolver.filter((i) => i.nivel === 'BLOQUEANTE').length;
  const revisionesGlobalesSinResolver = sinResolver.filter(
    (i) => i.nivel === 'REQUIERE_REVISION',
  ).length;

  const motivos: MotivoGlobal[] = [];
  if (bloqueantesGlobales > 0) {
    motivos.push('BLOQUEANTES_GLOBALES');
  }
  if (finnegans.importe === null) {
    motivos.push('IMPORTE_NO_CALCULABLE');
  }
  if (!invarianteCantidad) {
    motivos.push('INVARIANTE_CANTIDAD');
  }
  if (invarianteImporte === false) {
    motivos.push('INVARIANTE_IMPORTE');
  }
  if (pendientes.cantidad > 0) {
    motivos.push('FILAS_PENDIENTES');
  }
  if (revisionesGlobalesSinResolver > 0) {
    motivos.push('REVISIONES_GLOBALES_SIN_RESOLVER');
  }

  const bloquea: readonly MotivoGlobal[] = [
    'BLOQUEANTES_GLOBALES',
    'IMPORTE_NO_CALCULABLE',
    'INVARIANTE_CANTIDAD',
    'INVARIANTE_IMPORTE',
  ];
  const estado = motivos.some((motivo) => bloquea.includes(motivo))
    ? 'BLOQUEADA'
    : motivos.length > 0
      ? 'PENDIENTE'
      : 'CERRADA';

  return {
    estado,
    finnegans,
    bna,
    patagonia,
    excluidas,
    pendientes,
    invarianteCantidad,
    invarianteImporte,
    invarianteSinPendientes,
    bloqueantesGlobales,
    revisionesGlobalesSinResolver,
    motivos,
  };
}
