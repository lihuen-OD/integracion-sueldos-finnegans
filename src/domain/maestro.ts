// Maestro bancario `MAESTRO_CUENTAS_EMPLEADOS.xlsx` (docs/03 §B y §H): contrato v1, catálogos
// con fuente y validación estructural de cada campo, sin normalizar (D-046). Cada campo
// bancario conserva su estado para que la conciliación aplique D-048: inválido y consumido por
// el destino de la fila → BLOQUEANTE; exclusivo del otro destino → INFORMACION.
import { parseCbu, type Cbu, type ErrorCbu } from './cbu';
import type { Cuil } from './cuil';
import type { Destino } from './destino';
import type { Hallazgo, SourceRef } from './incidencias';

export const VERSION_CONTRATO_MAESTRO = '1';

interface EntradaCatalogo<C extends string> {
  readonly codigo: C;
  readonly descripcion: string;
  readonly fuente: string;
}

export type TipoCuentaPatagonia = '1' | '2';
export const TIPOS_CUENTA_PATAGONIA: readonly EntradaCatalogo<TipoCuentaPatagonia>[] = [
  { codigo: '1', descripcion: 'CUENTA CORRIENTE', fuente: 'PAT-DR p.9 (B.2 campo 3)' },
  { codigo: '2', descripcion: 'CAJA DE AHORROS', fuente: 'PAT-DR p.9 (B.2 campo 3)' },
];

/** Anexo I según PAT-DR (fuente principal, D-025). PAT-XL omite `004` (PAT-8). */
export type TipoDocumentoPatagonia = '001' | '002' | '003' | '004' | '006';
export const ANEXO_I_TIPOS_DOCUMENTO: readonly EntradaCatalogo<TipoDocumentoPatagonia>[] = [
  { codigo: '001', descripcion: 'DOCUMENTO NACIONAL DE IDENTIDAD', fuente: 'PAT-DR p.9, Anexo I' },
  { codigo: '002', descripcion: 'LIBRETA DE ENROLAMIENTO', fuente: 'PAT-DR p.9, Anexo I' },
  { codigo: '003', descripcion: 'LIBRETA CIVICA', fuente: 'PAT-DR p.9, Anexo I' },
  {
    codigo: '004',
    descripcion: 'CEDULA DE IDENTIDAD (SOLO PARA EXTRANJEROS)',
    fuente: 'PAT-DR p.9, Anexo I',
  },
  { codigo: '006', descripcion: 'DNI EXTRANJEROS', fuente: 'PAT-DR p.9, Anexo I' },
];

/** Tipo de documento que exige provincia (docs/03 §B.1). */
export const TIPO_DOCUMENTO_CON_PROVINCIA: TipoDocumentoPatagonia = '004';

const PROVINCIAS = [
  ['01', 'CAPITAL FEDERAL'],
  ['02', 'BUENOS AIRES'],
  ['03', 'CATAMARCA'],
  ['04', 'CORDOBA'],
  ['05', 'CORRIENTES'],
  ['06', 'CHACO'],
  ['07', 'CHUBUT'],
  ['08', 'ENTRE RIOS'],
  ['09', 'FORMOSA'],
  ['10', 'JUJUY'],
  ['11', 'LA PAMPA'],
  ['12', 'LA RIOJA'],
  ['13', 'MENDOZA'],
  ['14', 'MISIONES'],
  ['15', 'NEUQUEN'],
  ['16', 'RIO NEGRO'],
  ['17', 'SALTA'],
  ['18', 'SAN JUAN'],
  ['19', 'SAN LUIS'],
  ['20', 'SANTA CRUZ'],
  ['21', 'SANTA FE'],
  ['22', 'SANTIAGO DEL ESTERO'],
  ['23', 'TUCUMAN'],
  ['40', 'TIERRA DEL FUEGO'],
] as const;

export type CodigoProvincia = (typeof PROVINCIAS)[number][0];
export const ANEXO_II_PROVINCIAS: readonly EntradaCatalogo<CodigoProvincia>[] = PROVINCIAS.map(
  ([codigo, descripcion]) => ({ codigo, descripcion, fuente: 'PAT-DR p.10, Anexo II' }),
);

/** Motivo de un campo inválido. Nunca contiene el valor. */
export type MotivoCampoInvalido =
  | 'CARACTER_NO_PERMITIDO'
  | 'LONGITUD_INVALIDA'
  | 'FUERA_DE_CATALOGO'
  | 'DV_BLOQUE_1_INVALIDO'
  | 'DV_BLOQUE_2_INVALIDO'
  /** Excel pudo perder ceros o dígitos (docs/03 §B.3). */
  | 'CELDA_NUMERICA'
  | 'FORMULA'
  | 'TIPO_DE_CELDA'
  /** Provincia informada con un tipo de documento distinto de `004` (§B.1). */
  | 'NO_CORRESPONDE_AL_TIPO_DOCUMENTO';

export type CampoMaestro<T> =
  | { readonly estado: 'VACIO' }
  | { readonly estado: 'VALIDO'; readonly texto: string; readonly valor: T }
  | { readonly estado: 'INVALIDO'; readonly texto: string; readonly motivo: MotivoCampoInvalido };

export interface DatosPatagonia {
  readonly tipoCuenta: CampoMaestro<TipoCuentaPatagonia>;
  readonly numeroCuenta: CampoMaestro<string>;
  readonly codigoBanco: CampoMaestro<string>;
  readonly codigoSucursal: CampoMaestro<string>;
  readonly tipoDocumento: CampoMaestro<TipoDocumentoPatagonia>;
  readonly numeroDocumento: CampoMaestro<string>;
  readonly provinciaDocumento: CampoMaestro<CodigoProvincia>;
  /** Texto tal cual: tipo y relleno BLOQUEADOS por PAT-2. */
  readonly codigoDependencia: CampoMaestro<string>;
}

export interface MasterRecord {
  /** Registro del maestro (archivo, hoja y fila). */
  readonly ref: SourceRef;
  readonly cuilTexto: string;
  /** CUIL canónico (N-02 + DV), o null si es inválido o la celda no era texto. */
  readonly cuil: Cuil | null;
  /** LEGAJO exacto, sin trim; null si la celda era ilegible. */
  readonly legajo: string | null;
  /** Solo referencia humana: nunca se usa para cruzar, validar ni generar. */
  readonly apellidoNombreRef: string;
  readonly cbu: CampoMaestro<Cbu>;
  readonly patagonia: DatosPatagonia;
}

export interface LecturaMaestro {
  /** Hoja `Empleados` encontrada, o null. */
  readonly hoja: string | null;
  /** `VERSION_CONTRATO` leída de la hoja `Control`, o null si falta. */
  readonly versionContrato: string | null;
  readonly registros: readonly MasterRecord[];
  readonly hallazgos: readonly Hallazgo[];
}

/** Columnas bancarias del maestro, en el orden del contrato v1 (docs/03 §B.1). */
export const CAMPOS_BANCARIOS = [
  'CBU',
  'PAT_TIPO_CUENTA',
  'PAT_NUMERO_CUENTA',
  'PAT_CODIGO_BANCO',
  'PAT_CODIGO_SUCURSAL',
  'PAT_TIPO_DOCUMENTO',
  'PAT_NUMERO_DOCUMENTO',
  'PAT_PROVINCIA_DOCUMENTO',
  'PAT_CODIGO_DEPENDENCIA',
] as const;
export type CampoBancario = (typeof CAMPOS_BANCARIOS)[number];

/**
 * Qué consume cada destino (D-048 corregida por D-056, docs/03 §B.3):
 * - `REQUERIDO`: faltante o inválido → BLOQUEANTE para ese destino.
 * - `CONSUMIDO_SI_PRESENTE`: si está y es inválido → BLOQUEANTE (hoy solo la provincia de
 *   Patagonia, requerida únicamente con tipo de documento `004`).
 * - `NO_CONSUMIDO`: inválido (o incompatible, regla 12) → INFORMACION; nunca bloquea ese destino.
 * El CBU pertenece solo al flujo BNA; Patagonia consume únicamente sus campos PAT_* (D-056).
 */
export type ConsumoCampo = 'REQUERIDO' | 'CONSUMIDO_SI_PRESENTE' | 'NO_CONSUMIDO';

const SOLO_PATAGONIA: Readonly<Record<Destino, ConsumoCampo>> = {
  BNA_GT_HABERES: 'NO_CONSUMIDO',
  PATAGONIA_B2: 'REQUERIDO',
};

export const CONSUMO_POR_DESTINO: Readonly<
  Record<CampoBancario, Readonly<Record<Destino, ConsumoCampo>>>
> = {
  CBU: { BNA_GT_HABERES: 'REQUERIDO', PATAGONIA_B2: 'NO_CONSUMIDO' },
  PAT_TIPO_CUENTA: SOLO_PATAGONIA,
  PAT_NUMERO_CUENTA: SOLO_PATAGONIA,
  PAT_CODIGO_BANCO: SOLO_PATAGONIA,
  PAT_CODIGO_SUCURSAL: SOLO_PATAGONIA,
  PAT_TIPO_DOCUMENTO: SOLO_PATAGONIA,
  PAT_NUMERO_DOCUMENTO: SOLO_PATAGONIA,
  PAT_PROVINCIA_DOCUMENTO: {
    BNA_GT_HABERES: 'NO_CONSUMIDO',
    PATAGONIA_B2: 'CONSUMIDO_SI_PRESENTE',
  },
  PAT_CODIGO_DEPENDENCIA: SOLO_PATAGONIA,
};

/**
 * Cómo llegó el valor de una celda desde el archivo. '' en TEXTO = celda vacía (una celda de
 * texto vacía y una celda ausente son lo mismo, hallazgo 1 del spike F1).
 */
export type ValorLeido =
  | { readonly tipo: 'TEXTO'; readonly texto: string }
  | { readonly tipo: 'NUMERO'; readonly texto: string }
  | { readonly tipo: 'FORMULA' }
  | { readonly tipo: 'OTRO' };

const VACIA: ValorLeido = { tipo: 'TEXTO', texto: '' };

const invalido = <T>(texto: string, motivo: MotivoCampoInvalido): CampoMaestro<T> => ({
  estado: 'INVALIDO',
  texto,
  motivo,
});

/** Solo una celda de texto puede ser válida: número, fórmula u otro tipo → INVALIDO (§B.3). */
function segunCelda<T>(
  valor: ValorLeido,
  validar: (texto: string) => CampoMaestro<T>,
): CampoMaestro<T> {
  switch (valor.tipo) {
    case 'TEXTO':
      return valor.texto === '' ? { estado: 'VACIO' } : validar(valor.texto);
    case 'NUMERO':
      return invalido(valor.texto, 'CELDA_NUMERICA');
    case 'FORMULA':
      return invalido('', 'FORMULA');
    case 'OTRO':
      return invalido('', 'TIPO_DE_CELDA');
  }
}

const digitos =
  (minimo: number, maximo: number) =>
  (texto: string): CampoMaestro<string> => {
    if (!/^[0-9]+$/.test(texto)) {
      return invalido(texto, 'CARACTER_NO_PERMITIDO');
    }
    if (texto.length < minimo || texto.length > maximo) {
      return invalido(texto, 'LONGITUD_INVALIDA');
    }
    return { estado: 'VALIDO', texto, valor: texto };
  };

const deCatalogo =
  <C extends string>(catalogo: readonly EntradaCatalogo<C>[]) =>
  (texto: string): CampoMaestro<C> => {
    const entrada = catalogo.find((item) => item.codigo === texto);
    return entrada === undefined
      ? invalido(texto, 'FUERA_DE_CATALOGO')
      : { estado: 'VALIDO', texto, valor: entrada.codigo };
  };

/** VACIO no llega aquí (segunCelda resuelve el texto vacío); se mapea por completitud. */
const MOTIVO_CBU: Readonly<Record<ErrorCbu, MotivoCampoInvalido>> = {
  VACIO: 'LONGITUD_INVALIDA',
  CARACTER_NO_PERMITIDO: 'CARACTER_NO_PERMITIDO',
  LONGITUD_INVALIDA: 'LONGITUD_INVALIDA',
  DV_BLOQUE_1_INVALIDO: 'DV_BLOQUE_1_INVALIDO',
  DV_BLOQUE_2_INVALIDO: 'DV_BLOQUE_2_INVALIDO',
};

function cbu(texto: string): CampoMaestro<Cbu> {
  const resultado = parseCbu(texto);
  return resultado.ok
    ? { estado: 'VALIDO', texto, valor: resultado.value }
    : invalido(texto, MOTIVO_CBU[resultado.error]);
}

/**
 * Solo longitud (máx. 15 caracteres, contados como code points, §B.1): tipo y relleno siguen
 * BLOQUEADOS por PAT-2.
 */
function dependencia(texto: string): CampoMaestro<string> {
  return Array.from(texto).length > 15
    ? invalido(texto, 'LONGITUD_INVALIDA')
    : { estado: 'VALIDO', texto, valor: texto };
}

/**
 * Validadores de texto puro por campo bancario (docs/03 §B.1), sin normalizar (D-046).
 * Única fuente de verdad: los usa el parser XLSX (`validarCamposBancarios`) y el editor
 * del maestro (T3-11/D-066), que reutiliza EXACTAMENTE la semántica F2 ya aprobada sin
 * reglas duplicadas ni validadores "parecidos" en la UI.
 */
const VALIDADORES_TEXTO: Readonly<Record<CampoBancario, (texto: string) => CampoMaestro<unknown>>> =
  {
    CBU: cbu,
    PAT_TIPO_CUENTA: deCatalogo(TIPOS_CUENTA_PATAGONIA),
    PAT_NUMERO_CUENTA: digitos(1, 10),
    PAT_CODIGO_BANCO: digitos(3, 3),
    PAT_CODIGO_SUCURSAL: digitos(1, 5),
    PAT_TIPO_DOCUMENTO: deCatalogo(ANEXO_I_TIPOS_DOCUMENTO),
    PAT_NUMERO_DOCUMENTO: digitos(1, 17),
    PAT_PROVINCIA_DOCUMENTO: deCatalogo(ANEXO_II_PROVINCIAS),
    PAT_CODIGO_DEPENDENCIA: dependencia,
  };

/** Un texto vacío es una celda vacía (hallazgo 1 del spike F1); el resto pasa por el
 *  validador F2 del campo. No aplica el cruce provincia/tipoDocumento: eso lo hace
 *  `cruzarProvinciaConTipoDocumento` por encima, igual que en el parser. */
export function validarCampoBancarioEditado(
  campo: CampoBancario,
  texto: string,
): CampoMaestro<unknown> {
  return texto === '' ? { estado: 'VACIO' } : VALIDADORES_TEXTO[campo](texto);
}

/**
 * Único cruce documentado (docs/03 §B.1): provincia solo con tipo de documento `004`.
 * Reevaluar ante cambio de tipo de documento: una provincia válida deja de corresponder si
 * el tipo pasa a ser distinto de `004`; una provincia solo-invalidada por el cruce anterior
 * se revalida por catálogo si el tipo vuelve a ser `004`. Los demás estados INVALIDO se
 * conservan tal como salieron del parser (nunca se reinterpreta una celda no text).
 */
export function cruzarProvinciaConTipoDocumento(
  tipoDocumento: CampoMaestro<TipoDocumentoPatagonia>,
  provinciaDocumento: CampoMaestro<CodigoProvincia>,
): CampoMaestro<CodigoProvincia> {
  if (
    provinciaDocumento.estado === 'VALIDO' &&
    tipoDocumento.estado === 'VALIDO' &&
    tipoDocumento.valor !== TIPO_DOCUMENTO_CON_PROVINCIA
  ) {
    return invalido(provinciaDocumento.texto, 'NO_CORRESPONDE_AL_TIPO_DOCUMENTO');
  }
  if (
    tipoDocumento.estado === 'VALIDO' &&
    tipoDocumento.valor === TIPO_DOCUMENTO_CON_PROVINCIA &&
    provinciaDocumento.estado === 'INVALIDO' &&
    provinciaDocumento.motivo === 'NO_CORRESPONDE_AL_TIPO_DOCUMENTO'
  ) {
    return VALIDADORES_TEXTO.PAT_PROVINCIA_DOCUMENTO(
      provinciaDocumento.texto,
    ) as CampoMaestro<CodigoProvincia>;
  }
  return provinciaDocumento;
}

/**
 * Validación estructural de los campos bancarios de un registro (docs/03 §B.1), sin normalizar
 * (D-046). Incluye el único cruce documentado: provincia solo con tipo de documento `004`.
 * La obligatoriedad según el destino la aplica la conciliación (D-048).
 */
export function validarCamposBancarios(
  valores: Readonly<Partial<Record<CampoBancario, ValorLeido>>>,
): { readonly cbu: CampoMaestro<Cbu>; readonly patagonia: DatosPatagonia } {
  const leer = (campo: CampoBancario): ValorLeido => valores[campo] ?? VACIA;
  const tipoDocumento = segunCelda(
    leer('PAT_TIPO_DOCUMENTO'),
    VALIDADORES_TEXTO.PAT_TIPO_DOCUMENTO,
  ) as CampoMaestro<TipoDocumentoPatagonia>;
  const provinciaDocumento = cruzarProvinciaConTipoDocumento(
    tipoDocumento,
    segunCelda(
      leer('PAT_PROVINCIA_DOCUMENTO'),
      VALIDADORES_TEXTO.PAT_PROVINCIA_DOCUMENTO,
    ) as CampoMaestro<CodigoProvincia>,
  );
  return {
    cbu: segunCelda(leer('CBU'), VALIDADORES_TEXTO.CBU) as CampoMaestro<Cbu>,
    patagonia: {
      tipoCuenta: segunCelda(
        leer('PAT_TIPO_CUENTA'),
        VALIDADORES_TEXTO.PAT_TIPO_CUENTA,
      ) as CampoMaestro<TipoCuentaPatagonia>,
      numeroCuenta: segunCelda(
        leer('PAT_NUMERO_CUENTA'),
        VALIDADORES_TEXTO.PAT_NUMERO_CUENTA,
      ) as CampoMaestro<string>,
      codigoBanco: segunCelda(
        leer('PAT_CODIGO_BANCO'),
        VALIDADORES_TEXTO.PAT_CODIGO_BANCO,
      ) as CampoMaestro<string>,
      codigoSucursal: segunCelda(
        leer('PAT_CODIGO_SUCURSAL'),
        VALIDADORES_TEXTO.PAT_CODIGO_SUCURSAL,
      ) as CampoMaestro<string>,
      tipoDocumento,
      numeroDocumento: segunCelda(
        leer('PAT_NUMERO_DOCUMENTO'),
        VALIDADORES_TEXTO.PAT_NUMERO_DOCUMENTO,
      ) as CampoMaestro<string>,
      provinciaDocumento,
      codigoDependencia: segunCelda(
        leer('PAT_CODIGO_DEPENDENCIA'),
        VALIDADORES_TEXTO.PAT_CODIGO_DEPENDENCIA,
      ) as CampoMaestro<string>,
    },
  };
}

/** Claves bancarias editables por el editor UPDATE-only (D-066). NO incluye identidad
 *  (`ref`, `cuilTexto`, `cuil`, `legajo`, `apellidoNombreRef`) ni
 *  `PAT_CODIGO_DEPENDENCIA` (PAT-2 pendiente). */
export const CAMPOS_EDITABLES_MAESTRO = [
  'CBU',
  'PAT_TIPO_CUENTA',
  'PAT_NUMERO_CUENTA',
  'PAT_CODIGO_BANCO',
  'PAT_CODIGO_SUCURSAL',
  'PAT_TIPO_DOCUMENTO',
  'PAT_NUMERO_DOCUMENTO',
  'PAT_PROVINCIA_DOCUMENTO',
] as const;
export type CampoEditableMaestro = (typeof CAMPOS_EDITABLES_MAESTRO)[number];

type RegistroActualizado =
  | { readonly ok: true; readonly registro: MasterRecord }
  | { readonly ok: false; readonly campo: CampoMaestro<never> };

/** Clave del `DatosPatagonia` que editar cada campo bancario editado. */
const CLAVE_PATAGONIA: Readonly<
  Record<Exclude<CampoEditableMaestro, 'CBU'>, keyof DatosPatagonia>
> = {
  PAT_TIPO_CUENTA: 'tipoCuenta',
  PAT_NUMERO_CUENTA: 'numeroCuenta',
  PAT_CODIGO_BANCO: 'codigoBanco',
  PAT_CODIGO_SUCURSAL: 'codigoSucursal',
  PAT_TIPO_DOCUMENTO: 'tipoDocumento',
  PAT_NUMERO_DOCUMENTO: 'numeroDocumento',
  PAT_PROVINCIA_DOCUMENTO: 'provinciaDocumento',
};

/**
 * UPDATE-only de un campo bancario con validación F2 (T3-11/D-066): el texto nuevo se
 * valida EXACTAMENTE como una celda de texto recién escrita ('' = VACIO). Un valor
 * inválido se rechaza (no se crea revisión con datos inválidos) y el registro anterior
 * queda intacto; vaciar un campo es permitido (VACIO es un estado F2) y la reevaluación
 * de obligatoriedad la hace la conciliación (D-048). UPDATE conservador (correctivo
 * CP-F3-C): si una edición nueva del tipo o la provincia introduce una incompatibilidad
 * NUEVA por el cruce documentado (NO_CORRESPONDE_AL_TIPO_DOCUMENTO donde antes la provincia
 * estaba VACIO, VALIDO o inválida por otro motivo), la edición se rechaza y no se impone
 * un segundo campo silenciosamente: el operador primero vacía o corrige la provincia (ese
 * UPDATE sí es válido) y luego edita el tipo. Un maestro IMPORTADO con la incompatibilidad
 * ya cargada sigue representándose igual que lo leído (F2 no normaliza estados viejos).
 * Los demás campos del registro no se tocan; identidad y PAT_CODIGO_DEPENDENCIA no
 * editables por tipo.
 */
export function actualizarCampoBancario(
  registro: MasterRecord,
  campo: CampoEditableMaestro,
  texto: string,
): RegistroActualizado {
  const nuevo = validarCampoBancarioEditado(campo, texto);
  if (nuevo.estado === 'INVALIDO') {
    return { ok: false, campo: nuevo };
  }
  if (campo === 'CBU') {
    return {
      ok: true,
      registro: {
        ...registro,
        cbu: nuevo as { estado: 'VALIDO'; texto: string; valor: Cbu } | { estado: 'VACIO' },
      },
    };
  }
  const patagonia: { -readonly [P in keyof DatosPatagonia]: DatosPatagonia[P] } = {
    ...registro.patagonia,
  };
  const clave = CLAVE_PATAGONIA[campo];
  patagonia[clave] = nuevo as never;
  if (campo === 'PAT_TIPO_DOCUMENTO' || campo === 'PAT_PROVINCIA_DOCUMENTO') {
    patagonia.provinciaDocumento = cruzarProvinciaConTipoDocumento(
      campo === 'PAT_TIPO_DOCUMENTO'
        ? (nuevo as { estado: 'VALIDO'; texto: string; valor: TipoDocumentoPatagonia })
        : registro.patagonia.tipoDocumento,
      patagonia.provinciaDocumento,
    );
    // UPDATE conservador (microcorrectivo CP-F3-C): una edición NUEVA del par
    // tipo/provincia NO crea una revisión si el RESULTADO del par continúa inválido
    // (INVALIDO/NO_CORRESPONDE_AL_TIPO_DOCUMENTO), aunque la incompatibilidad ya viniera
    // del maestro importado. Solo se permiten los UPDATEs que CORRIGEN o son compatibles:
    // vaciar la provincia, poner un tipo que revalida la provincia (idem 004), o una
    // provincia compatible con el tipo vigente. Nada se borra ni corrige solo: la
    // representación del estado IMPORTADO inválido sigue intacta porque el parser no pasa
    // por acá (F2 no cambia; la restricción es del editor UPDATE-only F3).
    const provinciaDespues = patagonia.provinciaDocumento;
    if (
      provinciaDespues.estado === 'INVALIDO' &&
      provinciaDespues.motivo === 'NO_CORRESPONDE_AL_TIPO_DOCUMENTO'
    ) {
      return { ok: false, campo: provinciaDespues };
    }
  }
  return { ok: true, registro: { ...registro, patagonia } };
}
