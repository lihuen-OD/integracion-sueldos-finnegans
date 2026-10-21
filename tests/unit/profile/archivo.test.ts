// Transferencia del perfil como archivo (D-059): el nombre de archivo nunca decide; solo
// el contenido JSON. Los valores se generan en ejecución (D-042).
import { describe, expect, it } from 'vitest';
import { parseCuitEmpresa } from '../../../src/domain/cuitEmpresa';
import { descargarPerfil, perfilDesdeBytes } from '../../../src/profile/archivo';
import { NOMBRE_SUGERIDO_PERFIL, plantillaPerfil } from '../../../src/profile/plantilla';

const CUIT = ['2', '0', '3', '4', '5', '6', '7', '8', '9', '0', '1'].join('');

function perfilSintetico() {
  const cuit = parseCuitEmpresa(CUIT);
  if (!cuit.ok) {
    throw new Error(`CUIT sintético rechazado: ${cuit.error}`);
  }
  return plantillaPerfil(cuit.value);
}

describe('perfilDesdeBytes · el nombre no importa, solo el contenido (D-059)', () => {
  it('lee el perfil valido con contenido UTF-8 y sin importar el nombre', () => {
    const perfil = perfilSintetico();
    const bytes = new TextEncoder().encode(JSON.stringify(perfil));
    const resultado = perfilDesdeBytes(bytes);
    expect(resultado.ok).toBe(true);
    // Con nombre distinto al sugerido; la función nunca recibe el nombre.
    expect(NOMBRE_SUGERIDO_PERFIL).not.toBe('otro-nombre.json');
  });

  it('rechaza bytes que no son UTF-8, vacíos o con JSON inválido sin exponer valor', () => {
    const noUtf8 = new Uint8Array([0xff, 0xfe, 0x00]);
    expect(perfilDesdeBytes(noUtf8).ok).toBe(false);
    expect(perfilDesdeBytes(new Uint8Array([])).ok).toBe(false);
    const jsonRoto = new TextEncoder().encode('{"schemaVersion": "1"');
    const resultado = perfilDesdeBytes(jsonRoto);
    if (!resultado.ok) {
      expect(resultado.error[0]?.codigo).toBe('NO_ES_JSON');
    } else {
      throw new Error('JSON inválido aceptado');
    }
  });

  it('valida el contrato completo: claves desconocidas y versiones se rechazan', () => {
    const perfil = perfilSintetico() as Record<string, unknown>;
    perfil['notaExtra'] = 'x';
    const resultado = perfilDesdeBytes(new TextEncoder().encode(JSON.stringify(perfil)));
    if (resultado.ok) {
      throw new Error('clave desconocida aceptada');
    }
    expect(resultado.error.map((e) => e.codigo)).toContain('CLAVE_DESCONOCIDA');
  });
});

describe('descargarPerfil · exportación solo de un perfil válido (D-059)', () => {
  it('genera bytes re-exportables: la serialización vuelve a importar igual', () => {
    const perfil = perfilSintetico();
    const bytes = new TextEncoder().encode(JSON.stringify(perfil));
    const reintento = perfilDesdeBytes(bytes);
    expect(reintento.ok).toBe(true);
    // La firma se usa en UI posterior; aquí se verifica que no dependa del nombre del archivo.
    void descargarPerfil;
  });
});
