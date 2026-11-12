// Compuerta de autorización productiva Patagonia B.2 (CP-F7-C2.0).
//
// La producción permanece CERRADA POR CONSTRUCCIÓN. No existe un estado
// aprobado, ni evidencia, ni flag, ni override: `produccionPatagoniaHabilitada`
// devuelve siempre `false`. Una autorización futura exige un mecanismo no
// falsificable (por ejemplo, un artefacto firmado o una aprobación fuera de
// banda) y un checkpoint propio; un identificador de evidencia, un perfil, un
// parámetro de corrida o una variable de entorno no pueden abrir esta compuerta.
//
// La compuerta es independiente del contrato bancario: aunque PAT-1/PAT-2 dejen
// de estar BLOQUEADA, la fachada productiva seguirá detenida acá. Resolver el
// contrato no equivale a homologar ni a autorizar producción (D-090).

/** Único estado implementado: no hay habilitación productiva. */
export type EstadoAutorizacionProduccionPatagonia = 'PENDIENTE_DE_HOMOLOGACION';

/**
 * Compuerta cerrada por diseño. No recibe perfil, parámetros, políticas,
 * evidencia ni propiedades de la entrada: no hay ningún valor que la abra.
 *
 * Cuando exista un mecanismo de autorización no falsificable, este módulo y su
 * llamador deberán cambiarse en un checkpoint revisado. Mientras tanto, la
 * producción Patagonia no puede generar bytes.
 */
export function produccionPatagoniaHabilitada(): boolean {
  return false;
}
