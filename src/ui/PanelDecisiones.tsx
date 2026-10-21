// Decisiones del operador (CP-F3-B): muestra lo que el motor F2 resolvió (aplicadas) y lo
// que no se aplicó con su motivo. La UI no re-evalúa vigencia: solo traduce el resultado.
import type { DecisionNoAplicada, DecisionOperador } from '../reconciliation';
import { etiquetaDestino, ETIQUETA_DESTINO, ETIQUETA_MOTIVO_NO_APLICADA } from './etiquetas';

interface Props {
  readonly aplicadas: readonly DecisionOperador[];
  readonly noAplicadas: readonly DecisionNoAplicada[];
}

function textoDecision(decision: DecisionOperador): string {
  const destino =
    decision.tipo === 'ASIGNAR_DESTINO'
      ? `destino ${ETIQUETA_DESTINO[decision.destino]}`
      : 'confirmación de datos';
  return `${decision.id}: ${destino}`;
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
            : aplicadas.map((decision) => textoDecision(decision)).join(' · ')}
        </p>
        <div data-testid="decisiones-no-aplicadas" className="mt-1">
          <strong>No aplicadas:</strong>{' '}
          {noAplicadas.length === 0 ? (
            '(ninguna)'
          ) : (
            <ul className="list-disc pl-5">
              {noAplicadas.map((noAp) => (
                <li key={noAp.decision.id}>
                  {textoDecision(noAp.decision)} — {ETIQUETA_MOTIVO_NO_APLICADA[noAp.motivo]}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Las decisiones se guardan solo en memoria mientras duran esta corrida; se pierden si
        reiniciás o cerrás la página. La simetría entre bancos es de tratamiento visual: las
        asignaciones a {etiquetaDestino('BNA_GT_HABERES')} y a {etiquetaDestino('PATAGONIA_B2')} se
        manejan igual.
      </p>
    </section>
  );
}
