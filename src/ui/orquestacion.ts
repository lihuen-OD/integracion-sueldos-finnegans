// Orquestación centralizada de la corrida F3 (CP-F3-B): el ÚNICO punto donde la UI
// interactúa con el motor F2. La UI jamás construye las huellas del `Observado` a mano ni
// decide reglas de negocio: llama a estas funciones puras. El `FileFingerprint` de archivo
// (huella SHA-256 de los bytes leídos) y la `MasterRevisionFingerprint` de la revisión
// lógica vigente se mantienen separados (D-062): el puente productivo aprobado
// (`src/run/puente.ts`) es quien los arma. Importante para T3-11: la conciliación SIEMPRE
// usa los registros de la revisión lógica vigente (`lecturaMaestroVigente`), nunca
// directamente `estado.maestro.registros`.
import { parseFinnegans } from '../import/finnegans/parseFinnegans';
import { calcularHuella } from '../import/huella';
import { parseMaestro } from '../import/master/parseMaestro';
import type { ReadError, Workbook } from '../import/xlsx';
import type { LecturaFinnegans } from '../domain/liquidacion';
import type { LecturaMaestro } from '../domain/maestro';
import type { Destino } from '../domain/destino';
import { conciliar, type DecisionOperador, type ResultadoConciliacion } from '../reconciliation';
import type { EstadoCorrida } from '../run/corrida';
import { huellasConciliacionDelEstado } from '../run/puente';
import { decisionAsignarDestino, decisionConfirmarRevision } from '../reconciliation';
import type { Result } from '../shared/result';

/** Mensaje humano para un error de lectura de XLSX (sin valores de datos). */
export function mensajeErrorArchivo(error: ReadError): string {
  switch (error.kind) {
    case 'FILE_TOO_LARGE':
      return 'El archivo supera el tamaño máximo permitido.';
    case 'NOT_A_ZIP':
    case 'NOT_XLSX':
    case 'CORRUPT_ZIP':
      return 'El archivo no es un XLSX válido.';
    case 'TOO_MANY_ENTRIES':
    case 'UNCOMPRESSED_TOO_LARGE':
      return 'El archivo es demasiado grande al descomprimirse.';
    case 'PARSE_FAILED':
      return 'No se pudo interpretar el contenido del XLSX.';
    case 'TOO_MANY_ROWS':
      return `La hoja "${error.sheet}" supera el máximo de ${String(error.limit)} filas.`;
    case 'TOO_MANY_COLUMNS':
      return `La hoja "${error.sheet}" supera el máximo de ${String(error.limit)} columnas.`;
  }
}

async function leerLibro(bytes: Uint8Array): Promise<Result<Workbook, ReadError>> {
  // Carga diferida: ExcelJS solo se descarga del servidor local cuando se usa.
  const xlsx = await import('../import/xlsx');
  return xlsx.readWorkbook(bytes);
}

/** Finnegans leído: parse intacto de F2 + FileFingerprint de los bytes. */
export async function leerFinnegansDeArchivo(
  bytes: Uint8Array,
): Promise<
  Result<{ readonly lectura: LecturaFinnegans; readonly huellaArchivo: string }, ReadError>
> {
  const libro = await leerLibro(bytes);
  if (!libro.ok) {
    return libro;
  }
  return {
    ok: true,
    value: { lectura: parseFinnegans(libro.value), huellaArchivo: await calcularHuella(bytes) },
  };
}

/** Maestro leído: parse intacto de F2 + FileFingerprint de los bytes. La revisión lógica
 *  0 se arma al registrarlo en la corrida (`conMaestro`). */
export async function leerMaestroDeArchivo(
  bytes: Uint8Array,
): Promise<
  Result<{ readonly lectura: LecturaMaestro; readonly huellaArchivo: string }, ReadError>
> {
  const libro = await leerLibro(bytes);
  if (!libro.ok) {
    return libro;
  }
  return {
    ok: true,
    value: { lectura: parseMaestro(libro.value), huellaArchivo: await calcularHuella(bytes) },
  };
}

/** Lectura del maestro con los registros de la REVISIÓN lógica vigente (no los del archivo
 *  original). T3-11 la apunta a los registros editados; hoy coincide con la revisión 0. */
export function lecturaMaestroVigente(estado: EstadoCorrida): LecturaMaestro | null {
  const revision = estado.maestroRevision;
  if (revision === null) {
    return null;
  }
  const maestro = estado.maestro;
  return {
    hoja: maestro === null ? null : maestro.hoja,
    versionContrato: maestro === null ? null : maestro.versionContrato,
    registros: revision.registros,
    hallazgos: maestro === null ? [] : maestro.hallazgos,
  };
}

export type ErrorConciliacionCorrida = 'FINNEGANS_AUSENTE' | 'MAESTRO_AUSENTE';

/** Conciliación de la corrida a través del puente productivo aprobado (FIX 3). */
export async function conciliarCorrida(
  estado: EstadoCorrida,
): Promise<Result<ResultadoConciliacion, ErrorConciliacionCorrida>> {
  if (estado.finnegans === null) {
    return { ok: false, error: 'FINNEGANS_AUSENTE' };
  }
  const maestro = lecturaMaestroVigente(estado);
  if (maestro === null) {
    return { ok: false, error: 'MAESTRO_AUSENTE' };
  }
  const huellas = await huellasConciliacionDelEstado(estado);
  if (!huellas.ok) {
    return huellas;
  }
  return {
    ok: true,
    value: conciliar({
      finnegans: estado.finnegans,
      maestro,
      huellas: huellas.value,
      decisiones: estado.decisiones,
      ...(estado.perfil === null ? {} : { catalogoBancos: estado.perfil.catalogoBancos }),
    }),
  };
}

/** Próximo id de decisión de la corrida: determinista dentro de la corrida actual. */
export function proximoIdDecision(estado: EstadoCorrida): string {
  return `d-${String(estado.decisiones.length + 1)}`;
}

/** Crea una decisión ASSIGNAR_DESTINO del operador con id/momento de la corrida. */
export function crearDecisionAsignarDestino(
  estado: EstadoCorrida,
  incidencia: Parameters<typeof decisionAsignarDestino>[0],
  destino: Destino,
): DecisionOperador {
  return decisionAsignarDestino(incidencia, destino, {
    id: proximoIdDecision(estado),
    momento: new Date().toISOString(),
  });
}

/** Crea una decisión CONFIRMAR_REVISION del operador con id/momento de la corrida. */
export function crearDecisionConfirmarRevision(
  estado: EstadoCorrida,
  incidencia: Parameters<typeof decisionConfirmarRevision>[0],
): DecisionOperador {
  return decisionConfirmarRevision(incidencia, {
    id: proximoIdDecision(estado),
    momento: new Date().toISOString(),
  });
}
