// Diagnóstico de la política Patagonia (CP-F7-C2.4-A2.1/A2.2/A2.3/A2.4/A2.5/A2.6).
// Catálogo de solo lectura que explica por qué cada punto de
// `POLITICA_PATAGONIA_PRODUCTIVA` sigue pendiente. No contiene valores de política,
// defaults ni decisiones aprobadas embebidas: solo campo, requisito, responsables y origen
// de la información necesaria. El catálogo conserva los seis requisitos conocidos
// (incluidos P-20, PAT-4, PAT-9/P-14, PAT-15 y PAT-16) para poder diagnosticar cualquier
// evaluación; la lista de pendientes productivos excluye los cinco porque sus decisiones
// internas fueron aprobadas el 2026-11-04. La fachada lo usa para enriquecer
// `MAPEO_NO_RESUELTO` sin duplicar conciliación, readiness ni validaciones.
import type { PuntoPoliticaPatagonia } from './politica';

/** Quién debe resolver el punto. Un punto puede requerir más de un responsable. */
export type ResponsableRequisitoPatagonia = 'BANCO' | 'EMPRESA' | 'RRHH' | 'USUARIO';

/**
 * Naturaleza de la información necesaria. `INFORMACION_BANCARIA` no implica pedir una
 * consulta nueva: puede estar respaldada por documentación ya registrada y pendiente de
 * aprobación; `DECISION_INTERNA` es una decisión de empresa/producto; `DATO_DE_ENTRADA`
 * depende de los datos de la corrida o de su clasificación.
 */
export type OrigenRequisitoPatagonia =
  'INFORMACION_BANCARIA' | 'DECISION_INTERNA' | 'DATO_DE_ENTRADA';

/** Requisito trazable de un punto pendiente de la política. No incluye valores propuestos. */
export interface RequisitoPoliticaPatagonia {
  readonly punto: PuntoPoliticaPatagonia;
  readonly campo: string;
  readonly requisito: string;
  readonly responsables: readonly ResponsableRequisitoPatagonia[];
  readonly origenes: readonly OrigenRequisitoPatagonia[];
}

const REQUISITOS_POR_PUNTO: Record<PuntoPoliticaPatagonia, RequisitoPoliticaPatagonia> = {
  'P-20': {
    punto: 'P-20',
    campo:
      'R1 campo 2 (número de lote), R1 campo 5 (cantidad del lote) y R0 campo 7 (cantidad de lotes)',
    requisito:
      'Estrategia resuelta por decisión técnica interna del 2026-11-04 (ver F7_C2.4_DECISIONES): lotes consecutivos de hasta 999 pagos, en el orden original y numerados desde `0001`. El contrato sigue pendiente de homologación bancaria.',
    responsables: ['EMPRESA'],
    origenes: ['INFORMACION_BANCARIA', 'DECISION_INTERNA'],
  },
  'PAT-4': {
    punto: 'PAT-4',
    campo: 'R2 campo 12 (provincia del documento, posiciones 83–84)',
    requisito:
      'Provincia resuelta por decisión técnica interna del 2026-11-04 (ver F7_C2.4_DECISIONES): `00` cuando el tipo de documento no exige provincia; con tipo 004 se usa exclusivamente el dato válido del maestro. El contrato sigue pendiente de homologación bancaria.',
    responsables: ['EMPRESA', 'BANCO'],
    origenes: ['INFORMACION_BANCARIA', 'DECISION_INTERNA'],
  },
  'PAT-7/P-09/P-10': {
    punto: 'PAT-7/P-09/P-10',
    campo:
      'R2 campo 15 (tipo de liquidación, posiciones 101–103) y clasificación interna desde Descripcion',
    requisito:
      'Confirmar el catálogo del Anexo III aplicable a B.2 y definir el mapeo de las clasificaciones internas y la regla de extracción desde Descripcion.',
    responsables: ['BANCO', 'EMPRESA', 'USUARIO'],
    origenes: ['INFORMACION_BANCARIA', 'DECISION_INTERNA', 'DATO_DE_ENTRADA'],
  },
  'PAT-9/P-14': {
    punto: 'PAT-9/P-14',
    campo: 'R2 campo 7 (apellido y nombre, posiciones 35–54)',
    requisito:
      'Composición resuelta por decisión técnica interna del 2026-11-04 (ver F7_C2.4_DECISIONES): `APELLIDO NOMBRE`, un espacio, extremos recortados, espacios internos colapsados, mayúsculas, sin tildes/diéresis y Ñ→N, sin truncamiento; un resultado vacío, con caracteres no admitidos o de más de 20 caracteres bloquea. El contrato sigue pendiente de homologación bancaria.',
    responsables: ['EMPRESA', 'USUARIO'],
    origenes: ['DECISION_INTERNA'],
  },
  'PAT-15': {
    punto: 'PAT-15',
    campo: 'R0 campo 13 y R1 campo 10 (versión, posiciones 189–196)',
    requisito:
      'Versión resuelta por decisión técnica interna del 2026-11-04 (ver F7_C2.4_DECISIONES); el contrato sigue pendiente de homologación bancaria.',
    responsables: ['EMPRESA', 'BANCO'],
    origenes: ['INFORMACION_BANCARIA', 'DECISION_INTERNA'],
  },
  'PAT-16': {
    punto: 'PAT-16',
    campo: 'R2 campo 6 (número de comprobante, posiciones 28–34)',
    requisito:
      'Comprobante resuelto por decisión técnica interna del 2026-11-04 (ver F7_C2.4_DECISIONES): solo aplica a legajo ausente; un legajo presente inválido bloquea. El contrato sigue pendiente de homologación bancaria.',
    responsables: ['EMPRESA', 'BANCO'],
    origenes: ['INFORMACION_BANCARIA', 'DECISION_INTERNA', 'DATO_DE_ENTRADA'],
  },
};

/** Catálogo completo y de solo lectura de los seis requisitos conocidos. */
export const REQUISITOS_POLITICA_PATAGONIA: readonly RequisitoPoliticaPatagonia[] = Object.freeze(
  Object.values(REQUISITOS_POR_PUNTO),
);

/**
 * Puntos que siguen abiertos en la política productiva. P-20, PAT-4, PAT-9/P-14, PAT-15 y
 * PAT-16 no figuran porque sus decisiones internas ya fueron aprobadas (A2.5, A2.4, A2.6,
 * A2.2 y A2.3); el catálogo completo sí los conserva para poder diagnosticarlos si una
 * evaluación los devuelve sin resolución.
 */
const PUNTOS_PENDIENTES_PRODUCTIVOS: readonly PuntoPoliticaPatagonia[] = ['PAT-7/P-09/P-10'];

/** Lista de solo lectura del único requisito que sigue pendiente en producción. */
export const REQUISITOS_PENDIENTES_PATAGONIA: readonly RequisitoPoliticaPatagonia[] = Object.freeze(
  PUNTOS_PENDIENTES_PRODUCTIVOS.map((punto) => REQUISITOS_POR_PUNTO[punto]),
);

/**
 * Devuelve el requisito de cada punto recibido, en el mismo orden y sin duplicados.
 * No filtra por estado de aprobación: si una evaluación sintética o futura informa
 * P-20, PAT-4, PAT-15 o PAT-16 como `SIN_RESOLUCION`, el diagnóstico los describe igual. La
 * evaluación productiva normal no los recibe porque la política ya los resuelve. No
 * resuelve ni completa valores.
 */
export function diagnosticoPoliticaPatagonia(
  puntos: readonly PuntoPoliticaPatagonia[],
): readonly RequisitoPoliticaPatagonia[] {
  const vistos = new Set<PuntoPoliticaPatagonia>();
  const requisitos: RequisitoPoliticaPatagonia[] = [];
  for (const punto of puntos) {
    if (vistos.has(punto)) {
      continue;
    }
    vistos.add(punto);
    requisitos.push(REQUISITOS_POR_PUNTO[punto]);
  }
  return requisitos;
}
