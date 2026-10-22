// Revisión lógica del maestro y su huella (D-062): la representación del maestro importado
// es la revisión 0; cada UPDATE válido futuro crea la revisión N+1. La
// `MasterRevisionFingerprint` es la SHA-256 de la serialización canónica de la
// representación lógica y es un concepto DISTINTO del `FileFingerprint` del archivo
// observado (P-29.3): nada de este módulo redefine las huellas de archivo de F2.
import type { CampoMaestro, LecturaMaestro, MasterRecord } from '../domain/maestro';
import type { Result } from '../shared/result';
import { calcularHuella } from '../import/huella';

export interface RevisionMaestro {
  /** 0 = maestro importado; cada UPDATE válido aumenta el número. */
  readonly numero: number;
  readonly registros: readonly MasterRecord[];
}

export type ErrorRevision = 'REGISTROS_FALTANTES' | 'REGISTROS_IGUALES';

const VERSION_SERIALIZACION_REVISION = 1;

/** Revisión 0: la representación lógica del maestro importado (sin ediciones). */
export function revisionMaestroImportada(lectura: LecturaMaestro): RevisionMaestro {
  return { numero: 0, registros: lectura.registros };
}

/**
 * Nueva revisión lógica a partir de una previa con registros ya actualizados y VALIDADOS:
 * la aplicación de un UPDATE en sí y su validación no ocurren acá (van en la edición,
 * CP-F3-C). Requiere que la representación cambie: si los registros son idénticos, no hay
 * revisión nueva y la huella no cambia.
 */
export function revisionTrasEdicion(
  previa: RevisionMaestro,
  registrosActualizados: readonly MasterRecord[],
): Result<RevisionMaestro, ErrorRevision> {
  if (registrosActualizados.length !== previa.registros.length) {
    return { ok: false, error: 'REGISTROS_FALTANTES' };
  }
  const mismos =
    serializacionCanonicaMaestro({ numero: previa.numero, registros: registrosActualizados }) ===
    serializacionCanonicaMaestro(previa);
  if (mismos) {
    return { ok: false, error: 'REGISTROS_IGUALES' };
  }
  return { ok: true, value: { numero: previa.numero + 1, registros: registrosActualizados } };
}

type ValorCampo =
  | { readonly estado: 'VACIO' }
  | { readonly estado: 'VALIDO'; readonly texto: string; readonly valor: string }
  | { readonly estado: 'INVALIDO'; readonly texto: string; readonly motivo: string };

// El orden de las claves queda fijo (JSON.stringify respeta el orden de inserción): la
// canonicidad depende de ese orden; cambiarlo regeneraría todas las huellas.
function campoCanonico(campo: CampoMaestro<unknown>): ValorCampo {
  if (campo.estado === 'VACIO') {
    return { estado: 'VACIO' };
  }
  return campo.estado === 'VALIDO'
    ? { estado: 'VALIDO', texto: campo.texto, valor: String(campo.valor) }
    : { estado: 'INVALIDO', texto: campo.texto, motivo: campo.motivo };
}

function registroCanonico(registro: MasterRecord): Record<string, unknown> {
  return {
    ref: registro.ref,
    cuilTexto: registro.cuilTexto,
    cuil: registro.cuil,
    legajo: registro.legajo,
    apellidoNombreRef: registro.apellidoNombreRef,
    cbu: campoCanonico(registro.cbu),
    patagonia: {
      tipoCuenta: campoCanonico(registro.patagonia.tipoCuenta),
      numeroCuenta: campoCanonico(registro.patagonia.numeroCuenta),
      codigoBanco: campoCanonico(registro.patagonia.codigoBanco),
      codigoSucursal: campoCanonico(registro.patagonia.codigoSucursal),
      tipoDocumento: campoCanonico(registro.patagonia.tipoDocumento),
      numeroDocumento: campoCanonico(registro.patagonia.numeroDocumento),
      provinciaDocumento: campoCanonico(registro.patagonia.provinciaDocumento),
      codigoDependencia: campoCanonico(registro.patagonia.codigoDependencia),
    },
  };
}

/**
 * Serialización canónica, determinista e independiente del render y del XLSX/ZIP: JSONL
 * con un renglón por registro, en el orden del array, con encabezado de versión. Sin
 * valores variables (no hay timestamps). Cambia cuando cambia la representación lógica.
 */
export function serializacionCanonicaMaestro(revision: RevisionMaestro): string {
  const cabecera = JSON.stringify({
    formato: 'MAESTRO_REVISION',
    version: VERSION_SERIALIZACION_REVISION,
    revision: revision.numero,
  });
  const lineas = revision.registros.map((registro) => JSON.stringify(registroCanonico(registro)));
  return [cabecera, ...lineas].join('\n');
}

/** MasterRevisionFingerprint: SHA-256 de la serialización canónica (Web Crypto local). */
export async function huellaRevisionMaestro(revision: RevisionMaestro): Promise<string> {
  const bytes = new TextEncoder().encode(serializacionCanonicaMaestro(revision));
  return calcularHuella(bytes);
}
