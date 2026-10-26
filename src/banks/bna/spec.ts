// Spec contractual BNA GT Haberes (F5; docs/04). No serializa archivos ni calcula
// importes: solo representa la geometría de 3 registros de 200 bytes y la metadata
// documental. Los separadores son una HIPÓTESIS TÉCNICA obligatoria del llamador
// (BNA-9): no existe un valor por defecto ni una spec global preconstruida.

import type { ContractStatus, FieldType, FileSpec, Padding } from '../fixed-width';
import type { FieldOrigin, FieldSpecBancaria, RecordSpecBancaria } from '../trazabilidad';
import {
  ID_REGISTRO_BNA_1,
  ID_REGISTRO_BNA_2,
  ID_REGISTRO_BNA_3,
  type BnaIssueId,
} from './contrato';

interface OpcionesCampo {
  readonly fixedValue?: string;
  readonly issues?: readonly BnaIssueId[];
  readonly nota?: string;
}

function campo(
  id: string,
  name: string,
  start: number,
  end: number,
  type: FieldType,
  status: ContractStatus,
  origin: FieldOrigin,
  paginas: readonly number[],
  opciones: OpcionesCampo = {},
): FieldSpecBancaria<BnaIssueId> {
  const padding: Padding = type === 'N' ? { kind: 'ZERO_LEFT' } : { kind: 'SPACE_RIGHT' };
  return {
    id,
    name,
    start,
    end,
    declaredLength: end - start + 1,
    type,
    padding,
    ...(opciones.fixedValue !== undefined ? { fixedValue: opciones.fixedValue } : {}),
    status,
    origin,
    source: {
      doc: 'BNA',
      paginas,
      ...(opciones.nota !== undefined ? { nota: opciones.nota } : {}),
    },
    ...(opciones.issues !== undefined ? { issues: opciones.issues } : {}),
  };
}

export const REGISTRO_BNA_1: RecordSpecBancaria<BnaIssueId> = {
  id: ID_REGISTRO_BNA_1,
  recordLength: 200,
  fields: [
    campo('r1_tipoRegistro', 'Tipo de registro', 1, 1, 'N', 'CONFIRMADA', 'FIJO', [5], {
      fixedValue: '1',
    }),
    campo(
      'r1_identificacionEmpresa',
      'Identificación empresa',
      2,
      12,
      'N',
      'CONFIRMADA',
      'PERFIL',
      [5],
    ),
    campo(
      'r1_sucursalEmpresa',
      'Sucursal de la cuenta de la empresa',
      13,
      16,
      'N',
      'CONFIRMADA',
      'DERIVADO',
      [5, 7],
      {
        issues: ['BNA-6'],
        nota: 'Hipótesis del ejemplo: 0 + código BCRA; derivación desde CBU no confirmada.',
      },
    ),
    campo(
      'r1_bloque2CbuEmpresa',
      'Bloque 2 CBU de la empresa',
      17,
      30,
      'N',
      'CONFIRMADA',
      'DERIVADO',
      [5, 7],
    ),
    campo('r1_moneda', 'Moneda transacción', 31, 31, 'A', 'CONFIRMADA', 'PERFIL', [5], {
      nota: '0 pesos; 1 dólares.',
    }),
    campo(
      'r1_fechaCompensacion',
      'Fecha compensación',
      32,
      39,
      'N',
      'INTERPRETACION_PENDIENTE',
      'ENVIO',
      [5, 7, 14],
      {
        issues: ['BNA-7'],
        nota: 'Formato AAAAMMDD solo por ejemplo; calendario de feriados no documentado.',
      },
    ),
    campo(
      'r1_infoCriterioEmpresa',
      'Información criterio empresa',
      40,
      59,
      'A',
      'CONFIRMADA',
      'ENVIO',
      [6, 7],
      {
        issues: ['BNA-11'],
        nota: 'Contenido libre; obligatoriedad/vacío pendiente (BNA-11).',
      },
    ),
    campo('r1_tipoPagos', 'Tipo de pagos', 60, 62, 'A', 'CONFIRMADA', 'FIJO', [6], {
      fixedValue: 'SUE',
    }),
    campo('r1_clasePagos', 'Clase de pagos', 63, 63, 'A', 'CONFIRMADA', 'FIJO', [6], {
      fixedValue: '1',
    }),
    campo(
      'r1_codigoConvenio',
      'Código de convenio',
      64,
      73,
      'N',
      'INTERPRETACION_PENDIENTE',
      'PERFIL',
      [6, 7, 15],
      {
        issues: ['BNA-5'],
        nota: '4 dígitos documentados; 8 números documentados; 5, 6 y 7 no definidos.',
      },
    ),
    campo('r1_numeroEnvio', 'Número de envío', 74, 79, 'N', 'CONFIRMADA', 'ENVIO', [6]),
    campo('r1_sistemaOriginal', 'Sistema original', 80, 81, 'A', 'CONFIRMADA', 'FIJO', [6], {
      fixedValue: '  ',
    }),
    campo('r1_filler1', 'Filler', 82, 96, 'A', 'CONFIRMADA', 'FIJO', [6], {
      fixedValue: ' '.repeat(15),
    }),
    campo(
      'r1_casaEnvioRendicion',
      'Casa envío rendición',
      97,
      100,
      'A',
      'CONFIRMADA',
      'FIJO',
      [6],
      { fixedValue: ' '.repeat(4) },
    ),
    campo('r1_filler2', 'Filler', 101, 200, 'A', 'CONFIRMADA', 'FIJO', [6], {
      fixedValue: ' '.repeat(100),
    }),
  ],
};

export const REGISTRO_BNA_2: RecordSpecBancaria<BnaIssueId> = {
  id: ID_REGISTRO_BNA_2,
  recordLength: 200,
  fields: [
    campo('r2_tipoRegistro', 'Tipo de registro', 1, 1, 'N', 'CONFIRMADA', 'FIJO', [8], {
      fixedValue: '2',
    }),
    campo('r2_entidad', 'Entidad a acreditar', 2, 5, 'N', 'CONFIRMADA', 'DERIVADO', [8, 11], {
      issues: ['BNA-6'],
      nota: 'Hipótesis del ejemplo: 0 + código BCRA; derivación desde CBU no confirmada.',
    }),
    campo(
      'r2_sucursal',
      'Sucursal a acreditar',
      6,
      9,
      'N',
      'INTERPRETACION_PENDIENTE',
      'DERIVADO',
      [8, 11],
      {
        issues: ['BNA-6'],
        nota: 'Hipótesis del ejemplo: dígitos 4–7 del CBU; semántica no confirmada.',
      },
    ),
    campo(
      'r2_dvBloque1',
      'Dígito verificador bloque 1 CBU',
      10,
      10,
      'N',
      'CONFIRMADA',
      'DERIVADO',
      [8],
    ),
    campo(
      'r2_bloque2Cuenta',
      'Bloque 2 CBU cuenta a acreditar',
      11,
      24,
      'N',
      'INTERPRETACION_PENDIENTE',
      'DERIVADO',
      [8, 11],
      {
        issues: ['BNA-2'],
        nota: 'El texto dice CBU de la empresa; el ejemplo usa el CBU del beneficiario.',
      },
    ),
    campo('r2_importe', 'Importe', 25, 34, 'N', 'CONFIRMADA', 'FINNEGANS', [8, 11], {
      nota: 'Centavos: 8 enteros + 2 decimales.',
    }),
    campo('r2_referencia', 'Referencia unívoca', 35, 49, 'A', 'CONFIRMADA', 'ENVIO', [9]),
    campo(
      'r2_identificacionBeneficiario',
      'Identificación cliente beneficiario',
      50,
      71,
      'A',
      'CONFIRMADA',
      'PERFIL',
      [9],
      {
        issues: ['BNA-11'],
        nota: 'Contenido libre; obligatoriedad/vacío pendiente (BNA-11).',
      },
    ),
    campo('r2_claseDocumento', 'Clase de documento', 72, 72, 'N', 'CONFIRMADA', 'PERFIL', [9], {
      nota: '1 clave fiscal; 2 otros documentos.',
    }),
    campo(
      'r2_tipoDocumento',
      'Tipo documento beneficiario',
      73,
      74,
      'N',
      'BLOQUEADA',
      'PERFIL',
      [9, 11, 15],
      {
        issues: ['BNA-1'],
        nota: 'BNA-1: sin elección de tipo documental; sin fixedValue ni default.',
      },
    ),
    campo(
      'r2_numeroDocumento',
      'Número de documento beneficiario',
      75,
      85,
      'N',
      'CONFIRMADA',
      'FINNEGANS',
      [9, 11],
    ),
    campo('r2_estado', 'Estado', 86, 87, 'N', 'CONFIRMADA', 'FIJO', [9, 11], {
      fixedValue: '00',
    }),
    campo('r2_datosEmpresa', 'Datos de la empresa', 88, 100, 'A', 'CONFIRMADA', 'PERFIL', [9, 11], {
      nota: 'Uso interno; espacios si no se usa. No forma parte de BNA-11.',
    }),
    campo(
      'r2_identificadorPrestamo',
      'Identificador préstamo',
      101,
      104,
      'N',
      'CONFIRMADA',
      'PERFIL',
      [10],
      {
        nota: 'Códigos 0000/0003 documentados; mapeo P-09/P-10 pendiente, fuera de ContractStatus.',
      },
    ),
    campo(
      'r2_numeroOperacionLink',
      'Nro. operación link',
      105,
      113,
      'A',
      'CONFIRMADA',
      'FIJO',
      [10],
      { fixedValue: ' '.repeat(9) },
    ),
    campo(
      'r2_sucursalAcreditacionOriginal',
      'Sucursal acreditar original',
      114,
      117,
      'A',
      'CONFIRMADA',
      'FIJO',
      [10],
      { fixedValue: ' '.repeat(4) },
    ),
    campo(
      'r2_numeroRegistroLink',
      'Número de registro link',
      118,
      123,
      'A',
      'CONFIRMADA',
      'FIJO',
      [10],
      { fixedValue: ' '.repeat(6) },
    ),
    campo('r2_observaciones', 'Observaciones', 124, 138, 'A', 'CONFIRMADA', 'FIJO', [10], {
      fixedValue: ' '.repeat(15),
    }),
    campo('r2_filler', 'Filler', 139, 200, 'A', 'CONFIRMADA', 'FIJO', [10], {
      fixedValue: ' '.repeat(62),
    }),
  ],
};

export const REGISTRO_BNA_3: RecordSpecBancaria<BnaIssueId> = {
  id: ID_REGISTRO_BNA_3,
  recordLength: 200,
  fields: [
    campo('r3_tipoRegistro', 'Tipo de registro', 1, 1, 'N', 'CONFIRMADA', 'FIJO', [12], {
      fixedValue: '3',
    }),
    campo('r3_totalImporte', 'Total importe archivo', 2, 16, 'N', 'CONFIRMADA', 'DERIVADO', [12]),
    campo(
      'r3_totalCantidad',
      'Total cantidad de registros tipo 2',
      17,
      23,
      'N',
      'CONFIRMADA',
      'DERIVADO',
      [12],
    ),
    campo('r3_importeAceptados', 'Importe aceptados', 24, 38, 'N', 'CONFIRMADA', 'FIJO', [12], {
      fixedValue: '0'.repeat(15),
    }),
    campo('r3_cantidadAceptados', 'Cantidad aceptados', 39, 45, 'A', 'CONFIRMADA', 'FIJO', [12], {
      fixedValue: '0'.repeat(7),
    }),
    campo('r3_importeRechazados', 'Importe rechazados', 46, 60, 'N', 'CONFIRMADA', 'FIJO', [12], {
      fixedValue: '0'.repeat(15),
    }),
    campo('r3_cantidadRechazados', 'Cantidad rechazados', 61, 67, 'A', 'CONFIRMADA', 'FIJO', [12], {
      fixedValue: '0'.repeat(7),
    }),
    campo('r3_importeComisiones', 'Importe comisiones', 68, 77, 'N', 'CONFIRMADA', 'FIJO', [13], {
      fixedValue: '0'.repeat(10),
    }),
    campo('r3_importeIva', 'Importe IVA', 78, 87, 'N', 'CONFIRMADA', 'FIJO', [13], {
      fixedValue: '0'.repeat(10),
    }),
    campo(
      'r3_importeRetencionIva',
      'Importe retención IVA',
      88,
      97,
      'N',
      'CONFIRMADA',
      'FIJO',
      [13],
      { fixedValue: '0'.repeat(10) },
    ),
    campo(
      'r3_importePercepcionIibb',
      'Importe percepción IIBB',
      98,
      107,
      'N',
      'CONFIRMADA',
      'FIJO',
      [13],
      { fixedValue: '0'.repeat(10) },
    ),
    campo(
      'r3_importeSelladoProvincial',
      'Importe sellado provincial',
      108,
      117,
      'N',
      'CONFIRMADA',
      'FIJO',
      [13],
      { fixedValue: '0'.repeat(10) },
    ),
    campo('r3_filler', 'Filler', 118, 200, 'A', 'CONFIRMADA', 'FIJO', [13], {
      fixedValue: ' '.repeat(83),
    }),
  ],
};

export const REGISTROS_BNA = [REGISTRO_BNA_1, REGISTRO_BNA_2, REGISTRO_BNA_3] as const;

/**
 * Configuración técnica explícita. `crearSpecBna` NO tiene defaults: el llamador debe
 * elegir conscientemente una hipótesis para BNA-9. La elección no convierte la
 * interpretación en confirmada: ambos separadores quedan `INTERPRETACION_PENDIENTE`.
 */
export interface ConfiguracionTecnicaBna {
  readonly lineSeparator: '\n' | '\r\n';
  readonly trailingSeparator: boolean;
}

export function crearSpecBna(configuracion: ConfiguracionTecnicaBna): FileSpec {
  return {
    id: 'BNA_GT_HABERES',
    records: REGISTROS_BNA,
    charset: 'ASCII_PRINTABLE',
    lineSeparator: {
      value: configuracion.lineSeparator,
      status: 'INTERPRETACION_PENDIENTE',
    },
    trailingSeparator: {
      value: configuracion.trailingSeparator,
      status: 'INTERPRETACION_PENDIENTE',
    },
    structure: {
      kind: 'secuencia',
      partes: [
        { kind: 'registro', recordId: ID_REGISTRO_BNA_1 },
        {
          kind: 'repeticion',
          parte: { kind: 'registro', recordId: ID_REGISTRO_BNA_2 },
          min: 1,
        },
        { kind: 'registro', recordId: ID_REGISTRO_BNA_3 },
      ],
    },
  };
}
