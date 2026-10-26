// Validador a mano del perfil v1 (D-058): sin Zod ni dependencias de esquema. Mensajes
// controlados por ruta, sin PII y ajustados a D-059 (versión exacta "1", claves
// desconocidas rechazadas, sin migraciones).
import { parseCbu } from '../domain/cbu';
import { CATALOGO_BANCOS, type BancoCatalogado, type Destino } from '../domain/destino';
import { parseCuitEmpresa } from '../domain/cuitEmpresa';
import type { Result } from '../shared/result';
import type { CompanyProfile, CompanyProfileImportado, CompanyProfileV2 } from './contrato';
import { SCHEMA_VERSION_PERFIL, SCHEMA_VERSION_PERFIL_V2 } from './contrato';

export type CodigoErrorPerfil =
  | 'NO_ES_JSON'
  | 'NO_ES_OBJETO'
  | 'CLAVE_DESCONOCIDA'
  | 'CAMPO_FALTANTE'
  | 'TIPO_INVALIDO'
  | 'SCHEMA_VERSION_INCOMPATIBLE'
  | 'CUIT_EMPRESA_NO_VALIDO'
  | 'NOMBRE_EMPRESA_INVALIDO'
  | 'CATALOGO_INCOMPATIBLE'
  | 'MAPEOS_PENDIENTES'
  | 'BNA_FALTANTE'
  | 'CBU_EMPRESA_NO_VALIDO'
  | 'MONEDA_BNA_INVALIDA'
  | 'CONVENIO_BNA_NO_NUMERICO'
  | 'CONVENIO_BNA5_LONGITUD_NO_DEFINIDA'
  | 'CONVENIO_BNA_LONGITUD_INVALIDA';

export interface ErrorPerfil {
  readonly ruta: string;
  readonly codigo: CodigoErrorPerfil;
  readonly detalle: string;
}

const CLAVES_V1 = [
  'schemaVersion',
  'cuitEmpresa',
  'nombreEmpresa',
  'catalogoBancos',
  'mapeosLiquidacion',
] as const;

const CLAVES_V2 = [
  'schemaVersion',
  'cuitEmpresa',
  'nombreEmpresa',
  'catalogoBancos',
  'bna',
  'mapeosLiquidacion',
] as const;

const CLAVES_BNA = ['cbuEmpresa', 'codigoConvenio', 'moneda'] as const;

type ObjetoPlano = Record<string, unknown>;

function esObjetoPlano(valor: unknown): valor is ObjetoPlano {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/** Obtiene un campo textual; registra CAMPO_FALTANTE/TIPO_INVALIDO si no es texto. */
function campoTexto(
  objeto: ObjetoPlano,
  clave: string,
  ruta: string,
  errores: ErrorPerfil[],
): string | undefined {
  const valor = objeto[clave];
  if (valor === undefined) {
    errores.push({ ruta, codigo: 'CAMPO_FALTANTE', detalle: `falta ${clave}` });
    return undefined;
  }
  if (typeof valor !== 'string') {
    errores.push({ ruta, codigo: 'TIPO_INVALIDO', detalle: 'texto string esperado' });
    return undefined;
  }
  return valor;
}

function clavesDesconocidas(
  objeto: ObjetoPlano,
  permitidas: readonly string[],
  errores: ErrorPerfil[],
): void {
  for (const clave of Object.keys(objeto)) {
    if (!permitidas.includes(clave)) {
      errores.push({ ruta: clave, codigo: 'CLAVE_DESCONOCIDA', detalle: clave });
    }
  }
}

const DESTINOS_VALIDOS: readonly string[] = ['BNA_GT_HABERES', 'PATAGONIA_B2'];
const CLAVES_ENTRADA_BANCO = ['textoFinnegans', 'destino', 'entidadEsperada', 'fuente'] as const;

function validarEntradaBanco(
  entrada: unknown,
  indice: number,
  errores: ErrorPerfil[],
): BancoCatalogado | undefined {
  const ruta = `catalogoBancos[${String(indice)}]`;
  if (!esObjetoPlano(entrada)) {
    errores.push({ ruta, codigo: 'TIPO_INVALIDO', detalle: 'objeto de banco esperado' });
    return undefined;
  }
  for (const clave of Object.keys(entrada)) {
    if (!(CLAVES_ENTRADA_BANCO as readonly string[]).includes(clave)) {
      errores.push({ ruta: `${ruta}.${clave}`, codigo: 'CLAVE_DESCONOCIDA', detalle: clave });
    }
  }
  const textoFinnegans = campoTexto(entrada, 'textoFinnegans', ruta, errores);
  const destino = campoTexto(entrada, 'destino', ruta, errores);
  const entidadEsperada = campoTexto(entrada, 'entidadEsperada', ruta, errores);
  const fuente = campoTexto(entrada, 'fuente', ruta, errores);
  if (
    textoFinnegans === undefined ||
    destino === undefined ||
    entidadEsperada === undefined ||
    fuente === undefined ||
    !DESTINOS_VALIDOS.includes(destino)
  ) {
    return undefined;
  }
  return {
    textoFinnegans,
    destino: destino as Destino,
    entidadEsperada,
    fuente,
  };
}

function mismoBanco(a: BancoCatalogado, b: BancoCatalogado): boolean {
  return (
    a.textoFinnegans === b.textoFinnegans &&
    a.destino === b.destino &&
    a.entidadEsperada === b.entidadEsperada &&
    a.fuente === b.fuente
  );
}

/** El catálogo del perfil debe coincidir exactamente con el vigente (D-012, D-049). */
function mismoCatalogo(a: readonly BancoCatalogado[], b: readonly BancoCatalogado[]): boolean {
  return (
    a.length === b.length &&
    a.length > 0 &&
    a.every((entrada, i) => {
      const canonica = b[i];
      return canonica !== undefined && mismoBanco(entrada, canonica);
    })
  );
}

function validarCatalogo(valor: unknown, errores: ErrorPerfil[]): BancoCatalogado[] | undefined {
  if (!Array.isArray(valor)) {
    errores.push({
      ruta: 'catalogoBancos',
      codigo: 'TIPO_INVALIDO',
      detalle: 'lista de bancos esperada',
    });
    return undefined;
  }
  const entradas: BancoCatalogado[] = [];
  valor.forEach((entrada, indice) => {
    const resultado = validarEntradaBanco(entrada, indice, errores);
    if (resultado !== undefined) {
      entradas.push(resultado);
    }
  });
  // Catálogo cerrado (D-012, D-049): entradas extra, faltantes o con datos distintos se
  // rechazan.
  const coincide =
    entradas.length === CATALOGO_BANCOS.length &&
    CATALOGO_BANCOS.every((canonica) =>
      entradas.some((entrada) => mismoBanco(entrada, canonica)),
    ) &&
    mismoCatalogo(entradas, CATALOGO_BANCOS);
  if (!coincide) {
    errores.push({
      ruta: 'catalogoBancos',
      codigo: 'CATALOGO_INCOMPATIBLE',
      detalle: 'el catálogo del perfil no coincide con el vigente',
    });
    return undefined;
  }
  return entradas;
}

function validarCuitPerfil(
  crudo: unknown,
  errores: ErrorPerfil[],
): CompanyProfile['cuitEmpresa'] | undefined {
  const textoCuit = campoTexto({ cuitEmpresa: crudo }, 'cuitEmpresa', '$.cuitEmpresa', errores);
  if (textoCuit === undefined) {
    return undefined;
  }
  const resultado = parseCuitEmpresa(textoCuit);
  if (resultado.ok) {
    return resultado.value;
  }
  errores.push({
    ruta: '$.cuitEmpresa',
    codigo: 'CUIT_EMPRESA_NO_VALIDO',
    detalle: resultado.error,
  });
  return undefined;
}

function validarNombrePerfil(
  crudo: unknown,
  errores: ErrorPerfil[],
  obligatorio: boolean,
): string | null {
  if (crudo === undefined) {
    if (obligatorio) {
      errores.push({
        ruta: '$.nombreEmpresa',
        codigo: 'CAMPO_FALTANTE',
        detalle: 'falta nombreEmpresa',
      });
    }
    return null;
  }
  if (crudo === null) {
    return null;
  }
  if (typeof crudo !== 'string') {
    errores.push({
      ruta: '$.nombreEmpresa',
      codigo: 'TIPO_INVALIDO',
      detalle: 'texto string o null esperado',
    });
    return null;
  }
  const limpio = crudo.replace(/^ +| +$/g, '');
  if (limpio === '') {
    errores.push({
      ruta: '$.nombreEmpresa',
      codigo: 'NOMBRE_EMPRESA_INVALIDO',
      detalle: 'si se informa, no puede quedar vacío',
    });
    return null;
  }
  return limpio;
}

function validarMapeosPerfil(crudo: unknown, errores: ErrorPerfil[]): void {
  if (crudo === undefined) {
    errores.push({
      ruta: '$.mapeosLiquidacion',
      codigo: 'CAMPO_FALTANTE',
      detalle: 'falta mapeosLiquidacion',
    });
  } else if (!Array.isArray(crudo)) {
    // Un valor no-array se rechaza explícitamente (null, string, número u objeto);
    // nunca se convierte silenciosamente a la estructura vacía aprobada.
    errores.push({
      ruta: '$.mapeosLiquidacion',
      codigo: 'TIPO_INVALIDO',
      detalle: 'lista de mapeos esperada',
    });
  } else if (crudo.length > 0) {
    errores.push({
      ruta: '$.mapeosLiquidacion',
      codigo: 'MAPEOS_PENDIENTES',
      detalle: 'vacío hasta definición (D-026, D-037, P-09, P-10)',
    });
  }
}

function validarConvenioBna(crudo: unknown, errores: ErrorPerfil[]): string | undefined {
  if (crudo === undefined) {
    errores.push({
      ruta: '$.bna.codigoConvenio',
      codigo: 'CAMPO_FALTANTE',
      detalle: 'falta codigoConvenio',
    });
    return undefined;
  }
  if (typeof crudo !== 'string') {
    errores.push({
      ruta: '$.bna.codigoConvenio',
      codigo: 'TIPO_INVALIDO',
      detalle: 'texto string esperado',
    });
    return undefined;
  }
  if (!/^[0-9]+$/.test(crudo)) {
    errores.push({
      ruta: '$.bna.codigoConvenio',
      codigo: 'CONVENIO_BNA_NO_NUMERICO',
      detalle: 'solo dígitos ASCII',
    });
    return undefined;
  }
  if (crudo.length === 4 || crudo.length === 8) {
    return crudo;
  }
  errores.push({
    ruta: '$.bna.codigoConvenio',
    codigo:
      crudo.length >= 5 && crudo.length <= 7
        ? 'CONVENIO_BNA5_LONGITUD_NO_DEFINIDA'
        : 'CONVENIO_BNA_LONGITUD_INVALIDA',
    detalle:
      crudo.length >= 5 && crudo.length <= 7
        ? 'BNA-5: longitud 5, 6 o 7 no definida'
        : 'solo se admiten 4 u 8 dígitos documentados',
  });
  return undefined;
}

/** Valida un objeto ya deserializado contra el contrato v1 (D-059). */
export function validarPerfil(valor: unknown): Result<CompanyProfile, ErrorPerfil[]> {
  if (!esObjetoPlano(valor)) {
    return {
      ok: false,
      error: [{ ruta: '$', codigo: 'NO_ES_OBJETO', detalle: 'objeto JSON esperado' }],
    };
  }
  const errores: ErrorPerfil[] = [];
  clavesDesconocidas(valor, CLAVES_V1, errores);
  const schemaVersion = campoTexto(valor, 'schemaVersion', '$.schemaVersion', errores);
  if (schemaVersion !== SCHEMA_VERSION_PERFIL) {
    errores.push({
      ruta: '$.schemaVersion',
      codigo: 'SCHEMA_VERSION_INCOMPATIBLE',
      detalle: `esperado "${SCHEMA_VERSION_PERFIL}"`,
    });
  }
  const cuit = validarCuitPerfil(valor['cuitEmpresa'], errores);
  const nombreEmpresa = validarNombrePerfil(valor['nombreEmpresa'], errores, false);
  let catalogo: BancoCatalogado[] | undefined;
  const crudoCatalogo = valor['catalogoBancos'];
  if (crudoCatalogo === undefined) {
    errores.push({
      ruta: '$.catalogoBancos',
      codigo: 'CAMPO_FALTANTE',
      detalle: 'falta catalogoBancos',
    });
  } else {
    catalogo = validarCatalogo(crudoCatalogo, errores);
  }
  validarMapeosPerfil(valor['mapeosLiquidacion'], errores);
  if (errores.length > 0 || cuit === undefined || catalogo === undefined) {
    return { ok: false, error: errores };
  }
  return {
    ok: true,
    value: {
      schemaVersion: SCHEMA_VERSION_PERFIL,
      cuitEmpresa: cuit,
      nombreEmpresa,
      catalogoBancos: catalogo,
      mapeosLiquidacion: [] as readonly [],
    },
  };
}

/** Valida un objeto ya deserializado contra el contrato v2 (D-079). */
export function validarPerfilV2(valor: unknown): Result<CompanyProfileV2, ErrorPerfil[]> {
  if (!esObjetoPlano(valor)) {
    return {
      ok: false,
      error: [{ ruta: '$', codigo: 'NO_ES_OBJETO', detalle: 'objeto JSON esperado' }],
    };
  }
  const errores: ErrorPerfil[] = [];
  clavesDesconocidas(valor, CLAVES_V2, errores);
  const schemaVersion = campoTexto(valor, 'schemaVersion', '$.schemaVersion', errores);
  if (schemaVersion !== SCHEMA_VERSION_PERFIL_V2) {
    errores.push({
      ruta: '$.schemaVersion',
      codigo: 'SCHEMA_VERSION_INCOMPATIBLE',
      detalle: `esperado "${SCHEMA_VERSION_PERFIL_V2}"`,
    });
  }
  const cuit = validarCuitPerfil(valor['cuitEmpresa'], errores);
  const nombreEmpresa = validarNombrePerfil(valor['nombreEmpresa'], errores, true);
  const crudoCatalogo = valor['catalogoBancos'];
  let catalogo: BancoCatalogado[] | undefined;
  if (crudoCatalogo === undefined) {
    errores.push({
      ruta: '$.catalogoBancos',
      codigo: 'CAMPO_FALTANTE',
      detalle: 'falta catalogoBancos',
    });
  } else {
    catalogo = validarCatalogo(crudoCatalogo, errores);
  }

  let bna: CompanyProfileV2['bna'] | undefined;
  const crudoBna = valor['bna'];
  if (crudoBna === undefined) {
    errores.push({
      ruta: '$.bna',
      codigo: 'BNA_FALTANTE',
      detalle: 'el perfil v2 exige configuración BNA',
    });
  } else if (!esObjetoPlano(crudoBna)) {
    errores.push({
      ruta: '$.bna',
      codigo: 'TIPO_INVALIDO',
      detalle: 'objeto BNA esperado',
    });
  } else {
    clavesDesconocidas(crudoBna, CLAVES_BNA, errores);
    let cbuEmpresa: CompanyProfileV2['bna']['cbuEmpresa'] | undefined;
    const crudoCbu = crudoBna['cbuEmpresa'];
    if (crudoCbu === undefined) {
      errores.push({
        ruta: '$.bna.cbuEmpresa',
        codigo: 'CAMPO_FALTANTE',
        detalle: 'falta cbuEmpresa',
      });
    } else if (typeof crudoCbu !== 'string') {
      errores.push({
        ruta: '$.bna.cbuEmpresa',
        codigo: 'TIPO_INVALIDO',
        detalle: 'texto string esperado',
      });
    } else {
      const cbu = parseCbu(crudoCbu);
      if (cbu.ok) {
        cbuEmpresa = cbu.value;
      } else {
        errores.push({
          ruta: '$.bna.cbuEmpresa',
          codigo: 'CBU_EMPRESA_NO_VALIDO',
          detalle: cbu.error,
        });
      }
    }
    let moneda: CompanyProfileV2['bna']['moneda'] | undefined;
    const crudoMoneda = crudoBna['moneda'];
    if (crudoMoneda === undefined) {
      errores.push({
        ruta: '$.bna.moneda',
        codigo: 'CAMPO_FALTANTE',
        detalle: 'falta moneda',
      });
    } else if (crudoMoneda !== '0' && crudoMoneda !== '1') {
      errores.push({
        ruta: '$.bna.moneda',
        codigo: 'MONEDA_BNA_INVALIDA',
        detalle: 'esperado "0" o "1"',
      });
    } else {
      moneda = crudoMoneda;
    }
    const codigoConvenio = validarConvenioBna(crudoBna['codigoConvenio'], errores);
    if (cbuEmpresa !== undefined && codigoConvenio !== undefined && moneda !== undefined) {
      bna = { cbuEmpresa, codigoConvenio, moneda };
    }
  }

  validarMapeosPerfil(valor['mapeosLiquidacion'], errores);
  if (errores.length > 0 || cuit === undefined || catalogo === undefined || bna === undefined) {
    return { ok: false, error: errores };
  }
  return {
    ok: true,
    value: {
      schemaVersion: SCHEMA_VERSION_PERFIL_V2,
      cuitEmpresa: cuit,
      nombreEmpresa,
      catalogoBancos: catalogo,
      bna,
      mapeosLiquidacion: [] as readonly [],
    },
  };
}

/**
 * Discrimina por `schemaVersion` sin fallback: "1" usa exclusivamente v1, "2"
 * exclusivamente v2 y cualquier otro valor es incompatible (D-079).
 */
export function validarPerfilVersionado(
  valor: unknown,
): Result<CompanyProfileImportado, ErrorPerfil[]> {
  if (!esObjetoPlano(valor)) {
    return {
      ok: false,
      error: [{ ruta: '$', codigo: 'NO_ES_OBJETO', detalle: 'objeto JSON esperado' }],
    };
  }
  const version = valor['schemaVersion'];
  if (version === SCHEMA_VERSION_PERFIL) {
    return validarPerfil(valor);
  }
  if (version === SCHEMA_VERSION_PERFIL_V2) {
    return validarPerfilV2(valor);
  }
  return {
    ok: false,
    error: [
      {
        ruta: '$.schemaVersion',
        codigo: 'SCHEMA_VERSION_INCOMPATIBLE',
        detalle: 'versión no compatible; se espera "1" o "2"',
      },
    ],
  };
}

/** Importa el perfil desde su texto JSON, sin importar el nombre del archivo (D-059). */
export function parsePerfil(texto: string): Result<CompanyProfile, ErrorPerfil[]> {
  let valor: unknown;
  try {
    valor = JSON.parse(texto);
  } catch {
    return { ok: false, error: [{ ruta: '$', codigo: 'NO_ES_JSON', detalle: 'JSON inválido' }] };
  }
  return validarPerfil(valor);
}

/** Importa un perfil v1 o v2 según la versión declarada, sin migraciones (D-079). */
export function parsePerfilVersionado(
  texto: string,
): Result<CompanyProfileImportado, ErrorPerfil[]> {
  let valor: unknown;
  try {
    valor = JSON.parse(texto);
  } catch {
    return { ok: false, error: [{ ruta: '$', codigo: 'NO_ES_JSON', detalle: 'JSON inválido' }] };
  }
  return validarPerfilVersionado(valor);
}
