// Decisiones del operador: muestra en palabras lo que el motor resolvió y lo que no se
// aplicó y por qué. La UI no re-evalúa vigencia: solo traduce el resultado. Los IDs
// técnicos quedan en atributos de datos para depuración, no en el texto visible principal.
import type { DecisionNoAplicada, DecisionOperador } from '../reconciliation';
import { ETIQUETA_MOTIVO_NO_APLICADA, etiquetaDecision } from './etiquetas';
import { Insignia } from './componentes';

interface Props {
  readonly aplicadas: readonly DecisionOperador[];
  readonly noAplicadas: readonly DecisionNoAplicada[];
}

export function PanelDecisiones({ aplicadas, noAplicadas }: Props) {
  return (
    <section aria-labelledby="decisiones-titulo" data-testid="panel-decisiones">
      <h3 id="decisiones-titulo" className="text-lg font-semibold text-marca-950">
        Decisiones registradas en esta corrida
      </h3>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-slate-800">Aplicadas</p>
            <Insignia tono={aplicadas.length === 0 ? 'neutral' : 'exito'}>
              {String(aplicadas.length)}
            </Insignia>
          </div>
          <p className="mt-2 text-slate-700" data-testid="decisiones-aplicadas">
            {aplicadas.length === 0
              ? '(ninguna todavía)'
              : aplicadas.map((decision, indice) => (
                  <span key={decision.id}>
                    {indice > 0 && ' · '}
                    <span data-id={decision.id}>{etiquetaDecision(decision)}</span>
                  </span>
                ))}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-slate-800">No aplicadas</p>
            <Insignia tono={noAplicadas.length === 0 ? 'neutral' : 'atencion'}>
              {String(noAplicadas.length)}
            </Insignia>
          </div>
          <div data-testid="decisiones-no-aplicadas" className="mt-2 text-slate-700">
            {noAplicadas.length === 0 ? (
              '(ninguna)'
            ) : (
              <ul className="list-disc space-y-1 pl-5">
                {noAplicadas.map((noAp) => (
                  <li key={noAp.decision.id} data-id={noAp.decision.id}>
                    {etiquetaDecision(noAp.decision)} — {ETIQUETA_MOTIVO_NO_APLICADA[noAp.motivo]}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Las decisiones se guardan solo en memoria mientras dure esta corrida; se pierden si
        reiniciás o cerrás la página. La asignación entre Banco Nación y Banco Patagonia se maneja
        igual para los dos.
      </p>
    </section>
  );
}
