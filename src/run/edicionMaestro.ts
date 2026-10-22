// Editor UPDATE-only del maestro (T3-11, D-066): función pura de corrida que aplica UNA
// edición a la representación lógica actual. Sin ADD ni DELETE: la cantidad de registros
// no cambia y no se tocan identidad ni PAT_CODIGO_DEPENDENCIA. Valida con los validadores
// EXACTOS de F2 (domain/maestro), crea la revisión N+1 solo si la representación cambia
// (revisionTrasEdicion, D-062) y NO redefine ninguna huella de archivo: la
// MasterRevisionFingerprint la calcula el puente (`src/run/puente.ts`) al conciliar.
import type { CampoEditableMaestro, MasterRecord } from '../domain/maestro';
import { actualizarCampoBancario } from '../domain/maestro';
import type { EstadoCorrida } from './corrida';
import { conRevisionMaestro } from './corrida';
import { revisionTrasEdicion, type RevisionMaestro } from './revision';
import type { MotivoCampoInvalido } from '../domain/maestro';

export type ErrorEdicionMaestro =
  | { readonly caso: 'CORRIDA_SIN_MAESTRO' }
  | { readonly caso: 'REGISTRO_AUSENTE' }
  | { readonly caso: 'VALOR_INVALIDO'; readonly motivo: MotivoCampoInvalido }
  | { readonly caso: 'SIN_CAMBIOS' };

export interface EdicionAplicada {
  readonly estado: EstadoCorrida;
  readonly revision: RevisionMaestro;
}

/** Índice del registro en la revisión vigente: identidad EXACTA (archivo/hoja/fila del
 *  import original + CUIL texto). Las ediciones no modifican identidad, así que la clave
 *  sigue siendo válida sobre cualquier revisión. */
function indiceDelRegistro(revision: RevisionMaestro, registroActual: MasterRecord): number | null {
  const indice = revision.registros.findIndex(
    (registro) =>
      registro.cuilTexto === registroActual.cuilTexto &&
      registro.ref.archivo === registroActual.ref.archivo &&
      registro.ref.hoja === registroActual.ref.hoja &&
      registro.ref.fila === registroActual.ref.fila,
  );
  return indice === -1 ? null : indice;
}

/**
 * Aplica una edición sobre la revisión vigente. Con texto igual al actual no hay revisión
 * artificial (SIN_CAMBIOS); con valor inválido no se reemplaza la revisión vigente, se
 * informa el motivo F2 y el valor anterior se conserva. El estado devuelto usa
 * `conRevisionMaestro`: `estado.maestro.registros` (archivo original), la huella de
 * archivo original y las decisiones NO se modifican.
 */
export function editarMaestro(
  estado: EstadoCorrida,
  registroActual: MasterRecord,
  campo: CampoEditableMaestro,
  texto: string,
):
  | { readonly ok: true; readonly value: EdicionAplicada }
  | { readonly ok: false; readonly error: ErrorEdicionMaestro } {
  const revision = estado.maestroRevision;
  if (revision === null) {
    return { ok: false, error: { caso: 'CORRIDA_SIN_MAESTRO' } };
  }
  const indice = indiceDelRegistro(revision, registroActual);
  if (indice === null) {
    return { ok: false, error: { caso: 'REGISTRO_AUSENTE' } };
  }
  const registroVigente = revision.registros[indice];
  if (registroVigente === undefined) {
    return { ok: false, error: { caso: 'REGISTRO_AUSENTE' } };
  }
  const resultado = actualizarCampoBancario(registroVigente, campo, texto);
  if (!resultado.ok && 'motivo' in resultado.campo) {
    return { ok: false, error: { caso: 'VALOR_INVALIDO', motivo: resultado.campo.motivo } };
  }
  if (!resultado.ok) {
    // unreachable: solo invalido llega acá con motivo
    return { ok: false, error: { caso: 'SIN_CAMBIOS' } };
  }
  const registros = [...revision.registros];
  registros[indice] = resultado.registro;
  const nueva = revisionTrasEdicion(revision, registros);
  if (!nueva.ok) {
    return {
      ok: false,
      error: { caso: 'SIN_CAMBIOS' }, // FALTANTES no puede ocurrir: el tamaño no cambia.
    };
  }
  return {
    ok: true,
    value: {
      estado: conRevisionMaestro(estado, nueva.value),
      revision: nueva.value,
    },
  };
}
