// Transferencia del perfil como archivo (D-059): la importación evalúa SOLO el contenido
// del JSON, con el nombre que sea; la exportación exige un perfil ya validado y sugiere un
// nombre sin que ese nombre sea parte del contrato. Sin persistencia automática: el
// navegador guarda los bytes localmente y nada queda en la app.
import { downloadBytes } from '../export/download';
import type { Result } from '../shared/result';
import type { CompanyProfile } from './contrato';
import { NOMBRE_SUGERIDO_PERFIL, serializarPerfil } from './plantilla';
import { parsePerfil, type ErrorPerfil } from './validar';

/** Lee bytes de un archivo con el nombre que sea y valida su contenido JSON (D-059). */
export function perfilDesdeBytes(bytes: Uint8Array): Result<CompanyProfile, ErrorPerfil[]> {
  let texto: string;
  try {
    texto = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return {
      ok: false,
      error: [{ ruta: '$', codigo: 'NO_ES_JSON', detalle: 'el archivo no es texto UTF-8' }],
    };
  }
  return parsePerfil(texto);
}

/** Exportación: solo permite un perfil validado; el nombre se sugiere, no se exige. */
export function descargarPerfil(perfil: CompanyProfile, nombreArchivo: string = NOMBRE_SUGERIDO_PERFIL): void {
  downloadBytes(
    new TextEncoder().encode(serializarPerfil(perfil)),
    nombreArchivo,
    'application/json',
  );
}
