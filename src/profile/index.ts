// Perfil de empresa: nombres exportables y exportadoras del módulo (v1 D-059, v2 D-079, v3 D-087).
export type {
  CompanyProfile,
  CompanyProfileImportado,
  CompanyProfileV2,
  CompanyProfileV3,
} from './contrato';
export {
  SCHEMA_VERSION_PERFIL,
  SCHEMA_VERSION_PERFIL_V2,
  SCHEMA_VERSION_PERFIL_V3,
} from './contrato';
export type { CodigoErrorPerfil, ErrorPerfil } from './validar';
export {
  parsePerfil,
  parsePerfilVersionado,
  validarPerfil,
  validarPerfilV2,
  validarPerfilV3,
  validarPerfilVersionado,
} from './validar';
export {
  plantillaPerfil,
  serializarPerfil,
  serializarPerfilV2,
  serializarPerfilV3,
  serializarPerfilVersionado,
  NOMBRE_SUGERIDO_PERFIL,
} from './plantilla';
export {
  perfilDesdeBytes,
  perfilVersionadoDesdeBytes,
  descargarPerfil,
  descargarPerfilVersionado,
} from './archivo';
