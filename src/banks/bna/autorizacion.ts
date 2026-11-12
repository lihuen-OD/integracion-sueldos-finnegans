// Compuerta de autorización productiva BNA GT Haberes.
//
// La producción permanece CERRADA POR CONSTRUCCIÓN. No existe un estado aprobado,
// ni evidencia, ni flag, ni override: `produccionBnaHabilitada` devuelve siempre
// `false`. Una autorización futura exige un mecanismo no falsificable (por ejemplo,
// un artefacto firmado o una aprobación fuera de banda) y un checkpoint propio; un
// identificador de evidencia, un perfil, un parámetro de corrida o una variable de
// entorno no pueden abrir esta compuerta.
//
// La compuerta es independiente del contrato bancario: aunque BNA-1 deje de estar
// BLOQUEADA y la política resuelva el resto de las interpretaciones, la fachada
// productiva seguirá detenida acá. Resolver el contrato no equivale a homologar ni
// a autorizar producción (D-090). No resuelve BNA-1/BNA-2/BNA-5/BNA-6/BNA-7/BNA-8/
// BNA-9/BNA-11 ni P-09/P-10: solo impide generar bytes mientras no exista una
// autorización real.

/** Único estado implementado: no hay habilitación productiva. */
export type EstadoAutorizacionProduccionBna = 'PENDIENTE_DE_HOMOLOGACION';

/**
 * Compuerta cerrada por diseño. No recibe perfil, parámetros, políticas, evidencia
 * ni propiedades de la entrada: no hay ningún valor que la abra.
 *
 * Cuando exista un mecanismo de autorización no falsificable, este módulo y su
 * llamador deberán cambiarse en un checkpoint revisado. Mientras tanto, la
 * producción BNA no puede generar bytes.
 */
export function produccionBnaHabilitada(): boolean {
  return false;
}
