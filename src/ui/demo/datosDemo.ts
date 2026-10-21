// MODO DEMO — EXCLUSIVAMENTE DESARROLLO (CP-F3-B, revisión visual). Solo se alcanza con
// `import.meta.env.DEV` (guard en App.tsx): el build de producción no lo incluye.
// Genera una corrida sintética completa (espejoMuestra: 156 filas, 1 banco vacío, 1 neto
// cero, maestro completo) con valores sintéticos construidos en runtime (D-042). Sin red,
// sin persistencia: mismo camino que una carga manual de archivos.
import {
  espejoMuestra,
  finnegansXlsx,
  maestroXlsx,
} from '../../../tests/fixtures/synthetic/escenarios';
import { parseCuitEmpresa, type CuitEmpresaEstructural } from '../../domain/cuitEmpresa';
import { plantillaPerfil } from '../../profile/plantilla';
import type { CompanyProfile } from '../../profile/contrato';
import type { LecturaFinnegans } from '../../domain/liquidacion';
import type { LecturaMaestro } from '../../domain/maestro';
import { leerFinnegansDeArchivo, leerMaestroDeArchivo } from '../orquestacion';

export interface CorridaDemo {
  readonly finnegans: { readonly lectura: LecturaFinnegans; readonly huellaArchivo: string };
  readonly maestro: { readonly lectura: LecturaMaestro; readonly huellaArchivo: string };
  readonly perfil: CompanyProfile;
}

/** CUIT de la empresa demo, armado por partes en runtime (D-042: nada con forma CUIT/CUIL
 *  versionado). Estructura válida; el DV no se verifica (D-061, P-18). */
function cuitDemo(): CuitEmpresaEstructural {
  const texto = ['30', '45678901', '3'].join('-');
  const parseado = parseCuitEmpresa(texto);
  if (!parseado.ok) {
    throw new Error('El CUIT de demo dejó de ser estructuralmente válido.');
  }
  return parseado.value;
}

export async function correrDemo(): Promise<CorridaDemo> {
  const muestra = espejoMuestra(20261020);
  const bytesFinnegans = finnegansXlsx(muestra.filas);
  const bytesMaestro = maestroXlsx(muestra.registros);
  const finnegans = await leerFinnegansDeArchivo(bytesFinnegans);
  if (!finnegans.ok) {
    throw new Error(`Los datos demo de Finnegans fallaron: ${finnegans.error.kind}`);
  }
  const maestro = await leerMaestroDeArchivo(bytesMaestro);
  if (!maestro.ok) {
    throw new Error(`Los datos demo del maestro fallaron: ${maestro.error.kind}`);
  }
  return {
    finnegans: { lectura: finnegans.value.lectura, huellaArchivo: finnegans.value.huellaArchivo },
    maestro: { lectura: maestro.value.lectura, huellaArchivo: maestro.value.huellaArchivo },
    perfil: plantillaPerfil(cuitDemo()),
  };
}
