// Contrato v1 de MAESTRO_CUENTAS_EMPLEADOS.xlsx (docs/03 §B): hojas, columnas y claves.
import { CAMPOS_BANCARIOS } from '../../domain/maestro';

export const NOMBRE_ARCHIVO_MAESTRO = 'MAESTRO_CUENTAS_EMPLEADOS.xlsx';

export const HOJA_EMPLEADOS = 'Empleados';
export const HOJA_INSTRUCCIONES = 'Instrucciones';
export const HOJA_CATALOGOS = 'Catalogos';
export const HOJA_CONTROL = 'Control';

/** Clave de la hoja Control que fija la versión del contrato (D-051). */
export const CLAVE_VERSION_CONTRATO = 'VERSION_CONTRATO';

/** Columnas de la hoja Empleados, en orden (docs/03 §B.1). */
export const COLUMNAS_MAESTRO = [
  'CUIL',
  'LEGAJO',
  'APELLIDO_NOMBRE_REF',
  ...CAMPOS_BANCARIOS,
] as const;
export type ColumnaMaestro = (typeof COLUMNAS_MAESTRO)[number];

/** Única columna cuya ausencia no bloquea: es solo referencia humana (§B.3). */
export const COLUMNA_OPCIONAL: ColumnaMaestro = 'APELLIDO_NOMBRE_REF';
