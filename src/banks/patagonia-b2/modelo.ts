// Modelo puro Patagonia B.2 (CP-F6-B). No importa perfil, conciliación, run, UI, XLSX,
// ExcelJS ni BNA: recibe valores ya decididos por la capa superior. El dinero es siempre
// `Centavos`/`bigint`; los catálogos bancarios son los tipos canónicos del maestro.
// Ningún campo de este modelo resuelve por sí solo una pregunta abierta.
import type { SourceRef } from '../../domain/incidencias';
import type { DescripcionLiquidacion } from '../../domain/liquidacion';
import type {
  CodigoProvincia,
  TipoCuentaPatagonia,
  TipoDocumentoPatagonia,
} from '../../domain/maestro';
import type { Centavos } from '../../domain/money';
import type { ConfiguracionTecnicaPatagonia } from './spec';

/**
 * Único dato de empresa que Patagonia B.2 necesita del perfil. PAT-6 sigue abierta: es el
 * valor informado para "Número de EMPRESA" de PAT-DR, no una afirmación de equivalencia
 * con el "número de convenio" de PAT-XL. Se conserva exactamente como vino, sin relleno.
 */
export interface PerfilPatagonia {
  readonly numeroEmpresa: string;
}

/**
 * Un pago individual ya conciliado. `ref` es solo trazabilidad. `legajo`, `apellido` y
 * `nombre` se incluyen únicamente porque son fuente de campos B.2; no hay CUIL, CBU,
 * datos de alta ni identificadores derivados.
 */
export interface PagoPatagonia {
  readonly ref: SourceRef;
  readonly neto: Centavos;
  readonly tipoCuenta: TipoCuentaPatagonia;
  readonly numeroCuenta: string;
  readonly codigoBanco: string;
  readonly codigoSucursal: string;
  readonly tipoDocumento: TipoDocumentoPatagonia;
  readonly numeroDocumento: string;
  readonly provinciaDocumento: CodigoProvincia | null;
  readonly codigoDependencia: string;
  readonly legajo: string | null;
  readonly apellido: string;
  readonly nombre: string;
  readonly descripcion: DescripcionLiquidacion;
}

/**
 * Parámetros explícitos del envío. Las fechas llegan como AAAAMMDD y no se calculan con
 * `Date` ni calendario. `concepto` es un valor explícito de la capa superior.
 * `ConfiguracionTecnicaPatagonia` conserva las hipótesis PAT-1/PAT-2 y PAT-14 sin defaults.
 */
export interface ParametrosEnvioPatagonia extends ConfiguracionTecnicaPatagonia {
  readonly fechaPresentacion: string;
  readonly fechaAcreditacion: string;
  readonly numeroEnvio: string;
  readonly concepto: string;
}
