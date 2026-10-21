// Validador a mano del perfil v1 (D-058): sin Zod ni dependencias de esquema. Mensajes
// controlados por ruta, sin PII y ajustados a D-059 (versión exacta "1", claves
// desconocidas rechazadas, sin migraciones).
import { CATALOGO_BANCOS, type BancoCatalogado, type Destino } from '../domain/destino';
import { parseCuitEmpresa } from '../domain/cuitEmpresa';
import type { Result } from '../shared/result';
import type { CompanyProfile } from './contrato';
import { SCHEMA_VERSION_PERFIL } from './contrato';

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
  | 'MAPEOS_PENDIENTES';

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

function clavesDesconocidas(objeto: ObjetoPlano, errores: ErrorPerfil[]): void {
  for (const clave of Object.keys(objeto)) {
    if (!(CLAVES_V1 as readonly string[]).includes(clave)) {
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

/** Valida un objeto ya deserializado contra el contrato v1 (D-059). */
export function validarPerfil(valor: unknown): Result<CompanyProfile, ErrorPerfil[]> {
  if (!esObjetoPlano(valor)) {
    return {
      ok: false,
      error: [{ ruta: '$', codigo: 'NO_ES_OBJETO', detalle: 'objeto JSON esperado' }],
    };
  }
  const errores: ErrorPerfil[] = [];
  clavesDesconocidas(valor, errores);
  const schemaVersion = campoTexto(valor, 'schemaVersion', '$.schemaVersion', errores);
  if (schemaVersion !== SCHEMA_VERSION_PERFIL) {
    errores.push({
      ruta: '$.schemaVersion',
      codigo: 'SCHEMA_VERSION_INCOMPATIBLE',
      detalle: `esperado "${SCHEMA_VERSION_PERFIL}"`,
    });
  }
  const textoCuit = campoTexto(valor, 'cuitEmpresa', '$.cuitEmpresa', errores);
  let cuit: CompanyProfile['cuitEmpresa'] | undefined;
  if (textoCuit !== undefined) {
    const resultado = parseCuitEmpresa(textoCuit);
    if (resultado.ok) {
      cuit = resultado.value;
    } else {
      errores.push({
        ruta: '$.cuitEmpresa',
        codigo: 'CUIT_EMPRESA_NO_VALIDO',
        detalle: resultado.error,
      });
    }
  }
  const textoNombre = valor['nombreEmpresa'];
  let nombreEmpresa: string | null = null;
  if (textoNombre !== undefined && textoNombre !== null) {
    if (typeof textoNombre !== 'string') {
      errores.push({
        ruta: '$.nombreEmpresa',
        codigo: 'TIPO_INVALIDO',
        detalle: 'texto string o null esperado',
      });
    } else {
      const limpio = textoNombre.replace(/^ +| +$/g, '');
      if (limpio === '') {
        errores.push({
          ruta: '$.nombreEmpresa',
          codigo: 'NOMBRE_EMPRESA_INVALIDO',
          detalle: 'si se informa, no puede quedar vacío',
        });
      } else {
        nombreEmpresa = limpio;
      }
    }
  }
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
  const crudoMapeos = valor['mapeosLiquidacion'];
  if (crudoMapeos === undefined) {
    errores.push({
      ruta: '$.mapeosLiquidacion',
      codigo: 'CAMPO_FALTANTE',
      detalle: 'falta mapeosLiquidacion',
    });
  } else if (Array.isArray(crudoMapeos) && crudoMapeos.length > 0) {
    errores.push({
      ruta: '$.mapeosLiquidacion',
      codigo: 'MAPEOS_PENDIENTES',
      detalle: 'vacío hasta definición (D-026, D-037, P-09, P-10)',
    });
  }
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
