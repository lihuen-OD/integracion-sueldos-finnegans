// T3-11/D-066: edición UPDATE-only del maestro. Identidad, archivo original, huellas de
// conciliación y decisiones NO se modifican (D-062); la revisión solo crece con un UPDATE
// que realmente cambia la representación lógica. Datos bancarios sintéticos.
import { describe, expect, it } from 'vitest';
import {
  CAMPOS_EDITABLES_MAESTRO,
  actualizarCampoBancario,
  validarCamposBancarios,
} from '../../../src/domain/maestro';
import type { MasterRecord } from '../../../src/domain/maestro';
import { parseMaestro } from '../../../src/import/master/parseMaestro';
import { maestroLibro, personas, registroBna } from '../../fixtures/synthetic/escenarios.ts';
import { createRandom } from '../../fixtures/synthetic/identities.ts';

const VALORES = validarCamposBancarios({
  CBU: { tipo: 'TEXTO', texto: 'x'.repeat(22) },
  PAT_TIPO_CUENTA: { tipo: 'TEXTO', texto: '2' },
  PAT_NUMERO_CUENTA: { tipo: 'TEXTO', texto: '937142' },
  PAT_CODIGO_BANCO: { tipo: 'TEXTO', texto: '034' },
  PAT_CODIGO_SUCURSAL: { tipo: 'TEXTO', texto: '100' },
  PAT_TIPO_DOCUMENTO: { tipo: 'TEXTO', texto: '001' },
  PAT_NUMERO_DOCUMENTO: { tipo: 'TEXTO', texto: '20000000' },
  PAT_CODIGO_DEPENDENCIA: { tipo: 'TEXTO', texto: '100' },
});

const INCOMPATIBLE = {
  estado: 'INVALIDO',
  texto: '02',
  motivo: 'NO_CORRESPONDE_AL_TIPO_DOCUMENTO',
} as const;

const REGISTRO: MasterRecord = {
  ref: { archivo: 'MAESTRO', hoja: 'Empleados', fila: 2 },
  cuilTexto: 'x',
  cuil: null,
  legajo: null,
  apellidoNombreRef: '',
  cbu: VALORES.cbu,
  patagonia: VALORES.patagonia,
};

describe('actualizarCampoBancario (UPDATE-only, validación F2 intacta)', () => {
  it('rechaza un valor inválido y NO modifica nada', () => {
    const r = actualizarCampoBancario(REGISTRO, 'PAT_CODIGO_BANCO', '34');
    expect(r.ok).toBe(false);
    if (!r.ok && r.campo.estado === 'INVALIDO') {
      expect('motivo' in r.campo).toBe(true);
      if ('motivo' in r.campo) {
        expect(r.campo.motivo).toBe('LONGITUD_INVALIDA');
      }
      expect(r.campo.texto).toBe('34');
    }
  });

  it('vaciar un campo es UPDATE válido (VACIO es estado F2)', () => {
    const r = actualizarCampoBancario(REGISTRO, 'PAT_CODIGO_SUCURSAL', '');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.registro.patagonia.codigoSucursal).toEqual({ estado: 'VACIO' });
    }
  });

  it('campos no tocados quedan idénticos (no reinterpretación de celdas existentes)', () => {
    const r = actualizarCampoBancario(REGISTRO, 'PAT_TIPO_CUENTA', '1');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.registro.patagonia.numeroCuenta).toEqual(REGISTRO.patagonia.numeroCuenta);
      expect(r.registro.cbu).toEqual(REGISTRO.cbu);
      expect(r.registro.ref).toEqual(REGISTRO.ref);
      expect(r.registro.cuilTexto).toBe(REGISTRO.cuilTexto);
      expect(r.registro.patagonia.codigoBanco).toEqual(REGISTRO.patagonia.codigoBanco);
      expect(r.registro.patagonia.tipoCuenta).toEqual({
        estado: 'VALIDO',
        texto: '1',
        valor: '1',
      });
    }
  });

  it('identidad NUNCA editable por tipo (lista cerrada, sin PAT_CODIGO_DEPENDENCIA)', () => {
    expect(CAMPOS_EDITABLES_MAESTRO).toEqual([
      'CBU',
      'PAT_TIPO_CUENTA',
      'PAT_NUMERO_CUENTA',
      'PAT_CODIGO_BANCO',
      'PAT_CODIGO_SUCURSAL',
      'PAT_TIPO_DOCUMENTO',
      'PAT_NUMERO_DOCUMENTO',
      'PAT_PROVINCIA_DOCUMENTO',
    ]);
  });
});

describe('FIX 1 · el UPDATE del editor no crea N+1 si el par tipo/provincia queda inválido', () => {
  /** Tipo 004 + provincia válida '02' (consultable por catálogo). */
  function registro004ConProvincia(): MasterRecord {
    const patagonia = validarCamposBancarios({
      PAT_TIPO_DOCUMENTO: { tipo: 'TEXTO', texto: '004' },
      PAT_PROVINCIA_DOCUMENTO: { tipo: 'TEXTO', texto: '02' },
    }).patagonia;
    expect(patagonia.tipoDocumento.estado).toBe('VALIDO');
    expect(patagonia.provinciaDocumento.estado).toBe('VALIDO');
    return { ...REGISTRO, patagonia };
  }

  it('1 · tipo 004 + provincia válida → intentar tipo 001: edición rechazada', () => {
    const registro = registro004ConProvincia();
    const r = actualizarCampoBancario(registro, 'PAT_TIPO_DOCUMENTO', '001');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.campo).toEqual(INCOMPATIBLE);
    }
    // registro anterior intacto: ni el tipo ni la provincia cambiaron
    expect(registro.patagonia.tipoDocumento).toEqual({
      estado: 'VALIDO',
      texto: '004',
      valor: '004',
    });
    expect(registro.patagonia.provinciaDocumento.estado).toBe('VALIDO');
  });

  it('re · path válido en dos UPDATEs: primero vacía provincia (N+1), luego cambia tipo (N+2)', () => {
    const registro = registro004ConProvincia();
    const vaciado = actualizarCampoBancario(registro, 'PAT_PROVINCIA_DOCUMENTO', '');
    expect(vaciado.ok).toBe(true); // VACIO siempre compatible
    if (vaciado.ok) {
      expect(vaciado.registro.patagonia.provinciaDocumento).toEqual({ estado: 'VACIO' });
      const cambio = actualizarCampoBancario(vaciado.registro, 'PAT_TIPO_DOCUMENTO', '001');
      expect(cambio.ok).toBe(true); // sin provincia, no hay cruce que viole
      if (cambio.ok) {
        expect(cambio.registro.patagonia.tipoDocumento).toEqual({
          estado: 'VALIDO',
          texto: '001',
          valor: '001',
        });
      }
    }
  });

  it('3 · editar provincia incompatible con el tipo actual (tipo 001) → rechazo, sin N+1', () => {
    // REGISTRO base: tipo '001' (no 004) y provincia vacía; cargar una provincia de catálogo
    // introduce por el cruce una incompatibilidad NUEVA → la edición rechaza.
    const r = actualizarCampoBancario(REGISTRO, 'PAT_PROVINCIA_DOCUMENTO', '02');
    expect(r.ok).toBe(false);
    if (!r.ok && r.campo.estado === 'INVALIDO') {
      expect(r.campo.motivo).toBe('NO_CORRESPONDE_AL_TIPO_DOCUMENTO');
      expect(r.campo.texto).toBe('02');
    }
    expect(REGISTRO.patagonia.provinciaDocumento).toEqual({ estado: 'VACIO' });
  });

  it('4 · combinación válida sigue funcionando como UPDATE único (tipo 004 + provincia)', () => {
    const registro = registro004ConProvincia();
    const r = actualizarCampoBancario(registro, 'PAT_PROVINCIA_DOCUMENTO', '06');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.registro.patagonia.provinciaDocumento).toEqual({
        estado: 'VALIDO',
        texto: '06',
        valor: '06',
      });
      expect(r.registro.patagonia.tipoDocumento).toEqual({
        estado: 'VALIDO',
        texto: '004',
        valor: '004',
      });
    }
  });

  it('F · IMPORTAR conserva el estado leído tal cual (parser intacto, sin normalizar)', () => {
    const persona = personas(1, 15)[0];
    if (persona === undefined) {
      throw new Error('persona esperada');
    }
    const registrosIncompatibles = [
      registroBna(persona, createRandom(15), {
        PAT_TIPO_DOCUMENTO: '001',
        PAT_PROVINCIA_DOCUMENTO: '02',
      }),
    ];
    const lectura = parseMaestro(maestroLibro(registrosIncompatibles, {}));
    const registro = lectura.registros[0];
    if (registro === undefined) {
      throw new Error('fixture vacío');
    }
    expect(registro.patagonia.tipoDocumento).toEqual({
      estado: 'VALIDO',
      texto: '001',
      valor: '001',
    });
    expect(registro.patagonia.provinciaDocumento).toEqual(INCOMPATIBLE);
  });

  it('estado importado inválido: editar el par sin corregirlo no crea revisión (rechazo)', () => {
    // mismo par importado (tipo 001 + provincia 02 → INVALIDO/NO_CORRESPONDE): una
    // edición del par cuyo resultado sigue incompatible — aunque la incompatibilidad
    // venga del import — → rechazo, estado anterior intacto (microcorrectivo).
    const imported = validarCamposBancarios({
      PAT_TIPO_DOCUMENTO: { tipo: 'TEXTO', texto: '001' },
      PAT_PROVINCIA_DOCUMENTO: { tipo: 'TEXTO', texto: '02' },
    }).patagonia;
    expect(imported.provinciaDocumento).toEqual(INCOMPATIBLE);
    const registroImportado: MasterRecord = { ...REGISTRO, patagonia: imported };
    const r = actualizarCampoBancario(registroImportado, 'PAT_TIPO_DOCUMENTO', '002');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.campo).toEqual(INCOMPATIBLE);
    }
    expect(registroImportado.patagonia.provinciaDocumento).toEqual(INCOMPATIBLE);
  });

  it('vaciar el tipo es UPDATE válido y deja la provincia tal cual (sin normalizarla)', () => {
    const registro = registro004ConProvincia();
    const r = actualizarCampoBancario(registro, 'PAT_TIPO_DOCUMENTO', '');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.registro.patagonia.tipoDocumento).toEqual({ estado: 'VACIO' });
      expect(r.registro.patagonia.provinciaDocumento).toEqual({
        estado: 'VALIDO',
        texto: '02',
        valor: '02',
      });
    }
  });
});

describe('FIX 1-a · caminos que CORRIGEN la incompatibilidad importada (permitidos)', () => {
  function importadoIncompatible(): MasterRecord {
    const imported = validarCamposBancarios({
      PAT_TIPO_DOCUMENTO: { tipo: 'TEXTO', texto: '001' },
      PAT_PROVINCIA_DOCUMENTO: { tipo: 'TEXTO', texto: '02' },
    }).patagonia;
    expect(imported.provinciaDocumento).toEqual(INCOMPATIBLE);
    return { ...REGISTRO, patagonia: imported };
  }

  it('A · importado 001 + provincia 02 → provincia 02→06: rechazo, sin revisión', () => {
    const registro = importadoIncompatible();
    const r = actualizarCampoBancario(registro, 'PAT_PROVINCIA_DOCUMENTO', '06');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.campo).toEqual({
        estado: 'INVALIDO',
        texto: '06', // el texto NUEVO es el que el cruce marca incompatible
        motivo: 'NO_CORRESPONDE_AL_TIPO_DOCUMENTO',
      });
    }
    expect(registro.patagonia.provinciaDocumento).toEqual(INCOMPATIBLE);
  });

  it('B · importado 001 + provincia 02 → tipo 001→002: rechazo, sin revisión', () => {
    const registro = importadoIncompatible();
    const r = actualizarCampoBancario(registro, 'PAT_TIPO_DOCUMENTO', '002');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.campo).toEqual(INCOMPATIBLE);
    }
    expect(registro.patagonia.tipoDocumento).toEqual({
      estado: 'VALIDO',
      texto: '001',
      valor: '001',
    });
  });

  it('C · mismos datos importados → vaciar provincia: UPDATE válido (corrige)', () => {
    const r = actualizarCampoBancario(importadoIncompatible(), 'PAT_PROVINCIA_DOCUMENTO', '');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.registro.patagonia.provinciaDocumento).toEqual({ estado: 'VACIO' });
    }
  });

  it('D · mismos datos importados → tipo 004 revalida la provincia: UPDATE válido (corrige)', () => {
    const r = actualizarCampoBancario(importadoIncompatible(), 'PAT_TIPO_DOCUMENTO', '004');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.registro.patagonia.tipoDocumento).toEqual({
        estado: 'VALIDO',
        texto: '004',
        valor: '004',
      });
      expect(r.registro.patagonia.provinciaDocumento).toEqual({
        estado: 'VALIDO',
        texto: '02',
        valor: '02',
      });
    }
  });
});
