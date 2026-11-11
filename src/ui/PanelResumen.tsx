// Resumen principal de la conciliación: estado, totales y comprobaciones, de forma
// compacta y administrativa. La UI no recalcula nada: solo presenta lo que devolvió el
// motor (sin códigos internos en pantalla).
import type { ReactNode } from 'react';
import type { Totales, ResultadoConciliacion } from '../reconciliation';
import {
  ETIQUETA_ESTADO_GLOBAL,
  ETIQUETA_MOTIVO_GLOBAL,
  etiquetaDestino,
  etiquetaImporte,
} from './etiquetas';
import { Insignia, Metrica, type Tono } from './componentes';

interface Props {
  readonly resultado: ResultadoConciliacion;
}

function filaTotales(nombre: string, total: Totales): ReactNode {
  return (
    <tr key={nombre} className="border-b border-slate-100 last:border-0">
      <th scope="row" className="py-2 pr-3 text-left font-medium text-slate-700">
        {nombre}
      </th>
      <td className="px-3 py-2 text-right tabular-nums">{String(total.cantidad)}</td>
      <td className="py-2 pl-3 text-right tabular-nums">${etiquetaImporte(total.importe)}</td>
    </tr>
  );
}

const TONO_ESTADO: Readonly<Record<'CERRADA' | 'PENDIENTE' | 'BLOQUEADA', Tono>> = {
  CERRADA: 'exito',
  PENDIENTE: 'atencion',
  BLOQUEADA: 'peligro',
};

/** Comprobación con estado visual inmediato: no esconde la información. */
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
  const tono: Tono = resultado === null ? 'neutral' : correcta ? 'exito' : 'peligro';
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
      <Insignia tono={tono}>
        {resultado === null ? 'No aplica aún' : correcta ? 'Correcto' : 'Revisar'}
      </Insignia>
      <span className="font-medium text-slate-800">{nombre}</span>
      <span className="text-slate-600">· {detalle}</span>
    </li>
  );
}

export function PanelResumen({ resultado }: Props) {
  const global = resultado.global;
  const bloqueosPorFila = resultado.incidencias.filter(
    (incidencia) =>
      incidencia.alcance !== 'GLOBAL' &&
      incidencia.resolucion === undefined &&
      (incidencia.nivel === 'BLOQUEANTE' || incidencia.nivel === 'REQUIERE_REVISION'),
  ).length;
  const cerradaConBloqueosPorFila = global.estado === 'CERRADA' && bloqueosPorFila > 0;
  return (
    <section aria-labelledby="resumen-titulo" data-testid="panel-resumen">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h3 id="resumen-titulo" className="text-lg font-semibold text-marca-950">
          Resultado de la conciliación
        </h3>
        <Insignia tono={TONO_ESTADO[global.estado]}>
          {ETIQUETA_ESTADO_GLOBAL[global.estado]}
        </Insignia>
      </div>
      <p data-testid="estado-global" className="mt-2 text-2xl font-semibold text-marca-950">
        {ETIQUETA_ESTADO_GLOBAL[global.estado]}
      </p>
      {cerradaConBloqueosPorFila && (
        <p
          data-testid="bloqueos-por-fila"
          className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
        >
          <strong>
            La conciliación global está cerrada, pero todavía no está lista para generar pagos.
          </strong>{' '}
          Hay {String(bloqueosPorFila)}{' '}
          {bloqueosPorFila === 1 ? 'bloqueo o revisión' : 'bloqueos o revisiones'} por banco sin
          resolver. Revisá el estado de cada banco antes de continuar.
        </p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Metrica etiqueta="Liquidación" valor={String(global.finnegans.cantidad)} />
        <Metrica etiqueta="Banco Nación" valor={String(global.bna.cantidad)} tono="exito" />
        <Metrica
          etiqueta="Banco Patagonia"
          valor={String(global.patagonia.cantidad)}
          tono="exito"
        />
        <Metrica etiqueta="Excluidos" valor={String(global.excluidas.cantidad)} />
        <Metrica
          etiqueta="Pendientes"
          valor={String(global.pendientes.cantidad)}
          tono={global.pendientes.cantidad > 0 ? 'atencion' : 'neutral'}
        />
      </div>

      {global.motivos.length > 0 && (
        <div
          data-testid="motivos-globales"
          className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"
        >
          <p className="font-semibold">Por qué el estado es este:</p>
          <ul className="mt-1 list-disc pl-5">
            {global.motivos.map((motivo) => (
              <li key={motivo}>{ETIQUETA_MOTIVO_GLOBAL[motivo]}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[34rem] border-collapse text-sm" data-testid="totales">
          <caption className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-700">
            Totales por grupo (cantidad e importe)
          </caption>
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs tracking-wide text-slate-500 uppercase">
              <th scope="col" className="px-3 py-2 font-semibold">
                Grupo
              </th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">
                Empleados
              </th>
              <th scope="col" className="py-2 pl-3 text-right font-semibold">
                Importe
              </th>
            </tr>
          </thead>
          <tbody className="[&>tr>th]:pl-3 [&>tr>td:last-child]:pr-3">
            {filaTotales('Liquidación de Finnegans', global.finnegans)}
            {filaTotales(etiquetaDestino('BNA_GT_HABERES'), global.bna)}
            {filaTotales(etiquetaDestino('PATAGONIA_B2'), global.patagonia)}
            {filaTotales('Excluidos (neto cero)', global.excluidas)}
            {filaTotales('Pendientes', global.pendientes)}
          </tbody>
        </table>
      </div>

      <ul className="mt-3 grid gap-2" data-testid="invariantes">
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
