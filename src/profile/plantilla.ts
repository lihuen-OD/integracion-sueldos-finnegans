// Serialización y plantilla del perfil v1 (D-059): solo se exporta un perfil VÁLIDO.
// La serialización es determinista (claves en el orden del contrato, sangría fija). El
// nombre sugerido del archivo es solo una sugerencia y NO forma parte del contrato.
import { CATALOGO_BANCOS } from '../domain/destino';
import type { CompanyProfile } from './contrato';

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
