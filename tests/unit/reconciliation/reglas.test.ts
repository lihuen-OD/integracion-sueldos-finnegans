// Reglas de conciliación (docs/03 §E.2), una por bloque. Datos 100 % sintéticos (D-042).
import { describe, expect, it } from 'vitest';
import type { BancoCatalogado } from '../../../src/domain/destino';
import {
  filaFinnegans,
  registroBna,
  registroPatagonia,
  textoDeCelda,
} from '../../fixtures/synthetic/escenarios.ts';
import { BANCO_NACION, BANCO_PATAGONIA } from '../../fixtures/synthetic/finnegansLike.ts';
import {
  createRandom,
  syntheticCbu,
  syntheticCuenta,
} from '../../fixtures/synthetic/identities.ts';
import { formula, num } from '../../fixtures/synthetic/xlsxBuilder.ts';
import { escenario, gente, primera, resumen } from './helpers.ts';

const persona = gente(12, 31);
const random = createRandom(31);
const bnaDe = (i: number, cambios = {}) => registroBna(persona(i), random, cambios);
const patDe = (i: number, cambios = {}) => registroPatagonia(persona(i), random, cambios);
const filaBna = (i: number, cambios = {}) =>
  filaFinnegans(persona(i), { Banco: BANCO_NACION, ...cambios });
/** Fila BNA con otro legajo, coherente con Legajoapellidonombre (aísla la regla 9). */
const conLegajo = (i: number, legajo: string) =>
  filaFinnegans(
    { ...persona(i), legajo },
    { Banco: BANCO_NACION, Legajo: legajo === '' ? null : legajo },
  );
const filaPat = (i: number, cambios = {}) =>
  filaFinnegans(persona(i), { Banco: BANCO_PATAGONIA, ...cambios });

describe('caso feliz', () => {
  it('BNA y Patagonia con maestro completo: incluidas, cruzadas y sin incidencias', () => {
    const resultado = escenario([filaBna(0), filaPat(1)], [bnaDe(0), patDe(1)]);
    const [bna, pat] = resultado.filas;
    expect(bna?.estado).toEqual({
      estado: 'INCLUIDA',
      destino: 'BNA_GT_HABERES',
      origen: 'BANCO_FINNEGANS',
    });
    expect(pat?.estado).toEqual({
      estado: 'INCLUIDA',
      destino: 'PATAGONIA_B2',
      origen: 'BANCO_FINNEGANS',
    });
    expect(bna?.registro?.cuil).toBe(bna?.linea.cuil);
    expect([bna?.nivel, pat?.nivel]).toEqual(['CORRECTO', 'CORRECTO']);
    expect(resultado.incidencias).toEqual([]);
  });
});

describe('regla 4 · neto cero (D-016, D-034)', () => {
  it('se excluye e informa; no exige maestro ni datos bancarios', () => {
    const fila = primera(escenario([filaPat(0, { Neto: '0' })], []));
    expect(fila.estado).toEqual({ estado: 'EXCLUIDA', motivo: 'NETO_CERO' });
    expect(resumen(fila)).toEqual(['NETO_CERO:INFORMACION:GLOBAL']);
    expect(fila.registro).toBeNull();
  });

  it('se excluye aunque el banco esté vacío o no soportado', () => {
    const resultado = escenario(
      [
        filaFinnegans(persona(0), { Neto: '0', Banco: null }),
        filaFinnegans(persona(1), { Neto: '0', Banco: 'OTRO' }),
      ],
      [],
    );
    expect(resultado.filas.map((f) => f.estado.estado)).toEqual(['EXCLUIDA', 'EXCLUIDA']);
  });

  it('identificación de la fila: CUIL inválido sigue bloqueando (global, P-25)', () => {
    const cuil = persona(0).cuil;
    const fila = primera(escenario([filaBna(0, { Neto: '0', Cuil: `${cuil.slice(0, -1)}x` })], []));
    expect(resumen(fila)).toEqual([
      'CUIL_INVALIDO:BLOQUEANTE:GLOBAL',
      'NETO_CERO:INFORMACION:GLOBAL',
    ]);
  });

  it('identificación de la fila: CUIL repetido sigue bloqueando aunque esté excluida (P-29.1)', () => {
    const resultado = escenario(
      [filaPat(0, { Neto: '0' }), filaBna(1, { Cuil: persona(0).cuil })],
      [bnaDe(1, { CUIL: persona(0).cuil })],
    );
    const [excluida, conPago] = resultado.filas;
    expect(excluida?.estado).toEqual({ estado: 'EXCLUIDA', motivo: 'NETO_CERO' });
    // Sin maestro ni datos bancarios exigidos: solo identificación y la exclusión.
    expect(excluida?.registro).toBeNull();
    expect(resumen(excluida)).toEqual([
      'CUIL_REPETIDO_FINNEGANS:BLOQUEANTE:GLOBAL',
      'NETO_CERO:INFORMACION:GLOBAL',
    ]);
    expect(resumen(conPago)).toContain('CUIL_REPETIDO_FINNEGANS:BLOQUEANTE:BNA_GT_HABERES');
    // Nunca se suman ni fusionan.
    expect(resultado.filas).toHaveLength(2);
  });

  it('datos que no hacen falta para un pago inexistente (legajo, banco) solo se informan', () => {
    const fila = primera(
      escenario([filaBna(0, { Neto: '0', Legajo: num('7'), Banco: num('11') })], []),
    );
    expect(resumen(fila)).toEqual([
      'CELDA_NUMERICA_EN_TEXTO:INFORMACION:GLOBAL',
      'TIPO_CELDA_INVALIDO:INFORMACION:GLOBAL',
      'NETO_CERO:INFORMACION:GLOBAL',
    ]);
  });

  it('un neto ilegible no es cero: no se excluye por inferencia', () => {
    const fila = primera(escenario([filaBna(0, { Neto: null })], [bnaDe(0)]));
    expect(fila.estado.estado).toBe('INCLUIDA');
    expect(resumen(fila)).toContain('IMPORTE_INVALIDO:BLOQUEANTE:GLOBAL');
  });
});

describe('reglas 10 y 11 · destino (D-013, D-014, D-049)', () => {
  it.each([
    ['vacío', null, ''],
    ['solo espacios', '   ', '   '],
  ])(
    'banco %s → PENDIENTE y REQUIERE_REVISION global; no se infiere destino',
    (_caso, banco, original) => {
      const fila = primera(escenario([filaFinnegans(persona(0), { Banco: banco })], []));
      expect(fila.estado).toEqual({ estado: 'PENDIENTE', motivo: 'BANCO_VACIO' });
      expect(fila.incidencias).toEqual([
        expect.objectContaining({
          codigo: 'BANCO_VACIO',
          nivel: 'REQUIERE_REVISION',
          alcance: 'GLOBAL',
          valores: { finnegans: original },
        }),
      ]);
    },
  );

  it('las reglas de banco no se aplican mientras el destino esté pendiente', () => {
    const fila = primera(escenario([filaFinnegans(persona(0), { Banco: null, Neto: '-1' })], []));
    expect(resumen(fila)).toEqual(['BANCO_VACIO:REQUIERE_REVISION:GLOBAL']);
  });

  it.each([
    ['otro banco', 'BANCO DE PRUEBA S.A.', 'FUERA_DE_CATALOGO'],
    ['variante con espacio final', `${BANCO_PATAGONIA} `, 'FUERA_DE_CATALOGO'],
    ['minúsculas', BANCO_NACION.toLowerCase(), 'FUERA_DE_CATALOGO'],
  ])('banco %s → PENDIENTE y BLOQUEANTE global; nunca se reasigna', (_caso, banco, motivo) => {
    const fila = primera(escenario([filaFinnegans(persona(0), { Banco: banco })], [bnaDe(0)]));
    expect(fila.estado).toEqual({ estado: 'PENDIENTE', motivo: 'BANCO_NO_SOPORTADO' });
    expect(fila.incidencias).toEqual([
      expect.objectContaining({
        codigo: 'BANCO_NO_SOPORTADO',
        nivel: 'BLOQUEANTE',
        alcance: 'GLOBAL',
        motivo,
      }),
    ]);
  });

  it('banco ilegible → no soportado (falla segura)', () => {
    const fila = primera(escenario([filaFinnegans(persona(0), { Banco: num('11') })], [bnaDe(0)]));
    expect(resumen(fila)).toEqual([
      'TIPO_CELDA_INVALIDO:BLOQUEANTE:GLOBAL',
      'BANCO_NO_SOPORTADO:BLOQUEANTE:GLOBAL',
    ]);
    expect(fila.incidencias[1]?.motivo).toBe('CELDA_ILEGIBLE');
  });

  it('banco con fórmula cuyo valor en caché es un banco del catálogo: nunca se infiere (P-29.13)', () => {
    const fila = primera(
      escenario(
        [filaFinnegans(persona(0), { Banco: formula('"BANCO"', BANCO_NACION) })],
        [bnaDe(0)],
      ),
    );
    expect(fila.estado).toEqual({ estado: 'PENDIENTE', motivo: 'BANCO_NO_SOPORTADO' });
    // Ambas incidencias apuntan al mismo efecto (bloqueo global), sin contradicción.
    expect(resumen(fila)).toEqual([
      'FORMULA_EN_CELDA:BLOQUEANTE:GLOBAL',
      'BANCO_NO_SOPORTADO:BLOQUEANTE:GLOBAL',
    ]);
  });
});

describe('reglas 1 y 2 · CUIL (P-25, D-015)', () => {
  it('CUIL inválido: alcance del banco de la fila; no se cruza ni se informa SIN_MAESTRO', () => {
    const cuil = persona(0).cuil;
    const fila = primera(escenario([filaPat(0, { Cuil: cuil.replace('-', '.') })], [patDe(0)]));
    expect(resumen(fila)).toEqual(['CUIL_INVALIDO:BLOQUEANTE:PATAGONIA_B2']);
    expect(fila.registro).toBeNull();
  });

  it('CUIL inválido en una fila sin destino: global', () => {
    const fila = primera(escenario([filaFinnegans(persona(0), { Banco: null, Cuil: '' })], []));
    expect(resumen(fila)).toEqual([
      'CUIL_INVALIDO:BLOQUEANTE:GLOBAL',
      'BANCO_VACIO:REQUIERE_REVISION:GLOBAL',
    ]);
  });

  it('CUIL repetido en bancos distintos: bloquea cada fila en su banco, sin sumar ni fusionar', () => {
    const resultado = escenario(
      [filaBna(0, { Neto: '100' }), filaPat(1, { Cuil: persona(0).cuil, Neto: '200' })],
      [bnaDe(0)],
    );
    expect(resultado.filas).toHaveLength(2);
    expect(resultado.filas.map((f) => f.linea.neto)).toEqual([10_000n, 20_000n]);
    expect(resumen(resultado.filas[0])).toContain(
      'CUIL_REPETIDO_FINNEGANS:BLOQUEANTE:BNA_GT_HABERES',
    );
    expect(resumen(resultado.filas[1])).toContain(
      'CUIL_REPETIDO_FINNEGANS:BLOQUEANTE:PATAGONIA_B2',
    );
  });
});

describe('regla 3 · duplicados del maestro (D-047)', () => {
  it('CUIL duplicado usado por una fila: BLOQUEANTE de ese banco y no se elige ninguno', () => {
    const fila = primera(escenario([filaBna(0)], [bnaDe(0), bnaDe(0, { LEGAJO: '999' })]));
    expect(fila.registro).toBeNull();
    expect(resumen(fila)).toEqual([
      'CUIL_REPETIDO_MAESTRO:BLOQUEANTE:BNA_GT_HABERES',
      'CUIL_REPETIDO_MAESTRO:BLOQUEANTE:BNA_GT_HABERES',
    ]);
  });

  it('CUIL duplicado que no participa: solo informa y no bloquea a nadie', () => {
    const resultado = escenario([filaBna(0)], [bnaDe(0), bnaDe(1), bnaDe(1)]);
    expect(primera(resultado).nivel).toBe('CORRECTO');
    const duplicados = resultado.incidencias.filter((i) => i.codigo === 'CUIL_REPETIDO_MAESTRO');
    expect(duplicados.map((i) => `${i.nivel}:${i.alcance}`)).toEqual([
      'INFORMACION:GLOBAL',
      'INFORMACION:GLOBAL',
    ]);
  });

  it('CUIL duplicado usado por una fila pendiente: BLOQUEANTE global', () => {
    const fila = primera(
      escenario([filaFinnegans(persona(0), { Banco: null })], [bnaDe(0), bnaDe(0)]),
    );
    expect(resumen(fila)).toContain('CUIL_REPETIDO_MAESTRO:BLOQUEANTE:GLOBAL');
  });

  it('CUIL duplicado usado solo por una fila excluida: no participa del pago → informa', () => {
    const resultado = escenario([filaBna(0, { Neto: '0' })], [bnaDe(0), bnaDe(0)]);
    expect(
      resultado.incidencias.filter((i) => i.codigo === 'CUIL_REPETIDO_MAESTRO').map((i) => i.nivel),
    ).toEqual(['INFORMACION', 'INFORMACION']);
  });

  it('LEGAJO duplicado en el maestro usado por una fila: BLOQUEANTE de su banco', () => {
    const fila = primera(
      escenario([filaPat(0)], [patDe(0, { LEGAJO: '777' }), bnaDe(1, { LEGAJO: '777' })]),
    );
    expect(resumen(fila)).toEqual([
      'LEGAJO_REPETIDO_MAESTRO:BLOQUEANTE:PATAGONIA_B2',
      'LEGAJO_NO_COINCIDE:REQUIERE_REVISION:PATAGONIA_B2',
    ]);
  });
});

describe('regla 6 · neto negativo', () => {
  it('BLOQUEANTE del banco de la fila; no hay control de máximo por layout (D-047)', () => {
    const resultado = escenario(
      [
        filaBna(0, { Remunerativo: '0', 'No remunerativo': '0', Descuento: '10.5', Neto: '-10.5' }),
        filaBna(1, {
          Remunerativo: '9999999999999.99',
          'No remunerativo': '0',
          Descuento: '0',
          Neto: '9999999999999.99',
        }),
      ],
      [bnaDe(0), bnaDe(1)],
    );
    expect(resumen(resultado.filas[0])).toEqual(['NETO_NEGATIVO:BLOQUEANTE:BNA_GT_HABERES']);
    expect(resultado.filas[0]?.incidencias[0]?.valores).toEqual({ finnegans: '-10.50' });
    expect(resultado.filas[1]?.nivel).toBe('CORRECTO');
  });
});

describe('regla 7 · fila sin maestro (D-018)', () => {
  it('BLOQUEANTE solo del banco de la fila', () => {
    const resultado = escenario([filaBna(0), filaPat(1)], [bnaDe(0)]);
    expect(resultado.filas[0]?.nivel).toBe('CORRECTO');
    expect(resumen(resultado.filas[1])).toEqual(['SIN_MAESTRO:BLOQUEANTE:PATAGONIA_B2']);
  });
});

describe('regla 8 · maestro sin liquidación', () => {
  it('INFORMACION global; un registro usado por una fila excluida sí tiene liquidación', () => {
    const resultado = escenario(
      [filaBna(0), filaBna(1, { Neto: '0' })],
      [bnaDe(0), bnaDe(1), patDe(2)],
    );
    const sinLiquidacion = resultado.incidencias.filter(
      (i) => i.codigo === 'MAESTRO_SIN_LIQUIDACION',
    );
    expect(sinLiquidacion).toEqual([
      expect.objectContaining({
        nivel: 'INFORMACION',
        alcance: 'GLOBAL',
        refs: [{ archivo: 'MAESTRO', hoja: 'Empleados', fila: 4 }],
        valores: { maestro: persona(2).cuil },
      }),
    ]);
  });
});

describe('regla 9 · legajo EXACTO (D-017, D-053)', () => {
  it.each([
    ['007', '7'],
    ['007', '007 '],
    ['0042', '42'],
    [' 7', '7'],
  ])('Finnegans %j vs maestro %j → REQUIERE_REVISION con ambos valores', (finnegans, maestro) => {
    const fila = primera(escenario([conLegajo(0, finnegans)], [bnaDe(0, { LEGAJO: maestro })]));
    expect(fila.incidencias).toEqual([
      expect.objectContaining({
        codigo: 'LEGAJO_NO_COINCIDE',
        nivel: 'REQUIERE_REVISION',
        alcance: 'BNA_GT_HABERES',
        motivo: 'DIFERENCIA_EXACTA',
        valores: { finnegans, maestro },
      }),
    ]);
  });

  it('iguales exactos: sin incidencia', () => {
    expect(primera(escenario([conLegajo(0, '007')], [bnaDe(0, { LEGAJO: '007' })])).nivel).toBe(
      'CORRECTO',
    );
  });

  it('legajo vacío en Finnegans con legajo en el maestro: REQUIERE_REVISION, no bloqueante (D-053)', () => {
    const fila = primera(escenario([conLegajo(0, '')], [bnaDe(0, { LEGAJO: '007' })]));
    expect(fila.incidencias).toEqual([
      expect.objectContaining({
        codigo: 'LEGAJO_NO_COINCIDE',
        nivel: 'REQUIERE_REVISION',
        motivo: 'LEGAJO_FINNEGANS_VACIO',
        valores: { finnegans: '', maestro: '007' },
      }),
    ]);
    expect(fila.linea.legajo).toBe('');
  });

  it('el legajo del maestro es el de otra fila de Finnegans: se indica', () => {
    const resultado = escenario(
      [filaBna(0, { Legajo: '100' }), filaBna(1, { Legajo: '200' })],
      [bnaDe(0, { LEGAJO: '200' }), bnaDe(1, { LEGAJO: '200' })],
    );
    const legajo = resultado.filas[0]?.incidencias.find((i) => i.codigo === 'LEGAJO_NO_COINCIDE');
    expect(legajo?.motivo).toBe('LEGAJO_DE_OTRA_FILA');
    expect(legajo?.refs.map((ref) => `${ref.archivo}:${String(ref.fila)}`)).toEqual([
      'FINNEGANS:2',
      'MAESTRO:2',
      'FINNEGANS:3',
    ]);
  });

  it('legajo ilegible o faltante: aplican esos bloqueantes y la regla 9 no los oculta', () => {
    const resultado = escenario(
      [filaBna(0, { Legajo: num('7') }), filaBna(1)],
      [bnaDe(0), bnaDe(1, { LEGAJO: null })],
    );
    expect(resumen(resultado.filas[0])).toEqual([
      'CELDA_NUMERICA_EN_TEXTO:BLOQUEANTE:BNA_GT_HABERES',
    ]);
    expect(resumen(resultado.filas[1])).toEqual([
      'CAMPO_REQUERIDO_FALTANTE:BLOQUEANTE:BNA_GT_HABERES',
    ]);
  });
});

describe('regla 12 · banco incompatible con el maestro (D-018)', () => {
  it('CBU con la entidad cambiada sin recalcular el DV: CBU_INVALIDO del banco', () => {
    const cbu = textoDeCelda(bnaDe(5).CBU).replace(/^011/, '034');
    const fila = primera(escenario([filaBna(0)], [{ ...bnaDe(0), CBU: cbu }]));
    expect(resumen(fila)).toEqual(['CBU_INVALIDO:BLOQUEANTE:BNA_GT_HABERES']);
  });

  it('BNA con un CBU válido de la entidad 034 → BLOQUEANTE BNA', () => {
    const fila = primera(escenario([filaBna(0)], [{ ...bnaDe(0), CBU: cbuDeEntidad('034') }]));
    expect(fila.incidencias).toEqual([
      expect.objectContaining({
        codigo: 'BANCO_INCOMPATIBLE_MAESTRO',
        nivel: 'BLOQUEANTE',
        alcance: 'BNA_GT_HABERES',
        campo: 'CBU',
        motivo: 'ENTIDAD_CBU',
      }),
    ]);
  });

  it('Patagonia con PAT_CODIGO_BANCO de otra entidad → BLOQUEANTE Patagonia', () => {
    const fila = primera(escenario([filaPat(0)], [patDe(0, { PAT_CODIGO_BANCO: '011' })]));
    expect(fila.incidencias).toEqual([
      expect.objectContaining({
        codigo: 'BANCO_INCOMPATIBLE_MAESTRO',
        nivel: 'BLOQUEANTE',
        alcance: 'PATAGONIA_B2',
        campo: 'PAT_CODIGO_BANCO',
        motivo: 'CODIGO_BANCO',
      }),
    ]);
    expect(fila.nivel).toBe('BLOQUEANTE');
  });

  it('Patagonia con un CBU válido de otra entidad → solo INFORMACION; no bloquea (D-056)', () => {
    const fila = primera(escenario([filaPat(0)], [patDe(0, { CBU: cbuDeEntidad('011') })]));
    expect(fila.incidencias).toEqual([
      expect.objectContaining({
        codigo: 'BANCO_INCOMPATIBLE_MAESTRO',
        nivel: 'INFORMACION',
        alcance: 'PATAGONIA_B2',
        campo: 'CBU',
        motivo: 'ENTIDAD_CBU',
      }),
    ]);
    expect(fila.nivel).toBe('INFORMACION');
  });

  it('BNA no compara PAT_CODIGO_BANCO: no es un dato que consuma', () => {
    const fila = primera(escenario([filaBna(0)], [bnaDe(0, { PAT_CODIGO_BANCO: '034' })]));
    expect(fila.nivel).toBe('CORRECTO');
  });

  it('un catálogo propio sin la entidad del destino no se valida a ciegas', () => {
    const propio: BancoCatalogado[] = [
      {
        textoFinnegans: 'NACION',
        destino: 'BNA_GT_HABERES',
        entidadEsperada: '011',
        fuente: 'test',
      },
    ];
    const resultado = escenario([filaFinnegans(persona(0), { Banco: 'NACION' })], [bnaDe(0)], {
      catalogoBancos: propio,
    });
    expect(primera(resultado).nivel).toBe('CORRECTO');
  });
});

function cbuDeEntidad(entidad: string): string {
  return syntheticCbu(entidad, '0001', syntheticCuenta(random));
}

describe('regla 13 · datos del destino según D-048 (sin bloqueo cruzado)', () => {
  it('BNA sin CBU → CBU_FALTANTE BLOQUEANTE BNA', () => {
    expect(resumen(primera(escenario([filaBna(0)], [bnaDe(0, { CBU: null })])))).toEqual([
      'CBU_FALTANTE:BLOQUEANTE:BNA_GT_HABERES',
    ]);
  });

  it('BNA con CBU válido y PAT_TIPO_CUENTA inválido → solo INFORMACION; BNA no se bloquea', () => {
    const fila = primera(escenario([filaBna(0)], [bnaDe(0, { PAT_TIPO_CUENTA: '9' })]));
    expect(resumen(fila)).toEqual(['DATO_PATAGONIA_INVALIDO:INFORMACION:BNA_GT_HABERES']);
    expect(fila.nivel).toBe('INFORMACION');
    expect(fila.incidencias[0]).toMatchObject({
      campo: 'PAT_TIPO_CUENTA',
      motivo: 'FUERA_DE_CATALOGO',
      valores: { maestro: '9' },
    });
  });

  it('Patagonia sin número de cuenta → DATO_PATAGONIA_FALTANTE BLOQUEANTE Patagonia', () => {
    expect(
      resumen(primera(escenario([filaPat(0)], [patDe(0, { PAT_NUMERO_CUENTA: null })]))),
    ).toEqual(['DATO_PATAGONIA_FALTANTE:BLOQUEANTE:PATAGONIA_B2']);
  });

  it('Patagonia no consume el CBU: vacío, correcto; inválido, solo INFORMACION (D-056)', () => {
    const resultado = escenario(
      [filaPat(0), filaPat(1)],
      [patDe(0), patDe(1, { CBU: '0'.repeat(21) })],
    );
    expect(resultado.filas[0]?.nivel).toBe('CORRECTO');
    expect(resumen(resultado.filas[1])).toEqual(['CBU_INVALIDO:INFORMACION:PATAGONIA_B2']);
    expect(resultado.filas[1]?.nivel).toBe('INFORMACION');
  });

  it('simetría: BNA consume el CBU y no los PAT_*; Patagonia consume los PAT_* y no el CBU', () => {
    const resultado = escenario(
      [filaBna(0), filaPat(1)],
      [
        bnaDe(0, { PAT_NUMERO_CUENTA: 'x', PAT_TIPO_DOCUMENTO: '9' }),
        // 21 ceros + 1: el DV del bloque 2 debería ser 0 → CBU inválido.
        patDe(1, { CBU: `${'0'.repeat(21)}1` }),
      ],
    );
    expect(resumen(resultado.filas[0])).toEqual([
      'DATO_PATAGONIA_INVALIDO:INFORMACION:BNA_GT_HABERES',
      'DATO_PATAGONIA_INVALIDO:INFORMACION:BNA_GT_HABERES',
    ]);
    expect(resumen(resultado.filas[1])).toEqual(['CBU_INVALIDO:INFORMACION:PATAGONIA_B2']);
    expect(resultado.filas.map((f) => f.nivel)).toEqual(['INFORMACION', 'INFORMACION']);
  });

  it('provincia: requerida con tipo 004; con otro tipo no debe estar (§B.1)', () => {
    const resultado = escenario(
      [filaPat(0), filaPat(1), filaBna(2)],
      [
        patDe(0, { PAT_TIPO_DOCUMENTO: '004', PAT_PROVINCIA_DOCUMENTO: null }),
        patDe(1, { PAT_TIPO_DOCUMENTO: '001', PAT_PROVINCIA_DOCUMENTO: '02' }),
        bnaDe(2, { PAT_TIPO_DOCUMENTO: '001', PAT_PROVINCIA_DOCUMENTO: '02' }),
      ],
    );
    expect(resumen(resultado.filas[0])).toEqual([
      'DATO_PATAGONIA_FALTANTE:BLOQUEANTE:PATAGONIA_B2',
    ]);
    expect(resultado.filas[1]?.incidencias[0]).toMatchObject({
      codigo: 'DATO_PATAGONIA_INVALIDO',
      nivel: 'BLOQUEANTE',
      motivo: 'NO_CORRESPONDE_AL_TIPO_DOCUMENTO',
    });
    expect(resumen(resultado.filas[2])).toEqual([
      'DATO_PATAGONIA_INVALIDO:INFORMACION:BNA_GT_HABERES',
    ]);
  });

  it('no compara el documento con el CUIL (regla 18 diferida, P-28)', () => {
    const fila = primera(
      escenario(
        [filaPat(0)],
        [patDe(0, { PAT_TIPO_DOCUMENTO: '001', PAT_NUMERO_DOCUMENTO: '12345' })],
      ),
    );
    expect(fila.nivel).toBe('CORRECTO');
  });
});

describe('regla 14 · liquidación sin mapeo (D-026)', () => {
  it('en producción no hay mapeos: BLOQUEANTE del banco con la descripción original y sin clasificar', () => {
    const resultado = escenario(
      [
        filaBna(0, { Descripcion: 'JULIO Agrario' }),
        filaBna(1, { Neto: '0' }),
        filaFinnegans(persona(2), { Banco: null }),
      ],
      [bnaDe(0)],
      { liquidaciones: null },
    );
    expect(resultado.filas[0]?.incidencias).toEqual([
      expect.objectContaining({
        codigo: 'LIQUIDACION_SIN_MAPEO',
        nivel: 'BLOQUEANTE',
        alcance: 'BNA_GT_HABERES',
        motivo: 'REGLA_PENDIENTE',
        valores: { finnegans: 'JULIO Agrario' },
      }),
    ]);
    // Excluidas y pendientes no se mapean.
    expect(resultado.incidencias.filter((i) => i.codigo === 'LIQUIDACION_SIN_MAPEO')).toHaveLength(
      1,
    );
  });
});

describe('reglas 17 y 19 · controles de la fila', () => {
  it('componentes que no cuadran: REQUIERE_REVISION; cuadran: nada', () => {
    const resultado = escenario(
      [filaBna(0, { Neto: '420000.24' }), filaBna(1)],
      [bnaDe(0), bnaDe(1)],
    );
    expect(resumen(resultado.filas[0])).toEqual([
      'NETO_NO_CUADRA_COMPONENTES:REQUIERE_REVISION:BNA_GT_HABERES',
    ]);
    expect(resultado.filas[1]?.nivel).toBe('CORRECTO');
  });

  it('componente ilegible: lo informa el parser y la regla 17 no se evalúa', () => {
    const fila = primera(escenario([filaBna(0, { Descuento: null })], [bnaDe(0)]));
    expect(resumen(fila)).toEqual(['IMPORTE_INVALIDO:BLOQUEANTE:BNA_GT_HABERES']);
  });

  it('Legajoapellidonombre que no empieza con el legajo: INFORMACION', () => {
    const fila = primera(
      escenario([filaBna(0, { Legajoapellidonombre: 'otro texto' })], [bnaDe(0)]),
    );
    expect(resumen(fila)).toEqual(['LEGAJO_NOMBRE_INCONSISTENTE:INFORMACION:BNA_GT_HABERES']);
  });
});

describe('registros del maestro no evaluados', () => {
  it('registro con CUIL inválido: no puede cruzarse; se informa y la fila queda sin maestro', () => {
    const resultado = escenario(
      [filaBna(0)],
      [bnaDe(0, { CUIL: persona(0).cuil.replace('-', '.') })],
    );
    expect(resumen(primera(resultado))).toEqual(['SIN_MAESTRO:BLOQUEANTE:BNA_GT_HABERES']);
    expect(resultado.incidencias.map((i) => `${i.codigo}:${i.nivel}:${i.alcance}`)).toEqual([
      'SIN_MAESTRO:BLOQUEANTE:BNA_GT_HABERES',
      'CUIL_INVALIDO:INFORMACION:GLOBAL',
    ]);
  });

  it('campos inválidos de un registro sin uso: INFORMACION global para corregir el maestro', () => {
    const resultado = escenario([filaBna(0)], [bnaDe(0), patDe(1, { PAT_TIPO_CUENTA: 'x' })]);
    expect(primera(resultado).nivel).toBe('CORRECTO');
    expect(resultado.incidencias.map((i) => `${i.codigo}:${i.nivel}:${i.alcance}`)).toEqual([
      'MAESTRO_SIN_LIQUIDACION:INFORMACION:GLOBAL',
      'DATO_PATAGONIA_INVALIDO:INFORMACION:GLOBAL',
    ]);
  });
});

describe('estructura e integridad del resultado', () => {
  it('errores de estructura de cualquier archivo: BLOQUEANTE global', () => {
    const resultado = escenario([filaBna(0)], [bnaDe(0)], { maestro: { control: null } });
    expect(resultado.incidencias[0]).toMatchObject({
      codigo: 'VERSION_MAESTRO_NO_SOPORTADA',
      alcance: 'GLOBAL',
    });
  });

  it('ninguna fila desaparece y los id de incidencia son únicos', () => {
    const filas = [
      filaBna(0),
      filaPat(1, { Neto: '0' }),
      filaFinnegans(persona(2), { Banco: null }),
      filaFinnegans(persona(3), { Banco: 'OTRO' }),
      filaBna(4, { Cuil: persona(1).cuil }),
      filaPat(5),
    ];
    const resultado = escenario(filas, [bnaDe(0), patDe(1), bnaDe(4, { LEGAJO: '1' })]);
    expect(resultado.filas.map((f) => f.linea.ref.fila)).toEqual([2, 3, 4, 5, 6, 7]);
    const ids = resultado.incidencias.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const fila of resultado.filas) {
      for (const incidencia of fila.incidencias) {
        expect(resultado.incidencias).toContain(incidencia);
      }
    }
  });
});
