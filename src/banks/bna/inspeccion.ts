// Inspector BNA independiente (CP-F5-B). Primero usa la API pública F4 para validar
// estructura, longitudes, separadores, BOM y bytes. Luego verifica invariantes bancarias
// sobre los valores RAW: totales, cantidad, límite de total y alfabeto A. No recibe ni
// confía en los modelos usados para generar; una mutación directa de bytes es detectable.
// El parser F4 ya garantiza exactamente un R1, al menos un R2 y exactamente un R3.
// BNA-10 se informa como advertencia no bloqueante observando la identidad bancaria que
// repiten los R2; no se deduplica ni se elimina ningún pago.
import type { Centavos } from '../../domain/money';
import type { Result } from '../../shared/result';
import { inspeccionarArchivo, type ErrorParseoArchivo, type RegistroArchivo } from '../fixed-width';
import { crearSpecBna, type ConfiguracionTecnicaBna } from './spec';
import { MAX_CANTIDAD_R2, MAX_TOTAL_R3 } from './totales';

export type CodigoErrorInspeccionBna =
  | 'ARCHIVO_BNA_INVALIDO'
  | 'ALFABETO_BNA8_INVALIDO'
  | 'TOTAL_EXCEDE_LAYOUT'
  | 'TOTAL_DECLARADO_DISTINTO'
  | 'CANTIDAD_DECLARADA_DISTINTA';

export interface ErrorInspeccionBna {
  readonly codigo: CodigoErrorInspeccionBna;
  readonly linea?: number;
  readonly campoId?: string;
  readonly erroresTecnicos?: readonly ErrorParseoArchivo[];
}

export interface AdvertenciaBna {
  readonly codigo: 'BNA-10';
  readonly lineas: readonly number[];
}

export interface InspeccionBna {
  readonly registros: readonly RegistroArchivo[];
  readonly totalDeclarado: Centavos;
  readonly totalCalculado: Centavos;
  readonly cantidadDeclarada: number;
  readonly cantidadCalculada: number;
  readonly advertencias: readonly AdvertenciaBna[];
}

function valor(registro: RegistroArchivo, campoId: string): string {
  const texto = registro.valores[campoId];
  if (texto === undefined) {
    // El parser F4 de archivo entrega todos los campos de la spec; no hay ausencias acá.
    throw new Error(`campo BNA ausente en registro parseado: ${campoId}`);
  }
  return texto;
}

function requerido(registro: RegistroArchivo | undefined): RegistroArchivo {
  if (registro === undefined) {
    // El parser F4 de archivo ya garantiza exactamente un registro de fin.
    throw new Error('registro BNA de fin ausente en archivo parseado');
  }
  return registro;
}

function campoAInvalido(registro: RegistroArchivo, campoId: string): ErrorInspeccionBna | null {
  if (!/^[A-Z0-9 ]*$/.test(valor(registro, campoId))) {
    return {
      codigo: 'ALFABETO_BNA8_INVALIDO',
      linea: registro.linea,
      campoId,
    };
  }
  return null;
}

/** Verifica invariantes BNA sobre bytes, sin usar los objetos que los generaron. */
export function inspeccionarBna(
  bytes: Uint8Array,
  configuracion: ConfiguracionTecnicaBna,
): Result<InspeccionBna, readonly ErrorInspeccionBna[]> {
  const spec = crearSpecBna(configuracion);
  const parseado = inspeccionarArchivo(spec, bytes);
  if (!parseado.ok) {
    return {
      ok: false,
      error: [{ codigo: 'ARCHIVO_BNA_INVALIDO', erroresTecnicos: parseado.error }],
    };
  }

  const registros = parseado.value.registros;
  const r2 = registros.filter((registro) => registro.registroId === 'BNA_R2');
  const r3 = requerido(registros.find((registro) => registro.registroId === 'BNA_R3'));
  const errores: ErrorInspeccionBna[] = [];

  for (const registro of registros) {
    const recordSpec = spec.records.find((candidato) => candidato.id === registro.registroId);
    for (const campo of recordSpec?.fields ?? []) {
      if (campo.type !== 'A') {
        continue;
      }
      const invalido = campoAInvalido(registro, campo.id);
      if (invalido !== null) {
        errores.push(invalido);
      }
    }
  }

  const totalDeclarado = BigInt(valor(r3, 'r3_totalImporte')) as Centavos;
  const cantidadDeclarada = Number(valor(r3, 'r3_totalCantidad'));
  let totalCalculado = 0n;
  for (const registro of r2) {
    totalCalculado += BigInt(valor(registro, 'r2_importe'));
  }
  const totalCalculadoTipado = totalCalculado as Centavos;
  if (totalCalculadoTipado > MAX_TOTAL_R3) {
    errores.push({ codigo: 'TOTAL_EXCEDE_LAYOUT' });
  }
  if (totalDeclarado !== totalCalculadoTipado) {
    errores.push({ codigo: 'TOTAL_DECLARADO_DISTINTO' });
  }
  if (cantidadDeclarada !== r2.length || r2.length > MAX_CANTIDAD_R2) {
    errores.push({ codigo: 'CANTIDAD_DECLARADA_DISTINTA' });
  }

  const identidades = new Map<string, number[]>();
  for (const registro of r2) {
    const clave = [
      valor(registro, 'r2_entidad'),
      valor(registro, 'r2_sucursal'),
      valor(registro, 'r2_dvBloque1'),
      valor(registro, 'r2_bloque2Cuenta'),
    ].join('|');
    const lineas = identidades.get(clave);
    if (lineas === undefined) {
      identidades.set(clave, [registro.linea]);
    } else {
      lineas.push(registro.linea);
    }
  }
  const advertencias: AdvertenciaBna[] = [];
  for (const lineas of identidades.values()) {
    if (lineas.length > 1) {
      advertencias.push({ codigo: 'BNA-10', lineas });
    }
  }

  if (errores.length > 0) {
    return { ok: false, error: errores };
  }
  return {
    ok: true,
    value: {
      registros,
      totalDeclarado,
      totalCalculado: totalCalculadoTipado,
      cantidadDeclarada,
      cantidadCalculada: r2.length,
      advertencias,
    },
  };
}
