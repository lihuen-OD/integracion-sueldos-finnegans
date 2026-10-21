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

  it('cruza provincia suelta con tipo 004 al editar provincia (D-048/F2)', () => {
    const r = actualizarCampoBancario(REGISTRO, 'PAT_PROVINCIA_DOCUMENTO', '12');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.registro.patagonia.provinciaDocumento).toEqual({
        estado: 'INVALIDO',
        texto: '12',
        motivo: 'NO_CORRESPONDE_AL_TIPO_DOCUMENTO',
      });
    }
  });

  it('cruza provincia con tipo edits: soltar tipo 004 y provincia valida cruce', () => {
    const documentoCon004 = validarCamposBancarios({
      PAT_TIPO_DOCUMENTO: { tipo: 'TEXTO', texto: '004' },
      PAT_PROVINCIA_DOCUMENTO: { tipo: 'TEXTO', texto: '02' },
    }).patagonia;
    const registro004: MasterRecord = { ...REGISTRO, patagonia: documentoCon004 };
    const r = actualizarCampoBancario(registro004, 'PAT_TIPO_DOCUMENTO', '001');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.registro.patagonia.provinciaDocumento).toEqual({
        estado: 'INVALIDO',
        texto: '02',
        motivo: 'NO_CORRESPONDE_AL_TIPO_DOCUMENTO',
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
