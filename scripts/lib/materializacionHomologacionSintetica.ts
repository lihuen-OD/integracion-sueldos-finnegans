// CP-F7-D1-B: preparación y escritura controlada de los bytes cerrados de D1-A.
// No recibe pagos, corridas, perfiles ni archivos de entrada. La CLI es el único llamador
// operativo y fija el directorio permitido; las pruebas inyectan solo directorios temporales.
import { createHash } from 'node:crypto';
import { lstat, mkdir, open, readFile, realpath, unlink, type FileHandle } from 'node:fs/promises';
import type { Stats } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve, sep } from 'node:path';
import {
  VARIANTES_BNA,
  VARIANTES_PATAGONIA,
  componerBnaHomologacionSintetica,
  componerPatagoniaHomologacionSintetica,
  type ComposicionBnaSinteticaCompleta,
  type ComposicionPatagoniaSinteticaCompleta,
  type VarianteBnaSintetica,
  type VariantePatagoniaSintetica,
} from '../../src/run/composicionHomologacionSintetica.ts';

export type BancoHerramientaSintetica = 'BNA' | 'PATAGONIA';
export type VarianteHerramientaSintetica = VarianteBnaSintetica | VariantePatagoniaSintetica;

export const ADVERTENCIA_ARCHIVO_SINTETICO =
  'ARCHIVO SINTÉTICO, NO PRODUCTIVO — NO HOMOLOGADO' as const;
export const NOMBRE_ARCHIVO_BNA_SINTETICO = 'PRUEBA_SINTETICA_BNA_GT200_NO_PRODUCTIVA.TXT' as const;
export const NOMBRE_ARCHIVO_PATAGONIA_SINTETICO = 'ACREXXXX.TXT' as const;
export const NOMBRE_DIRECTORIO_PERMITIDO = 'homologacion-sintetica' as const;

export interface ResumenInspeccionSeguro {
  readonly estado: 'OK';
  readonly registros: number;
  readonly cantidadPagos: number;
  readonly cantidadLotes?: number;
}

const MARCA_PLAN = Symbol('PLAN_MATERIALIZACION_SINTETICA_D1_B');
const PLANES_CREADOS = new WeakSet<object>();

/**
 * El plan no puede construirse estructuralmente fuera de este módulo por la marca privada.
 * `bytes` se expone solo para comprobar que una alteración posterior a la inspección se rechaza.
 */
export interface PlanMaterializacionSintetica {
  readonly [MARCA_PLAN]: true;
  readonly banco: BancoHerramientaSintetica;
  readonly variante: VarianteHerramientaSintetica;
  readonly nombreArchivo: string;
  readonly cantidadBytes: number;
  readonly sha256Preparado: string;
  readonly inspeccion: ResumenInspeccionSeguro;
  readonly advertencia: typeof ADVERTENCIA_ARCHIVO_SINTETICO;
  readonly fraseConfirmacion: string;
  readonly bytes: Uint8Array;
}

export type CodigoRechazoPreparacion =
  'BANCO_NO_ADMITIDO' | 'VARIANTE_NO_ADMITIDA' | 'HARNESS_D1_A_RECHAZO';

export type ResultadoPreparacionMaterializacion =
  | { readonly estado: 'PREPARADA'; readonly plan: PlanMaterializacionSintetica }
  | {
      readonly estado: 'RECHAZADA';
      readonly codigo: CodigoRechazoPreparacion;
      readonly motivo?: string;
    };

export type CodigoRechazoMaterializacion =
  | 'PLAN_NO_AUTENTICO'
  | 'RUTA_NO_PERMITIDA'
  | 'DIRECTORIO_INSEGURO'
  | 'ARCHIVO_EXISTENTE'
  | 'BYTES_ALTERADOS'
  | 'REINSPECCION_RECHAZADA'
  | 'ERROR_ESCRITURA'
  | 'HASH_ARCHIVO_DISTINTO';

export interface ManifiestoHomologacionSintetica {
  readonly schemaVersion: '1';
  readonly advertencia: typeof ADVERTENCIA_ARCHIVO_SINTETICO;
  readonly banco: BancoHerramientaSintetica;
  readonly variante: VarianteHerramientaSintetica;
  readonly nombreArchivo: string;
  readonly cantidadBytes: number;
  readonly sha256: string;
  readonly inspeccion: ResumenInspeccionSeguro;
  readonly sintetico: true;
  readonly productivo: false;
  readonly homologado: false;
  readonly confirmacionHumana: true;
  readonly creadoEn: string;
}

export type ResultadoMaterializacionSintetica =
  | { readonly estado: 'CANCELADA'; readonly motivo: 'CONFIRMACION_NO_COINCIDE' }
  | {
      readonly estado: 'RECHAZADA';
      readonly codigo: CodigoRechazoMaterializacion;
      readonly motivo?: string;
    }
  | {
      readonly estado: 'MATERIALIZADA';
      readonly rutaArchivo: string;
      readonly rutaManifiesto: string;
      readonly cantidadBytes: number;
      readonly sha256Preparado: string;
      readonly sha256AntesEscritura: string;
      readonly sha256Archivo: string;
      readonly inspeccion: ResumenInspeccionSeguro;
    };

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function bytesIguales(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  return a.every((byte, indice) => byte === b[indice]);
}

function varianteBna(valor: string): valor is VarianteBnaSintetica {
  return (VARIANTES_BNA as readonly string[]).includes(valor);
}

function variantePatagonia(valor: string): valor is VariantePatagoniaSintetica {
  return (VARIANTES_PATAGONIA as readonly string[]).includes(valor);
}

function resumenBna(composicion: ComposicionBnaSinteticaCompleta): ResumenInspeccionSeguro {
  return {
    estado: 'OK',
    registros: composicion.inspeccion.registros.length,
    cantidadPagos: composicion.inspeccion.cantidadCalculada,
  };
}

function resumenPatagonia(
  composicion: ComposicionPatagoniaSinteticaCompleta,
): ResumenInspeccionSeguro {
  return {
    estado: 'OK',
    registros: composicion.inspeccion.registros.length,
    cantidadPagos: composicion.inspeccion.cantidadPagosCalculada,
    cantidadLotes: composicion.inspeccion.cantidadLotesCalculada,
  };
}

function fraseConfirmacion(nombreArchivo: string, hash: string): string {
  return `CONFIRMO ARCHIVO SINTETICO NO PRODUCTIVO ${nombreArchivo} ${hash}`;
}

function crearPlan(
  banco: BancoHerramientaSintetica,
  variante: VarianteHerramientaSintetica,
  nombreArchivo: string,
  bytesOrigen: Uint8Array,
  inspeccion: ResumenInspeccionSeguro,
): PlanMaterializacionSintetica {
  const bytes = bytesOrigen.slice();
  const hash = sha256(bytes);
  const plan: PlanMaterializacionSintetica = {
    [MARCA_PLAN]: true,
    banco,
    variante,
    nombreArchivo,
    cantidadBytes: bytes.byteLength,
    sha256Preparado: hash,
    inspeccion,
    advertencia: ADVERTENCIA_ARCHIVO_SINTETICO,
    fraseConfirmacion: fraseConfirmacion(nombreArchivo, hash),
    bytes,
  };
  PLANES_CREADOS.add(plan);
  return Object.freeze(plan);
}

/** Prepara bytes e inspección sin crear directorios ni escribir archivos. */
export function prepararMaterializacionSintetica(
  banco: string,
  variante: string,
): ResultadoPreparacionMaterializacion {
  if (banco !== 'BNA' && banco !== 'PATAGONIA') {
    return { estado: 'RECHAZADA', codigo: 'BANCO_NO_ADMITIDO' };
  }
  if (banco === 'BNA') {
    if (!varianteBna(variante)) {
      return { estado: 'RECHAZADA', codigo: 'VARIANTE_NO_ADMITIDA' };
    }
    const composicion = componerBnaHomologacionSintetica(variante);
    if (composicion.estado !== 'COMPUESTA_EN_MEMORIA') {
      return {
        estado: 'RECHAZADA',
        codigo: 'HARNESS_D1_A_RECHAZO',
        motivo: composicion.codigo,
      };
    }
    return {
      estado: 'PREPARADA',
      plan: crearPlan(
        banco,
        variante,
        NOMBRE_ARCHIVO_BNA_SINTETICO,
        composicion.bytes,
        resumenBna(composicion),
      ),
    };
  }

  if (!variantePatagonia(variante)) {
    return { estado: 'RECHAZADA', codigo: 'VARIANTE_NO_ADMITIDA' };
  }
  const composicion = componerPatagoniaHomologacionSintetica(variante);
  if (composicion.estado !== 'COMPUESTA_EN_MEMORIA') {
    return {
      estado: 'RECHAZADA',
      codigo: 'HARNESS_D1_A_RECHAZO',
      motivo: composicion.codigo,
    };
  }
  return {
    estado: 'PREPARADA',
    plan: crearPlan(
      banco,
      variante,
      NOMBRE_ARCHIVO_PATAGONIA_SINTETICO,
      composicion.bytes,
      resumenPatagonia(composicion),
    ),
  };
}

export function formatearVistaPrevia(plan: PlanMaterializacionSintetica): string {
  const lotes =
    plan.inspeccion.cantidadLotes === undefined
      ? ''
      : ` · lotes=${String(plan.inspeccion.cantidadLotes)}`;
  return [
    `*** ${plan.advertencia} ***`,
    `Banco: ${plan.banco}`,
    `Variante sintética: ${plan.variante}`,
    `Nombre: ${plan.nombreArchivo}`,
    `Bytes: ${String(plan.cantidadBytes)}`,
    `SHA-256: ${plan.sha256Preparado}`,
    `Inspección: ${plan.inspeccion.estado} · registros=${String(plan.inspeccion.registros)} · pagos=${String(plan.inspeccion.cantidadPagos)}${lotes}`,
  ].join('\n');
}

async function lstatOpcional(ruta: string): Promise<Stats | null> {
  try {
    return await lstat(ruta);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

function rutaPermitida(ruta: string): boolean {
  if (!isAbsolute(ruta) || resolve(ruta) !== ruta) return false;
  if (ruta.split(/[\\/]+/).includes('..')) return false;
  return basename(ruta) === NOMBRE_DIRECTORIO_PERMITIDO && ruta !== sep;
}

/** Crea solo componentes inexistentes y rechaza cualquier ancestro resuelto por symlink. */
async function asegurarDirectorioSeguro(ruta: string): Promise<boolean> {
  const faltantes: string[] = [];
  let actual = ruta;
  let estado = await lstatOpcional(actual);
  while (estado === null) {
    faltantes.push(actual);
    const padre = dirname(actual);
    if (padre === actual) return false;
    actual = padre;
    estado = await lstatOpcional(actual);
  }
  if (estado.isSymbolicLink() || !estado.isDirectory()) return false;
  if ((await realpath(actual)) !== actual) return false;
  for (const directorio of faltantes.reverse()) {
    await mkdir(directorio, { mode: 0o700 });
    const estado = await lstat(directorio);
    if (estado.isSymbolicLink() || !estado.isDirectory()) return false;
    if ((await realpath(directorio)) !== directorio) return false;
  }
  return true;
}

function nombreSeguro(nombre: string): boolean {
  return (
    basename(nombre) === nombre &&
    !nombre.includes('/') &&
    !nombre.includes('\\') &&
    /^[A-Z0-9_]+\.TXT$/.test(nombre)
  );
}

async function cerrar(handle: FileHandle | null): Promise<void> {
  if (handle === null) return;
  try {
    await handle.close();
  } catch {
    // El flujo de rechazo conserva el error original y luego elimina solo rutas propias.
  }
}

async function eliminarPropio(ruta: string | null): Promise<void> {
  if (ruta === null) return;
  try {
    await unlink(ruta);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

function recomponer(plan: PlanMaterializacionSintetica):
  | {
      readonly estado: 'OK';
      readonly bytes: Uint8Array;
      readonly inspeccion: ResumenInspeccionSeguro;
    }
  | { readonly estado: 'ERROR' } {
  if (plan.banco === 'BNA' && varianteBna(plan.variante)) {
    const resultado = componerBnaHomologacionSintetica(plan.variante);
    return resultado.estado === 'COMPUESTA_EN_MEMORIA'
      ? { estado: 'OK', bytes: resultado.bytes, inspeccion: resumenBna(resultado) }
      : { estado: 'ERROR' };
  }
  if (plan.banco === 'PATAGONIA' && variantePatagonia(plan.variante)) {
    const resultado = componerPatagoniaHomologacionSintetica(plan.variante);
    return resultado.estado === 'COMPUESTA_EN_MEMORIA'
      ? { estado: 'OK', bytes: resultado.bytes, inspeccion: resumenPatagonia(resultado) }
      : { estado: 'ERROR' };
  }
  return { estado: 'ERROR' };
}

function manifiestoDe(
  plan: PlanMaterializacionSintetica,
  hash: string,
  inspeccion: ResumenInspeccionSeguro,
): ManifiestoHomologacionSintetica {
  return {
    schemaVersion: '1',
    advertencia: ADVERTENCIA_ARCHIVO_SINTETICO,
    banco: plan.banco,
    variante: plan.variante,
    nombreArchivo: plan.nombreArchivo,
    cantidadBytes: plan.cantidadBytes,
    sha256: hash,
    inspeccion,
    sintetico: true,
    productivo: false,
    homologado: false,
    confirmacionHumana: true,
    creadoEn: new Date().toISOString(),
  };
}

/**
 * Escribe con `wx` solo después de confirmar, recomponer, reinspeccionar y recalcular el hash.
 * Nunca sobrescribe; ante un fallo elimina exclusivamente los archivos que abrió en esta llamada.
 */
export async function materializarPlanSintetico(
  plan: PlanMaterializacionSintetica,
  confirmacion: string,
  directorioPermitido: string,
): Promise<ResultadoMaterializacionSintetica> {
  if (!PLANES_CREADOS.has(plan)) {
    return { estado: 'RECHAZADA', codigo: 'PLAN_NO_AUTENTICO' };
  }
  if (confirmacion !== plan.fraseConfirmacion) {
    return { estado: 'CANCELADA', motivo: 'CONFIRMACION_NO_COINCIDE' };
  }
  if (!rutaPermitida(directorioPermitido) || !nombreSeguro(plan.nombreArchivo)) {
    return { estado: 'RECHAZADA', codigo: 'RUTA_NO_PERMITIDA' };
  }

  const fresco = recomponer(plan);
  if (fresco.estado !== 'OK') {
    return { estado: 'RECHAZADA', codigo: 'REINSPECCION_RECHAZADA' };
  }
  const hashPlanActual = sha256(plan.bytes);
  const hashFresco = sha256(fresco.bytes);
  if (
    plan.bytes.byteLength !== plan.cantidadBytes ||
    hashPlanActual !== plan.sha256Preparado ||
    fresco.bytes.byteLength !== plan.cantidadBytes ||
    hashFresco !== plan.sha256Preparado ||
    !bytesIguales(plan.bytes, fresco.bytes)
  ) {
    return { estado: 'RECHAZADA', codigo: 'BYTES_ALTERADOS' };
  }

  try {
    if (!(await asegurarDirectorioSeguro(directorioPermitido))) {
      return { estado: 'RECHAZADA', codigo: 'DIRECTORIO_INSEGURO' };
    }
  } catch {
    return { estado: 'RECHAZADA', codigo: 'DIRECTORIO_INSEGURO' };
  }

  const rutaArchivo = join(directorioPermitido, plan.nombreArchivo);
  const rutaManifiesto = join(directorioPermitido, `${plan.nombreArchivo}.manifest.json`);
  if (
    dirname(rutaArchivo) !== directorioPermitido ||
    dirname(rutaManifiesto) !== directorioPermitido
  ) {
    return { estado: 'RECHAZADA', codigo: 'RUTA_NO_PERMITIDA' };
  }
  if (
    (await lstatOpcional(rutaArchivo)) !== null ||
    (await lstatOpcional(rutaManifiesto)) !== null
  ) {
    return { estado: 'RECHAZADA', codigo: 'ARCHIVO_EXISTENTE' };
  }

  let archivoHandle: FileHandle | null = null;
  let manifiestoHandle: FileHandle | null = null;
  let archivoCreado: string | null = null;
  let manifiestoCreado: string | null = null;
  try {
    archivoHandle = await open(rutaArchivo, 'wx', 0o600);
    archivoCreado = rutaArchivo;
    manifiestoHandle = await open(rutaManifiesto, 'wx', 0o600);
    manifiestoCreado = rutaManifiesto;

    // Último control antes de la escritura. `fresco.bytes` no se expone al llamador.
    const sha256AntesEscritura = sha256(fresco.bytes);
    if (
      sha256AntesEscritura !== plan.sha256Preparado ||
      sha256(plan.bytes) !== plan.sha256Preparado ||
      !bytesIguales(plan.bytes, fresco.bytes)
    ) {
      await cerrar(archivoHandle);
      archivoHandle = null;
      await cerrar(manifiestoHandle);
      manifiestoHandle = null;
      await eliminarPropio(archivoCreado);
      await eliminarPropio(manifiestoCreado);
      return { estado: 'RECHAZADA', codigo: 'BYTES_ALTERADOS' };
    }

    await archivoHandle.writeFile(fresco.bytes);
    await archivoHandle.sync();
    await archivoHandle.close();
    archivoHandle = null;

    const estadoGuardado = await lstat(rutaArchivo);
    if (estadoGuardado.isSymbolicLink() || !estadoGuardado.isFile()) {
      throw new Error('archivo guardado inseguro');
    }
    const bytesGuardados = await readFile(rutaArchivo);
    const sha256Archivo = sha256(bytesGuardados);
    if (
      bytesGuardados.byteLength !== plan.cantidadBytes ||
      sha256Archivo !== sha256AntesEscritura
    ) {
      await cerrar(manifiestoHandle);
      manifiestoHandle = null;
      await eliminarPropio(archivoCreado);
      await eliminarPropio(manifiestoCreado);
      return { estado: 'RECHAZADA', codigo: 'HASH_ARCHIVO_DISTINTO' };
    }

    const manifiesto = manifiestoDe(plan, sha256Archivo, fresco.inspeccion);
    await manifiestoHandle.writeFile(`${JSON.stringify(manifiesto, null, 2)}\n`, 'utf8');
    await manifiestoHandle.sync();
    await manifiestoHandle.close();
    manifiestoHandle = null;

    return {
      estado: 'MATERIALIZADA',
      rutaArchivo,
      rutaManifiesto,
      cantidadBytes: bytesGuardados.byteLength,
      sha256Preparado: plan.sha256Preparado,
      sha256AntesEscritura,
      sha256Archivo,
      inspeccion: fresco.inspeccion,
    };
  } catch (error) {
    const codigo = (error as NodeJS.ErrnoException).code;
    await cerrar(archivoHandle);
    await cerrar(manifiestoHandle);
    await eliminarPropio(archivoCreado);
    await eliminarPropio(manifiestoCreado);
    return {
      estado: 'RECHAZADA',
      codigo: codigo === 'EEXIST' ? 'ARCHIVO_EXISTENTE' : 'ERROR_ESCRITURA',
    };
  }
}
