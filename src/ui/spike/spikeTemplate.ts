// Plantilla de PRUEBA del spike F1 (T5/T11). No es el maestro definitivo: el contrato
// del maestro se implementa en F2 (docs/03 §B). Solo contiene valores ficticios.
import type { WorkbookDefinition } from '../../import/xlsx';

/** Filas de ejemplo: ceros a la izquierda, 22 dígitos, texto que parece fórmula y espacios. */
export const SPIKE_TEMPLATE_ROWS: readonly (readonly (string | null)[])[] = [
  ['EJEMPLO', '007', 'FILA FICTICIA DE PRUEBA', '0'.repeat(22), '2'],
  ['=1+1', '0042', ' espacios al inicio y al final ', null, '1'],
];

export const SPIKE_TEMPLATE: WorkbookDefinition = {
  sheets: [
    {
      name: 'Empleados',
      freezeHeader: true,
      preparedRows: 200,
      columns: [
        { header: 'CUIL', format: 'text', width: 16 },
        { header: 'LEGAJO', format: 'text', width: 10 },
        { header: 'APELLIDO_NOMBRE_REF', format: 'text', width: 34 },
        { header: 'CBU', format: 'text', width: 26 },
        { header: 'PAT_TIPO_CUENTA', format: 'text', width: 18, allowedValues: ['1', '2'] },
      ],
      rows: SPIKE_TEMPLATE_ROWS,
    },
    {
      name: 'Instrucciones',
      columns: [{ header: 'Instrucciones', format: 'general', width: 110 }],
      rows: [
        ['Plantilla de prueba del spike F1. No es el maestro definitivo (se define en F2).'],
        ['No cargar datos reales en este archivo.'],
        [
          'Verificación T11: escribir 007 en LEGAJO y un CBU de 22 dígitos en CBU; deben quedar como texto, sin perder ceros ni dígitos.',
        ],
        ['PAT_TIPO_CUENTA solo admite 1 o 2 (lista desplegable).'],
      ],
    },
    {
      name: 'Catalogos',
      columns: [
        { header: 'TIPO_CUENTA', format: 'text', width: 14 },
        { header: 'DESCRIPCION', format: 'general', width: 30 },
        { header: 'FUENTE', format: 'general', width: 40 },
      ],
      rows: [
        ['1', 'Cuenta corriente', 'Patagonia B.2, PAT-DR p.9'],
        ['2', 'Caja de ahorro', 'Patagonia B.2, PAT-DR p.9'],
      ],
    },
    {
      name: 'Control',
      state: 'hidden',
      columns: [
        { header: 'CLAVE', format: 'text', width: 22 },
        { header: 'VALOR', format: 'text', width: 30 },
      ],
      rows: [
        ['VERSION_PLANTILLA', 'SPIKE-F1'],
        ['GENERADA_POR', 'Conversor de Haberes'],
      ],
    },
  ],
};
