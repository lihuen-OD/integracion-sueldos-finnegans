// Estado de una corrida (plan F3): SOLO en memoria, sin persistencia ni red. Cada cambio
// es una función pura que devuelve un estado nuevo; nada muta los archivos de entrada ni
// los contratos de F2. El `FileFingerprint` (huella SHA-256 del archivo observado, P-29.3)
// viaja junto a cada carga y NO se redefine aquí.
import type { LecturaFinnegans } from '../domain/liquidacion';
import type { LecturaMaestro } from '../domain/maestro';
import type { CompanyProfile } from '../profile';
import type { DecisionOperador } from '../reconciliation';

/** Estado completo de una corrida. Todos los componentes son opcionales: la corrida se
 *  completa por pasos y puede reiniciarse en cualquier momento. */
export interface EstadoCorrida {
  /** Lectura de Finnegans (parse F2 intacto). */
  readonly finnegans: LecturaFinnegans | null;
  /** FileFingerprint del archivo Finnegans observado. */
  readonly huellaFinnegans: string | null;
  /** Lectura del maestro original importado (revisión 0 antes de T3-6). */
  readonly maestro: LecturaMaestro | null;
  /** FileFingerprint del archivo del maestro observado. */
  readonly huellaMaestro: string | null;
  /** Perfil de empresa cargado (validado). Máximo uno por corrida (D-059). */
  readonly perfil: CompanyProfile | null;
  /** Decisiones del operador registradas en esta corrida. */
  readonly decisiones: readonly DecisionOperador[];
}

/** Estado inicial: corrida vacía. */
export function nuevaCorrida(): EstadoCorrida {
  return {
    finnegans: null,
    huellaFinnegans: null,
    maestro: null,
    huellaMaestro: null,
    perfil: null,
    decisiones: [],
  };
}

/** Carga (o reemplaza, como paso explícito) la lectura de Finnegans con su huella. */
export function conFinnegans(
  estado: EstadoCorrida,
  lectura: LecturaFinnegans,
  huella: string,
): EstadoCorrida {
  return { ...estado, finnegans: lectura, huellaFinnegans: huella };
}

/** Carga (o reemplaza) la lectura del maestro importado con su huella de archivo. */
export function conMaestro(
  estado: EstadoCorrida,
  lectura: LecturaMaestro,
  huella: string,
): EstadoCorrida {
  return { ...estado, maestro: lectura, huellaMaestro: huella };
}

/** Carga (o reemplaza) el perfil de empresa valido. */
export function conPerfil(estado: EstadoCorrida, perfil: CompanyProfile): EstadoCorrida {
  return { ...estado, perfil };
}

/** Registra una decisión del operador y devuelve un estado nuevo (inmutable). */
export function conDecision(estado: EstadoCorrida, decision: DecisionOperador): EstadoCorrida {
  return { ...estado, decisiones: [...estado.decisiones, decision] };
}

/** Reinicio explícito y puro de la corrida: descarta TODO el estado en memoria. La UI
 *  posterior es responsable de la confirmación visual; el dominio solo ofrece esta
 *  operación sin efectos ocultos ni persistencia. */
export function reiniciarCorrida(): EstadoCorrida {
  return nuevaCorrida();
}
