// Inspector BNA (CP-F5-B): verifica bytes mutados sin confiar en los modelos de origen.
// BNA-10 se informa como advertencia no bloqueante y nunca deduplica. Los identificadores
// y cuentas son sintéticos de test.
import { describe, expect, it } from 'vitest';
import {
  crearSpecBna,
  inspeccionarBna,
  serializarBna,
  type AdvertenciaBna,
  type ErrorInspeccionBna,
  type InspeccionBna,
  type ParametrosEnvioBna,
} from '../../../../src/banks/bna';
import type { ConfiguracionTecnicaBna } from '../../../../src/banks/bna/spec';
import type { FileSpec } from '../../../../src/banks/fixed-width';
import {
  mismaCuenta,
  pagoSintetico,
  parametrosSinteticos,
  perfilSintetico,
  politicaSintetica,
} from './auxiliares';

interface Config {
  readonly lineSeparator: '\n' | '\r\n';
  readonly trailingSeparator: boolean;
}

function config(cambios: Partial<Config> = {}): ParametrosEnvioBna {
  return { ...parametrosSinteticos(), ...cambios };
}

function bytesValidos(configuracion: ParametrosEnvioBna, pagos = [pagoSintetico(1)]): Uint8Array {
  const resultado = serializarBna(perfilSintetico(), configuracion, pagos, politicaSintetica());
  if (!resultado.ok) {
    throw new Error(`generación sintética rechazada: ${JSON.stringify(resultado.error)}`);
  }
  return resultado.value.bytes;
}

function inspeccionOk(bytes: Uint8Array, configuracion: ConfiguracionTecnicaBna): InspeccionBna {
  const resultado = inspeccionarBna(bytes, configuracion);
  if (!resultado.ok) {
    throw new Error(`inspección rechazada: ${JSON.stringify(resultado.error)}`);
  }
  return resultado.value;
}

function errores(
  bytes: Uint8Array,
  configuracion: ConfiguracionTecnicaBna,
): readonly ErrorInspeccionBna[] {
  const resultado = inspeccionarBna(bytes, configuracion);
  if (resultado.ok) {
    throw new Error('inspección aceptó bytes inválidos');
  }
  return resultado.error;
}

function codigos(bytes: Uint8Array, configuracion: ConfiguracionTecnicaBna): string[] {
  return errores(bytes, configuracion).map((error) => error.codigo);
}

function specDe(configuracion: ConfiguracionTecnicaBna): FileSpec {
  return crearSpecBna(configuracion);
}

function inicioDeLinea(configuracion: ConfiguracionTecnicaBna, numeroLinea: number): number {
  const largo = configuracion.lineSeparator === '\n' ? 1 : 2;
  return numeroLinea * (200 + largo);
}

function campo(spec: FileSpec, linea: number, campoId: string) {
  const registros = ['BNA_R1', 'BNA_R2', 'BNA_R3'];
  const recordId = registros[linea];
  if (recordId === undefined) {
    throw new Error(`línea sin registro: ${String(linea)}`);
  }
  const registro = spec.records.find((candidato) => candidato.id === recordId);
  const definicion = registro?.fields.find((candidato) => candidato.id === campoId);
  if (definicion === undefined) {
    throw new Error(`campo inexistente: ${campoId}`);
  }
  return definicion;
}

/** Mutación ASCII de ancho fijo: reemplaza el valor del campo y conserva la longitud. */
function mutarCampo(
  original: Uint8Array,
  configuracion: ConfiguracionTecnicaBna,
  linea: number,
  campoId: string,
  valor: string,
): Uint8Array {
  const spec = specDe(configuracion);
  const definicion = campo(spec, linea, campoId);
  if (valor.length !== definicion.end - definicion.start + 1) {
    throw new Error('la mutación de test debe conservar el ancho');
  }
  const bytes = original.slice();
  const desde = inicioDeLinea(configuracion, linea) + definicion.start - 1;
  const codificados = new TextEncoder().encode(valor);
  bytes.set(codificados, desde);
  return bytes;
}

/** Mutación de un byte puntual, para probar bytes no ASCII sin cambiar el ancho. */
function mutarByte(
  original: Uint8Array,
  configuracion: ConfiguracionTecnicaBna,
  linea: number,
  campoId: string,
  byte: number,
): Uint8Array {
  const spec = specDe(configuracion);
  const definicion = campo(spec, linea, campoId);
  const bytes = original.slice();
  bytes[inicioDeLinea(configuracion, linea) + definicion.start - 1] = byte;
  return bytes;
}

function borrarLinea(
  original: Uint8Array,
  configuracion: ConfiguracionTecnicaBna,
  linea: number,
): Uint8Array {
  const largoLinea = 200;
  const largo = configuracion.lineSeparator === '\n' ? 1 : 2;
  const desde = inicioDeLinea(configuracion, linea);
  const hasta = desde + largoLinea + largo;
  return Uint8Array.from([...original.subarray(0, desde), ...original.subarray(hasta)]);
}

function hayBna10(advertencias: readonly AdvertenciaBna[]): boolean {
  return advertencias.length > 0;
}

describe('inspector BNA · archivo válido', () => {
  it('acepta LF sin trailing y devuelve total, cantidad y registros', () => {
    const configuracion = config({ lineSeparator: '\n', trailingSeparator: false });
    const pagos = [pagoSintetico(1), pagoSintetico(2)];
    const bytes = bytesValidos(configuracion, pagos);
    const inspeccion = inspeccionOk(bytes, configuracion);
    expect(inspeccion.registros.map((registro) => registro.registroId)).toEqual([
      'BNA_R1',
      'BNA_R2',
      'BNA_R2',
      'BNA_R3',
    ]);
    expect(inspeccion.cantidadCalculada).toBe(2);
    expect(inspeccion.cantidadDeclarada).toBe(2);
    expect(inspeccion.totalCalculado).toBe(pagos.reduce((total, pago) => total + pago.neto, 0n));
    expect(inspeccion.advertencias).toEqual([]);
  });

  it('acepta CRLF con trailing true', () => {
    const configuracion = config({ lineSeparator: '\r\n', trailingSeparator: true });
    const inspeccion = inspeccionOk(bytesValidos(configuracion), configuracion);
    expect(inspeccion.cantidadDeclarada).toBe(1);
    expect(inspeccion.advertencias).toEqual([]);
  });

  it('calcula el total y la cantidad desde bytes, no desde parámetros de generación', () => {
    const configuracion = config();
    const bytes = bytesValidos(configuracion, [pagoSintetico(1, { neto: 7n as never })]);
    const inspeccion = inspeccionOk(bytes, configuracion);
    expect(inspeccion.totalCalculado).toBe(7n);
    expect(inspeccion.totalDeclarado).toBe(7n);
  });
});

describe('inspector BNA · mutaciones de bytes', () => {
  it('detecta un importe R2 mutado sin total actualizado', () => {
    const configuracion = config();
    const bytes = bytesValidos(configuracion);
    const mutado = mutarCampo(bytes, configuracion, 1, 'r2_importe', '0000123458');
    expect(codigos(mutado, configuracion)).toContain('TOTAL_DECLARADO_DISTINTO');
  });

  it('detecta una cantidad declarada mutada', () => {
    const configuracion = config();
    const bytes = bytesValidos(configuracion);
    const mutado = mutarCampo(bytes, configuracion, 2, 'r3_totalCantidad', '0000002');
    expect(codigos(mutado, configuracion)).toContain('CANTIDAD_DECLARADA_DISTINTA');
  });

  it('detecta un total declarado mutado', () => {
    const configuracion = config();
    const bytes = bytesValidos(configuracion);
    const mutado = mutarCampo(bytes, configuracion, 2, 'r3_totalImporte', '000000000123458');
    expect(codigos(mutado, configuracion)).toContain('TOTAL_DECLARADO_DISTINTO');
  });

  it('detecta la eliminación de un R2, R1 o R3 en la estructura', () => {
    const configuracion = config();
    const uno = bytesValidos(configuracion);
    expect(codigos(borrarLinea(uno, configuracion, 1), configuracion)).toContain(
      'ARCHIVO_BNA_INVALIDO',
    );
    const dos = bytesValidos(configuracion, [pagoSintetico(1), pagoSintetico(2)]);
    expect(codigos(borrarLinea(dos, configuracion, 1), configuracion)).toContain(
      'CANTIDAD_DECLARADA_DISTINTA',
    );
    expect(codigos(borrarLinea(dos, configuracion, 0), configuracion)).toContain(
      'ARCHIVO_BNA_INVALIDO',
    );
    expect(codigos(borrarLinea(dos, configuracion, 3), configuracion)).toContain(
      'ARCHIVO_BNA_INVALIDO',
    );
  });

  it('detecta truncamiento, byte extra y BOM', () => {
    const configuracion = config();
    const bytes = bytesValidos(configuracion);
    expect(codigos(bytes.slice(0, -1), configuracion)).toContain('ARCHIVO_BNA_INVALIDO');
    const extra = Uint8Array.from([...bytes, 0x58]);
    expect(codigos(extra, configuracion)).toContain('ARCHIVO_BNA_INVALIDO');
    const bom = Uint8Array.from([0xef, 0xbb, 0xbf, ...bytes]);
    expect(codigos(bom, configuracion)).toContain('ARCHIVO_BNA_INVALIDO');
  });

  it('detecta minúsculas en un campo A con el código BNA-8', () => {
    const configuracion = config();
    const bytes = bytesValidos(configuracion);
    const mutado = mutarCampo(bytes, configuracion, 1, 'r2_referencia', 'hABERES OCTUBRE');
    const encontrados = errores(mutado, configuracion);
    expect(encontrados.map((error) => error.codigo)).toContain('ALFABETO_BNA8_INVALIDO');
    expect(encontrados.some((error) => error.campoId === 'r2_referencia')).toBe(true);
    expect(encontrados.some((error) => error.linea === 2)).toBe(true);
  });

  it('detecta tabulaciones y bytes no ASCII mutados (capa técnica F4)', () => {
    const configuracion = config();
    const bytes = bytesValidos(configuracion);
    for (const byte of [0x09, 0x0d, 0x0a, 0xf1, 0xe1]) {
      const mutado = mutarByte(bytes, configuracion, 1, 'r2_referencia', byte);
      const encontrados = errores(mutado, configuracion);
      expect(encontrados[0]?.codigo).toBe('ARCHIVO_BNA_INVALIDO');
      expect(encontrados[0]?.erroresTecnicos).toBeDefined();
    }
  });

  it('detecta separador distinto al declarado', () => {
    const configuracion = config({ lineSeparator: '\r\n', trailingSeparator: false });
    const bytes = bytesValidos(configuracion);
    const mutado = Uint8Array.from(bytes);
    // Reemplaza el primer CRLF por LF: el scanner detecta mezcla/final inválido.
    mutado[200] = 0x0a;
    mutado.copyWithin(201, 202);
    expect(codigos(mutado.slice(0, -1), configuracion)).toContain('ARCHIVO_BNA_INVALIDO');
  });
});

describe('inspector BNA · BNA-10 advertencia no bloqueante', () => {
  it('informa cuentas repetidas sin deduplicar y sin bloquear', () => {
    const configuracion = config();
    const pago = pagoSintetico(1);
    const bytes = bytesValidos(configuracion, [pago, mismaCuenta(pago)]);
    const inspeccion = inspeccionOk(bytes, configuracion);
    expect(
      inspeccion.registros.filter((registro) => registro.registroId === 'BNA_R2'),
    ).toHaveLength(2);
    expect(inspeccion.cantidadCalculada).toBe(2);
    expect(hayBna10(inspeccion.advertencias)).toBe(true);
    const advertencia = inspeccion.advertencias[0];
    expect(advertencia?.lineas).toEqual([2, 3]);
  });

  it('no advierte cuando las identidades bancarias son distintas', () => {
    const configuracion = config();
    const inspeccion = inspeccionOk(
      bytesValidos(configuracion, [pagoSintetico(1), pagoSintetico(2)]),
      configuracion,
    );
    expect(hayBna10(inspeccion.advertencias)).toBe(false);
  });

  it('BNA-10 no se resuelve ni se convierte en error de generación', () => {
    const configuracion = config();
    const pago = pagoSintetico(1);
    const inspeccion = inspeccionOk(
      bytesValidos(configuracion, [pago, mismaCuenta(pago)]),
      configuracion,
    );
    expect(inspeccion.advertencias).toHaveLength(1);
    expect(inspeccion.registros).toHaveLength(4);
  });
});
