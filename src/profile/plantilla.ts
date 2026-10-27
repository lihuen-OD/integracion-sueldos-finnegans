// Serialización y plantilla del perfil v1 (D-059): solo se exporta un perfil VÁLIDO.
// La serialización es determinista (claves en el orden del contrato, sangría fija). El
// nombre sugerido del archivo es solo una sugerencia y NO forma parte del contrato.
import { CATALOGO_BANCOS } from '../domain/destino';
import type {
  CompanyProfile,
  CompanyProfileImportado,
  CompanyProfileV2,
  CompanyProfileV3,
} from './contrato';

/** Nombre sugerido para descargar el perfil (el import no lo exige; D-059). */
export const NOMBRE_SUGERIDO_PERFIL = 'PERFIL_EMPRESA.json';

/**
 * Serialización canónica: JSON con las claves del contrato en orden, sangría de 2 espacios y
 * salto final. Determinista y sin valores variables: mismos datos → mismos bytes.
 */
export function serializarPerfil(perfil: CompanyProfile): string {
  const documento = {
    schemaVersion: perfil.schemaVersion,
    cuitEmpresa: perfil.cuitEmpresa,
    nombreEmpresa: perfil.nombreEmpresa,
    catalogoBancos: perfil.catalogoBancos.map((banco) => ({
      textoFinnegans: banco.textoFinnegans,
      destino: banco.destino,
      entidadEsperada: banco.entidadEsperada,
      fuente: banco.fuente,
    })),
    mapeosLiquidacion: perfil.mapeosLiquidacion,
  };
  return `${JSON.stringify(documento, null, 2)}\n`;
}

/** Serialización canónica del perfil v2: mismas reglas deterministas, versión real "2". */
export function serializarPerfilV2(perfil: CompanyProfileV2): string {
  const documento = {
    schemaVersion: perfil.schemaVersion,
    cuitEmpresa: perfil.cuitEmpresa,
    nombreEmpresa: perfil.nombreEmpresa,
    catalogoBancos: perfil.catalogoBancos.map((banco) => ({
      textoFinnegans: banco.textoFinnegans,
      destino: banco.destino,
      entidadEsperada: banco.entidadEsperada,
      fuente: banco.fuente,
    })),
    bna: {
      cbuEmpresa: perfil.bna.cbuEmpresa,
      codigoConvenio: perfil.bna.codigoConvenio,
      moneda: perfil.bna.moneda,
    },
    mapeosLiquidacion: perfil.mapeosLiquidacion,
  };
  return `${JSON.stringify(documento, null, 2)}\n`;
}

/** Serialización canónica del perfil v3: versión real "3" y bloque Patagonia explícito. */
export function serializarPerfilV3(perfil: CompanyProfileV3): string {
  const documento = {
    schemaVersion: perfil.schemaVersion,
    cuitEmpresa: perfil.cuitEmpresa,
    nombreEmpresa: perfil.nombreEmpresa,
    catalogoBancos: perfil.catalogoBancos.map((banco) => ({
      textoFinnegans: banco.textoFinnegans,
      destino: banco.destino,
      entidadEsperada: banco.entidadEsperada,
      fuente: banco.fuente,
    })),
    bna: {
      cbuEmpresa: perfil.bna.cbuEmpresa,
      codigoConvenio: perfil.bna.codigoConvenio,
      moneda: perfil.bna.moneda,
    },
    patagonia: {
      numeroEmpresa: perfil.patagonia.numeroEmpresa,
    },
    mapeosLiquidacion: perfil.mapeosLiquidacion,
  };
  return `${JSON.stringify(documento, null, 2)}\n`;
}

/** Exporta la versión real del perfil, sin convertir entre v1, v2 y v3 (D-079, D-087). */
export function serializarPerfilVersionado(perfil: CompanyProfileImportado): string {
  if (perfil.schemaVersion === '1') {
    return serializarPerfil(perfil);
  }
  if (perfil.schemaVersion === '2') {
    return serializarPerfilV2(perfil);
  }
  return serializarPerfilV3(perfil);
}

/**
 * Plantilla de perfil válida con cuit provisto por quien llama (los tests y el futuro UI
 * la generan con valor sintético; la política D-042 prohíbe literales con forma de
 * CUIL/CUIT versionados). `nombreEmpresa` queda null (opcional, display-only).
 */
export function plantillaPerfil(cuitEmpresa: CompanyProfile['cuitEmpresa']): CompanyProfile {
  return {
    schemaVersion: '1',
    cuitEmpresa,
    nombreEmpresa: null,
    catalogoBancos: [...CATALOGO_BANCOS],
    mapeosLiquidacion: [],
  };
}
