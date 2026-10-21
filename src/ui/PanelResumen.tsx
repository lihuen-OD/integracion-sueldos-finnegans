// Resumen global de la conciliación (CP-F3-B): muestra el estado que calculó el motor F2
// (totales, invariantes, motivos). La UI no recalcula nada: solo traduce y presenta.
import type { ReactNode } from 'react';
import type { Destino } from '../domain/destino';
import type { Totales } from '../reconciliation';
import type { ResultadoConciliacion } from '../reconciliation';
import {
  ETIQUETA_ESTADO_GLOBAL,
  ETIQUETA_MOTIVO_GLOBAL,
  etiquetaImporte,
  etiquetaDestino,
} from './etiquetas';

interface Props {
  readonly resultado: ResultadoConciliacion;
}

function filaTotales(nombre: string, total: Totales): ReactNode {
  return (
    <tr key={nombre} className="border-b border-slate-100">
      <th scope="row" className="py-1 pr-3 text-left font-medium">
        {nombre}
      </th>
      <td className="py-1 pr-3">{String(total.cantidad)}</td>
      <td className="py-1">{etiquetaImporte(total.importe)}</td>
    </tr>
  );
}

export function PanelResumen({ resultado }: Props) {
  const global = resultado.global;
  return (
    <section className="mt-6" aria-labelledby="resumen-titulo" data-testid="panel-resumen">
      <h2 id="resumen-titulo" className="text-lg font-semibold">
        Resumen de la conciliación
      </h2>
      <p data-testid="estado-global" className="mt-2 font-medium">
        {ETIQUETA_ESTADO_GLOBAL[global.estado]}
      </p>
      {global.motivos.length > 0 && (
        <div data-testid="motivos-globales" className="mt-2 text-sm text-slate-700">
          <p className="font-medium">Por qué el estado es este:</p>
          <ul className="list-disc pl-5">
            {global.motivos.map((motivo) => (
              <li key={motivo}>{ETIQUETA_MOTIVO_GLOBAL[motivo]}</li>
            ))}
          </ul>
        </div>
      )}
      <table className="mt-4 w-full max-w-xl border-collapse text-sm" data-testid="totales">
        <caption className="text-left">Totales por grupo (cantidad e importe)</caption>
        <thead>
          <tr className="border-b border-slate-300 text-left">
            <th scope="col" className="py-1 pr-3">
              Grupo
            </th>
            <th scope="col" className="py-1 pr-3">
              Cantidad
            </th>
            <th scope="col" className="py-1">
              Importe
            </th>
          </tr>
        </thead>
        <tbody>
          {filaTotales('Liquidación de Finnegans', global.finnegans)}
          {filaTotales(etiquetaDestino('BNA_GT_HABERES' satisfies Destino), global.bna)}
          {filaTotales(etiquetaDestino('PATAGONIA_B2' satisfies Destino), global.patagonia)}
          {filaTotales('Excluidas (neto cero)', global.excluidas)}
          {filaTotales('Pendientes', global.pendientes)}
        </tbody>
      </table>
      <ul className="mt-3 space-y-1 text-sm" data-testid="invariantes">
        <li>
          Cantidad: {global.invarianteCantidad ? 'cuadra' : 'NO cuadra'} Finnegans = pagadas +
          excluidas + pendientes.
        </li>
        <li>
          Importe:{' '}
          {global.invarianteImporte === null
            ? 'no se puede controlar (hay importes imposibles de calcular o filas pendientes)'
            : global.invarianteImporte
              ? 'cuadra'
              : 'NO cuadra'}
          .
        </li>
        <li>
          Pendientes en cero:{' '}
          {global.invarianteSinPendientes === null
            ? 'no aplica todavía'
            : global.invarianteSinPendientes
              ? 'cuadra'
              : 'NO cuadra'}
          .
        </li>
      </ul>
    </section>
  );
}
