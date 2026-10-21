// Decisiones del operador (correctivo UX CP-F3-B): muestra en palabras lo que el motor
// resolvió y lo que no se aplicó y por qué. La UI no re-evalúa vigencia: solo traduce el
// resultado. Los IDs técnicos (d-N) quedan en atributos de datos para depuración, no en el
// texto visible principal.
import { Fragment } from 'react';
import type { DecisionNoAplicada, DecisionOperador } from '../reconciliation';
import { ETIQUETA_MOTIVO_NO_APLICADA, etiquetaDecision } from './etiquetas';

interface Props {
  readonly aplicadas: readonly DecisionOperador[];
  readonly noAplicadas: readonly DecisionNoAplicada[];
}

export function PanelDecisiones({ aplicadas, noAplicadas }: Props) {
  return (
    <section className="mt-6" aria-labelledby="decisiones-titulo" data-testid="panel-decisiones">
      <h2 id="decisiones-titulo" className="text-lg font-semibold">
        Decisiones registradas en esta corrida
      </h2>
      <div className="mt-2 text-sm">
        <p data-testid="decisiones-aplicadas">
          <strong>Aplicadas:</strong>{' '}
          {aplicadas.length === 0
            ? '(ninguna todavía)'
            : aplicadas.map((decision, indice) => (
                <Fragment key={decision.id}>
                  {indice > 0 && ' · '}
                  <span data-id={decision.id}>{etiquetaDecision(decision)}</span>
                </Fragment>
              ))}
        </p>
        <div data-testid="decisiones-no-aplicadas" className="mt-1">
          <strong>No aplicadas:</strong>{' '}
          {noAplicadas.length === 0 ? (
            '(ninguna)'
          ) : (
            <ul className="list-disc pl-5">
              {noAplicadas.map((noAp) => (
                <li key={noAp.decision.id} data-id={noAp.decision.id}>
                  {etiquetaDecision(noAp.decision)} — {ETIQUETA_MOTIVO_NO_APLICADA[noAp.motivo]}
                </li>
              ))}
            </ul>
          )}
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
