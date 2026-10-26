// Perfil de empresa: nombres exportables y exportadoras del módulo (contrato v1, D-059).
export type { CompanyProfile, CompanyProfileImportado, CompanyProfileV2 } from './contrato';
export { SCHEMA_VERSION_PERFIL, SCHEMA_VERSION_PERFIL_V2 } from './contrato';
export type { CodigoErrorPerfil, ErrorPerfil } from './validar';
export {
  parsePerfil,
  parsePerfilVersionado,
  validarPerfil,
  validarPerfilV2,
  validarPerfilVersionado,
} from './validar';
export {
  plantillaPerfil,
  serializarPerfil,
  serializarPerfilV2,
  serializarPerfilVersionado,
  NOMBRE_SUGERIDO_PERFIL,
} from './plantilla';
export {
  perfilDesdeBytes,
  perfilVersionadoDesdeBytes,
  descargarPerfil,
  descargarPerfilVersionado,
} from './archivo';
