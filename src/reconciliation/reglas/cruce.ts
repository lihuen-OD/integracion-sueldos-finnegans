// Reglas del cruce Finnegans ↔ maestro para filas con destino determinado (docs/03 §E.2 reglas
// 7, 9, 12 y 13). El cruce es por CUIL exacto; el legajo es un control secundario EXACTO.
import { entidadCbu } from '../../domain/cbu';
import type { Incidencia } from '../../domain/incidencias';
import type { PayrollLine } from '../../domain/liquidacion';
import {
  CONSUMO_POR_DESTINO,
  TIPO_DOCUMENTO_CON_PROVINCIA,
  type CampoBancario,
  type CampoMaestro,
  type ConsumoCampo,
  type MasterRecord,
} from '../../domain/maestro';
import { nuevaIncidencia } from '../incidencia';
import type { FilaConDestino } from './contexto';

/** Regla 7 (D-018): neto a pagar con CUIL válido y sin registro en el maestro → BLOQUEANTE. */
export function reglaSinMaestro(
  { linea, destino }: FilaConDestino,
  candidatos: number,
): Incidencia[] {
  if (linea.cuil === null || candidatos > 0) {
    return [];
  }
  return [
    nuevaIncidencia('SIN_MAESTRO', 'BLOQUEANTE', destino, [linea.ref], {
      campo: 'Cuil',
      valores: { finnegans: linea.cuilTexto },
    }),
  ];
}

/**
 * Regla 9 (D-017, D-053): comparación textual EXACTA, sin trim, parseInt ni relleno (`007` ≠ `7`,
 * `007` ≠ `"007 "`). Un legajo vacío en Finnegans frente a un legajo del maestro también es una
 * diferencia a revisar, no un bloqueante. Si algún legajo es ilegible o falta en el maestro, ya
 * hay un bloqueante que esta regla no oculta. Se muestran ambos valores y no se modifica ninguno.
 */
export function reglaLegajo(
  { linea, destino }: FilaConDestino,
  registro: MasterRecord,
  lineas: readonly PayrollLine[],
): Incidencia[] {
  if (linea.legajo === null || registro.legajo === null || linea.legajo === registro.legajo) {
    return [];
  }
  const legajoMaestro = registro.legajo;
  // Si el legajo del maestro es el de otro empleado de Finnegans, se indica (§E.2 regla 9).
  const otras = lineas.filter((otra) => otra.cuil !== linea.cuil && otra.legajo === legajoMaestro);
  const motivo =
    linea.legajo === ''
      ? 'LEGAJO_FINNEGANS_VACIO'
      : otras.length > 0
        ? 'LEGAJO_DE_OTRA_FILA'
        : 'DIFERENCIA_EXACTA';
  return [
    nuevaIncidencia(
      'LEGAJO_NO_COINCIDE',
      'REQUIERE_REVISION',
      destino,
      [linea.ref, registro.ref, ...otras.map((otra) => otra.ref)],
      { campo: 'Legajo', motivo, valores: { finnegans: linea.legajo, maestro: legajoMaestro } },
    ),
  ];
}

/**
 * Regla 12 (D-018): banco de Finnegans incompatible con el maestro → BLOQUEANTE. BNA: entidad del
 * CBU distinta de la esperada. Patagonia: PAT_CODIGO_BANCO distinto de la entidad esperada, o CBU
 * presente con otra entidad. Un destino sin entrada en el catálogo no se valida a ciegas: bloquea.
 */
export function reglaBancoCompatible(
  { linea, destino, banco }: FilaConDestino,
  registro: MasterRecord,
): Incidencia[] {
  const refs = [linea.ref, registro.ref];
  if (banco === undefined) {
    return [
      nuevaIncidencia('BANCO_INCOMPATIBLE_MAESTRO', 'BLOQUEANTE', destino, refs, {
        motivo: 'DESTINO_SIN_CATALOGO',
      }),
    ];
  }
  const incompatible = (campo: CampoBancario, motivo: string, texto: string) =>
    nuevaIncidencia('BANCO_INCOMPATIBLE_MAESTRO', 'BLOQUEANTE', destino, refs, {
      campo,
      motivo,
      valores: { finnegans: linea.bancoFinnegans ?? '', maestro: texto },
    });
  const resultado: Incidencia[] = [];
  const { cbu } = registro;
  if (cbu.estado === 'VALIDO' && entidadCbu(cbu.valor) !== banco.entidadEsperada) {
    resultado.push(incompatible('CBU', 'ENTIDAD_CBU', cbu.texto));
  }
  const codigoBanco = registro.patagonia.codigoBanco;
  if (
    destino === 'PATAGONIA_B2' &&
    codigoBanco.estado === 'VALIDO' &&
    codigoBanco.valor !== banco.entidadEsperada
  ) {
    resultado.push(incompatible('PAT_CODIGO_BANCO', 'CODIGO_BANCO', codigoBanco.texto));
  }
  return resultado;
}

/** Los campos bancarios de un registro, en el orden del contrato v1 (docs/03 §B.1). */
export function camposBancarios(
  registro: MasterRecord,
): readonly (readonly [CampoBancario, CampoMaestro<string>])[] {
  const p = registro.patagonia;
  return [
    ['CBU', registro.cbu],
    ['PAT_TIPO_CUENTA', p.tipoCuenta],
    ['PAT_NUMERO_CUENTA', p.numeroCuenta],
    ['PAT_CODIGO_BANCO', p.codigoBanco],
    ['PAT_CODIGO_SUCURSAL', p.codigoSucursal],
    ['PAT_TIPO_DOCUMENTO', p.tipoDocumento],
    ['PAT_NUMERO_DOCUMENTO', p.numeroDocumento],
    ['PAT_PROVINCIA_DOCUMENTO', p.provinciaDocumento],
    ['PAT_CODIGO_DEPENDENCIA', p.codigoDependencia],
  ];
}

export const codigoFaltante = (campo: CampoBancario) =>
  campo === 'CBU' ? 'CBU_FALTANTE' : 'DATO_PATAGONIA_FALTANTE';
export const codigoInvalido = (campo: CampoBancario) =>
  campo === 'CBU' ? 'CBU_INVALIDO' : 'DATO_PATAGONIA_INVALIDO';

/**
 * Regla 13 con D-048: un campo requerido o consumido por el destino de la fila, faltante o
 * inválido → BLOQUEANTE para ese destino; un campo exclusivo del otro destino, inválido →
 * INFORMACION (se conserva para corregir el maestro, sin bloqueo cruzado entre bancos).
 * `PAT_PROVINCIA_DOCUMENTO` es requerida solo con tipo de documento `004` (§B.1). No se compara
 * el documento con el CUIL (regla 18 diferida, P-28).
 */
export function reglaDatosDestino(
  { linea, destino }: FilaConDestino,
  registro: MasterRecord,
): Incidencia[] {
  const tipoDocumento = registro.patagonia.tipoDocumento;
  const conProvincia =
    tipoDocumento.estado === 'VALIDO' && tipoDocumento.valor === TIPO_DOCUMENTO_CON_PROVINCIA;
  const refs = [linea.ref, registro.ref];
  const resultado: Incidencia[] = [];
  for (const [campo, valor] of camposBancarios(registro)) {
    let consumo: ConsumoCampo = CONSUMO_POR_DESTINO[campo][destino];
    if (campo === 'PAT_PROVINCIA_DOCUMENTO' && consumo !== 'NO_CONSUMIDO' && conProvincia) {
      consumo = 'REQUERIDO';
    }
    if (valor.estado === 'VACIO' && consumo === 'REQUERIDO') {
      resultado.push(
        nuevaIncidencia(codigoFaltante(campo), 'BLOQUEANTE', destino, refs, { campo }),
      );
    } else if (valor.estado === 'INVALIDO') {
      resultado.push(
        nuevaIncidencia(
          codigoInvalido(campo),
          consumo === 'NO_CONSUMIDO' ? 'INFORMACION' : 'BLOQUEANTE',
          destino,
          refs,
          { campo, motivo: valor.motivo, valores: { maestro: valor.texto } },
        ),
      );
    }
  }
  return resultado;
}
