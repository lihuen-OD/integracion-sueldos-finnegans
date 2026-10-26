// Modelo puro de BNA GT Haberes (CP-F5-B). No importa perfil, conciliación, run,
// importación, UI ni Patagonia: recibe valores ya decididos por la capa superior.
// El dinero es siempre `Centavos`/`bigint` y los datos bancarios son tipos canónicos
// del dominio. Ningún campo de este modelo resuelve por sí solo una pregunta abierta.
import type { Cbu } from '../../domain/cbu';
import type { CuitEmpresaEstructural } from '../../domain/cuitEmpresa';
import type { Cuil } from '../../domain/cuil';
import type { SourceRef } from '../../domain/incidencias';
import type { DescripcionLiquidacion } from '../../domain/liquidacion';
import type { Centavos } from '../../domain/money';
import type { ConfiguracionTecnicaBna } from './spec';

/** Datos estables de la empresa que participan en el archivo BNA. */
export interface PerfilBna {
  readonly cuitEmpresa: CuitEmpresaEstructural;
  readonly cbuEmpresa: Cbu;
  readonly codigoConvenio: string;
  readonly moneda: '0' | '1';
}

/** Un pago individual, ya conciliado por la capa superior. `ref` es solo trazabilidad. */
export interface PagoBna {
  readonly ref: SourceRef;
  readonly cuil: Cuil;
  readonly cbu: Cbu;
  readonly neto: Centavos;
  readonly descripcion: DescripcionLiquidacion;
}

/**
 * Parámetros explícitos del envío. `fechaCompensacion` y `numeroEnvio` se reciben tal
 * como los define el operador: el mapper no calcula días hábiles, feriados ni zonas
 * horarias. `infoCriterioEmpresa` y `referenciaUnivoca` son valores explícitos; el
 * primero todavía depende de una decisión BNA-11/P-17 y el segundo no se inventa.
 * `lineSeparator`/`trailingSeparator` son la hipótesis técnica BNA-9, sin default.
 */
export interface ParametrosEnvioBna extends ConfiguracionTecnicaBna {
  readonly fechaCompensacion: string;
  readonly numeroEnvio: string;
  readonly infoCriterioEmpresa: string;
  readonly referenciaUnivoca: string;
}
