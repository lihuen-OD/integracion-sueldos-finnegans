// Contrato v1 de MAESTRO_CUENTAS_EMPLEADOS.xlsx (docs/03 §B): hojas, columnas y claves.
import { CAMPOS_BANCARIOS } from '../../domain/maestro';

export const NOMBRE_ARCHIVO_MAESTRO = 'MAESTRO_CUENTAS_EMPLEADOS.xlsx';

export const HOJA_EMPLEADOS = 'Empleados';
export const HOJA_INSTRUCCIONES = 'Instrucciones';
export const HOJA_CATALOGOS = 'Catalogos';
export const HOJA_CONTROL = 'Control';

/** Clave de la hoja Control que fija la versión del contrato (D-051). */
export const CLAVE_VERSION_CONTRATO = 'VERSION_CONTRATO';

/** Referencia informativa copiada desde la columna Banco de Finnegans (CP-F8-D).
 * No forma parte de los datos bancarios consumidos por ningún destino. */
export const COLUMNA_BANCO_REFERENCIA = 'BANCO_REFERENCIA' as const;

/** Columnas de la hoja Empleados, en orden (docs/03 §B.1). */
export const COLUMNAS_MAESTRO = [
  'CUIL',
  'LEGAJO',
  'APELLIDO_NOMBRE_REF',
  COLUMNA_BANCO_REFERENCIA,
  ...CAMPOS_BANCARIOS,
] as const;
export type ColumnaMaestro = (typeof COLUMNAS_MAESTRO)[number];

/** Columnas cuya ausencia no bloquea: los maestros v1 anteriores siguen siendo válidos. */
export const COLUMNAS_OPCIONALES = [
  'APELLIDO_NOMBRE_REF',
  COLUMNA_BANCO_REFERENCIA,
] as const satisfies readonly ColumnaMaestro[];
