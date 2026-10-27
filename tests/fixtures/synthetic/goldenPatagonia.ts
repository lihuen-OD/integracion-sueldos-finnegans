// Escenario 100 % sintético para el golden técnico Patagonia B.2 (CP-F6-C). No contiene
// CUIT/CUIL/cuentas literales: todo se genera en ejecución (D-042). La política, la
// aptitud y el loteo sintéticos son HIPÓTESIS DE TEST y no modifican la spec, los issues
// ni la habilitación productiva. El golden compone las capas técnicas directamente y
// NUNCA pasa por la fachada productiva.
import type {
  LotePropuestoPatagonia,
  PagoPatagonia,
  ParametrosEnvioPatagonia,
  PerfilPatagonia,
} from '../../../src/banks/patagonia-b2';
import type { CompanyProfileV3 } from '../../../src/profile';
import type { ResultadoConciliacion } from '../../../src/reconciliation';
import {
  pagosPatagoniaDesdeConciliacion,
  perfilPatagoniaDesdePerfil,
} from '../../../src/run/generacionPatagonia';
import { perfilV2Golden } from './goldenBna.ts';
import { escenario } from '../../unit/reconciliation/helpers.ts';
import { BANCO_PATAGONIA } from './finnegansLike.ts';
import { filaFinnegans, personas, registroPatagonia } from './escenarios.ts';
import { createRandom } from './identities.ts';
import { loteSintetico } from '../../unit/banks/patagonia-b2/auxiliares.ts';

/** Perfil v3 sintético: conserva el bloque BNA de v2 y agrega solo EMPRESA Patagonia. */
export function perfilV3Golden(): CompanyProfileV3 {
  const v2 = perfilV2Golden();
  return {
    schemaVersion: '3',
    cuitEmpresa: v2.cuitEmpresa,
    nombreEmpresa: v2.nombreEmpresa,
    catalogoBancos: v2.catalogoBancos,
    bna: v2.bna,
    patagonia: { numeroEmpresa: '1234' },
    mapeosLiquidacion: [],
  };
}

/** Dos personas Patagonia con cuentas y documentos sintéticos, sin incidencias. */
export function conciliacionGoldenPatagonia(): ResultadoConciliacion {
  const random = createRandom(2026);
  const gente = personas(2, 2026);
  const filas = gente.map((persona) => filaFinnegans(persona, { Banco: BANCO_PATAGONIA }));
  const registros = gente.map((persona) => registroPatagonia(persona, random));
  return escenario(filas, registros);
}

/** Perfil técnico Patagonia derivado del perfil v3 sintético. */
export function perfilPatagoniaGolden(): PerfilPatagonia {
  return perfilPatagoniaDesdePerfil(perfilV3Golden());
}

/** Pagos Patagonia derivados de la conciliación sintética, en orden y con SourceRef. */
export function pagosGoldenPatagonia(): readonly PagoPatagonia[] {
  return pagosPatagoniaDesdeConciliacion(conciliacionGoldenPatagonia());
}

/** Parámetros explícitos del golden: LF, sin salto final, PAT-1 espacios y PAT-2 numérica. */
export function parametrosGoldenPatagonia(): ParametrosEnvioPatagonia {
  return {
    fechaPresentacion: '20261027',
    fechaAcreditacion: '20261030',
    numeroEnvio: '1',
    concepto: 'HAB.05/00',
    hipotesisRellenoPat1: 'ESPACIOS',
    hipotesisDependenciaPat2: 'NUMERICA',
    lineSeparator: '\n',
    trailingSeparator: false,
  };
}

/** Golden con dos lotes de un pago cada uno para mostrar cantidades > 1 sin ambigüedad. */
export function lotesGoldenPatagonia(
  pagos: readonly PagoPatagonia[],
): readonly LotePropuestoPatagonia[] {
  const primero = pagos[0];
  const segundo = pagos[1];
  if (primero === undefined || segundo === undefined) {
    throw new Error('el golden Patagonia requiere exactamente dos pagos');
  }
  return [loteSintetico('0001', [primero]), loteSintetico('0002', [segundo])];
}
