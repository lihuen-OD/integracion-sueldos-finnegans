// Perfil de empresa: nombres exportables y exportadoras del módulo (contrato v1, D-059).
export type { CompanyProfile } from './contrato';
export { SCHEMA_VERSION_PERFIL } from './contrato';
export type { CodigoErrorPerfil, ErrorPerfil } from './validar';
export { parsePerfil, validarPerfil } from './validar';
export { plantillaPerfil, serializarPerfil, NOMBRE_SUGERIDO_PERFIL } from './plantilla';
export { perfilDesdeBytes, descargarPerfil } from './archivo';
