// Resumen principal de la conciliación (correctivo UX CP-F3-B): estado, totales y
// comprobaciones, de forma compacta y administrativa. La UI no recalcula nada: solo
// presenta lo que devolvió el motor (sin códigos internos en pantalla).
import type { ReactNode } from 'react';
import type { Totales, ResultadoConciliacion } from '../reconciliation';
import {
  ETIQUETA_ESTADO_GLOBAL,
  ETIQUETA_MOTIVO_GLOBAL,
  etiquetaDestino,
  etiquetaImporte,
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
      <td className="py-1">${etiquetaImporte(total.importe)}</td>
    </tr>
  );
}

/** Comprobación con estado visual inmediato: ✓ correcta, sin esconder la información. */
function Comprobacion({
  nombre,
  resultado,
  detalle,
}: {
  readonly nombre: string;
  readonly resultado: boolean | null;
  readonly detalle: string;
}) {
  const correcta = resultado !== false;
  return (
    <li className="text-sm">
      <span className={correcta ? 'font-medium text-emerald-700' : 'font-medium text-red-700'}>
        {resultado === null ? 'No aplica aún' : correcta ? 'Correcto' : 'Revisar'}
      </span>{' '}
      · {nombre}: {detalle}
    </li>
  );
}

export function PanelResumen({ resultado }: Props) {
  const global = resultado.global;
  return (
    <section className="mt-6" aria-labelledby="resumen-titulo" data-testid="panel-resumen">
      <h2 id="resumen-titulo" className="text-lg font-semibold">
        Resumen de la conciliación
      </h2>
      <p data-testid="estado-global" className="mt-2 text-xl font-semibold">
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
              Empleados
            </th>
            <th scope="col" className="py-1">
              Importe
            </th>
          </tr>
        </thead>
        <tbody>
          {filaTotales('Liquidación de Finnegans', global.finnegans)}
          {filaTotales(etiquetaDestino('BNA_GT_HABERES'), global.bna)}
          {filaTotales(etiquetaDestino('PATAGONIA_B2'), global.patagonia)}
          {filaTotales('Excluidos (neto cero)', global.excluidas)}
          {filaTotales('Pendientes', global.pendientes)}
        </tbody>
      </table>
      <ul className="mt-3 space-y-1" data-testid="invariantes">
        <Comprobacion
          nombre="cantidad"
          resultado={global.invarianteCantidad}
          detalle="la liquidación suma pagados + excluidos + pendientes"
        />
        <Comprobacion
          nombre="importe"
          resultado={global.invarianteImporte}
          detalle="los importes sumados coinciden con el total de la liquidación"
        />
        <Comprobacion
          nombre="pendientes en cero"
          resultado={global.invarianteSinPendientes}
          detalle="sin filas esperando decisión, todo distribuido"
        />
      </ul>
    </section>
  );
}
