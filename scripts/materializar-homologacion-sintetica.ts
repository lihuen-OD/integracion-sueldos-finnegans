// CLI manual CP-F7-D1-B. No se importa desde la aplicación, build, tests ni verify.
import { realpath } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import type { Readable, Writable } from 'node:stream';
import {
  NOMBRE_DIRECTORIO_PERMITIDO,
  formatearVistaPrevia,
  materializarPlanSintetico,
  prepararMaterializacionSintetica,
  type BancoHerramientaSintetica,
} from './lib/materializacionHomologacionSintetica.ts';

export interface OpcionesCliSintetica {
  readonly banco: BancoHerramientaSintetica;
  readonly variante: string;
}

export type ResultadoParseoCli =
  | { readonly ok: true; readonly value: OpcionesCliSintetica }
  | { readonly ok: false; readonly error: string };

export function parsearArgumentosCli(argumentos: readonly string[]): ResultadoParseoCli {
  let banco: string | null = null;
  let variante: string | null = null;
  for (let indice = 0; indice < argumentos.length; indice += 2) {
    const clave = argumentos[indice];
    const valor = argumentos[indice + 1];
    if (valor === undefined) {
      return { ok: false, error: `Falta valor para ${clave ?? 'argumento'}.` };
    }
    if (clave === '--banco' && banco === null) {
      banco = valor;
    } else if (clave === '--variante' && variante === null) {
      variante = valor;
    } else {
      return { ok: false, error: `Argumento no admitido o repetido: ${clave ?? ''}.` };
    }
  }
  if (banco !== 'BNA' && banco !== 'PATAGONIA') {
    return { ok: false, error: 'Use --banco BNA o --banco PATAGONIA.' };
  }
  if (variante === null || variante === '') {
    return { ok: false, error: 'Debe indicar --variante de forma explícita.' };
  }
  return { ok: true, value: { banco, variante } };
}

export async function main(
  argumentos: readonly string[] = process.argv.slice(2),
  entrada: Readable = process.stdin,
  salida: Writable = process.stdout,
  salidaError: Writable = process.stderr,
): Promise<number> {
  const opciones = parsearArgumentosCli(argumentos);
  if (!opciones.ok) {
    salidaError.write(`${opciones.error}\n`);
    salidaError.write(
      'Uso: npm run homologacion:sintetica -- --banco BNA|PATAGONIA --variante VALIDA\n',
    );
    return 2;
  }

  const preparacion = prepararMaterializacionSintetica(
    opciones.value.banco,
    opciones.value.variante,
  );
  if (preparacion.estado !== 'PREPARADA') {
    salidaError.write(
      `Preparación rechazada: ${preparacion.codigo}${preparacion.motivo === undefined ? '' : ` (${preparacion.motivo})`}\n`,
    );
    return 3;
  }

  const raizRepositorio = await realpath(fileURLToPath(new URL('..', import.meta.url)));
  const directorioPermitido = join(raizRepositorio, 'local-output', NOMBRE_DIRECTORIO_PERMITIDO);
  salida.write(`${formatearVistaPrevia(preparacion.plan)}\n`);
  salida.write(`Directorio permitido: ${directorioPermitido}\n`);
  salida.write('La herramienta no sobrescribe archivos existentes ni sigue symlinks.\n');
  salida.write(`Para confirmar escriba exactamente:\n${preparacion.plan.fraseConfirmacion}\n`);

  const interfaz = createInterface({ input: entrada, output: salida });
  let confirmacion: string;
  try {
    confirmacion = await interfaz.question('Confirmación: ');
  } finally {
    interfaz.close();
  }

  const resultado = await materializarPlanSintetico(
    preparacion.plan,
    confirmacion,
    directorioPermitido,
  );
  if (resultado.estado === 'CANCELADA') {
    salida.write('Cancelado: no se creó ningún archivo.\n');
    return 1;
  }
  if (resultado.estado === 'RECHAZADA') {
    salidaError.write(`Materialización rechazada: ${resultado.codigo}.\n`);
    return 4;
  }
  salida.write('Materialización sintética completada.\n');
  salida.write(`TXT: ${resultado.rutaArchivo}\n`);
  salida.write(`Manifiesto: ${resultado.rutaManifiesto}\n`);
  salida.write(`SHA-256 verificado: ${resultado.sha256Archivo}\n`);
  return 0;
}
