// Spec técnica Patagonia B.2 (F6, CP-F6-A). No serializa, no mapea y no genera archivos:
// demuestra que el motor F4 puede representar R0/R1/R2 con hipótesis EXPLÍCITAS.
//
// PAT-1 y PAT-2 NO se resuelven acá. El llamador debe elegir una hipótesis técnica; no hay
// defaults. Cualquier elección mantiene el issue BLOQUEADO y no afirma que sea la decisión
// bancaria correcta. PAT-14 (encoding/newline/trailing) también es explícito y queda
// INTERPRETACION_PENDIENTE; no se infiere LF, CRLF ni salto final.

import type { ContractStatus, FieldType, FileSpec } from '../fixed-width';
import type { FieldOrigin, FieldSpecBancaria, RecordSpecBancaria } from '../trazabilidad';
import {
  ID_CAMPO_PAT_CODIGO_BANCO,
  ID_CAMPO_PAT_DEPENDENCIA,
  ID_CAMPO_PAT_RELLENO_PAT1,
  ID_CAMPO_PAT_VERSION_LOTE,
  ID_REGISTRO_PAT_0,
  ID_REGISTRO_PAT_1,
  ID_REGISTRO_PAT_2,
  PAT1_LONGITUD_DECLARADA_DOCUMENTAL,
  PAT1_LONGITUD_GEOMETRICA,
  PAT1_POSICION_FIN,
  PAT1_POSICION_INICIO,
  PAT_TIPO_MOVIMIENTO_PLAN_SUELDOS,
  type PatagoniaIssueId,
} from './contrato';

/** Hipótesis técnica explícita para el relleno del registro 2 campo 16 (PAT-1). */
export type HipotesisRellenoPat1 = 'ESPACIOS' | 'CEROS';

/** Hipótesis técnica explícita para el código de dependencia (PAT-2). */
export type HipotesisDependenciaPat2 = 'NUMERICA' | 'ALFANUMERICA';

export interface HipotesisTecnicasPatagonia {
  readonly hipotesisRellenoPat1: HipotesisRellenoPat1;
  readonly hipotesisDependenciaPat2: HipotesisDependenciaPat2;
}

/** FileSpec técnica que conserva los campos bancarios tipados (sin perder trazabilidad). */
export interface SpecPatagonia extends FileSpec {
  readonly records: readonly RecordSpecBancaria<PatagoniaIssueId>[];
}

function exigirHipotesisPat1(valor: unknown): asserts valor is HipotesisRellenoPat1 {
  if (valor !== 'ESPACIOS' && valor !== 'CEROS') {
    throw new TypeError('PAT-1 exige una hipótesis explícita: ESPACIOS o CEROS.');
  }
}

function exigirHipotesisPat2(valor: unknown): asserts valor is HipotesisDependenciaPat2 {
  if (valor !== 'NUMERICA' && valor !== 'ALFANUMERICA') {
    throw new TypeError('PAT-2 exige una hipótesis explícita: NUMERICA o ALFANUMERICA.');
  }
}

function exigirSeparadorLinea(valor: unknown): asserts valor is '\n' | '\r\n' {
  if (valor !== '\n' && valor !== '\r\n') {
    throw new TypeError('PAT-14 exige un lineSeparator explícito: LF o CRLF.');
  }
}

function exigirSeparadorFinal(valor: unknown): asserts valor is boolean {
  if (typeof valor !== 'boolean') {
    throw new TypeError('PAT-14 exige un trailingSeparator explícito: true o false.');
  }
}

/**
 * Configuración técnica explícita. `crearSpecPatagoniaB2` NO tiene defaults: el llamador
 * debe elegir PAT-1, PAT-2 y PAT-14 conscientemente. Las elecciones no convierten las
 * interpretaciones en confirmadas.
 */
export interface ConfiguracionTecnicaPatagonia extends HipotesisTecnicasPatagonia {
  readonly lineSeparator: '\n' | '\r\n';
  readonly trailingSeparator: boolean;
}

interface OpcionesCampo {
  readonly fixedValue?: string;
  readonly issues?: readonly PatagoniaIssueId[];
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
): FieldSpecBancaria<PatagoniaIssueId> {
  return {
    id,
    name,
    start,
    end,
    declaredLength: end - start + 1,
    type,
    padding: type === 'N' ? { kind: 'ZERO_LEFT' } : { kind: 'SPACE_RIGHT' },
    status,
    origin,
    source: {
      doc: 'PAT_DR',
      paginas,
      ...(opciones.nota === undefined ? {} : { nota: opciones.nota }),
    },
    ...(opciones.fixedValue === undefined ? {} : { fixedValue: opciones.fixedValue }),
    ...(opciones.issues === undefined ? {} : { issues: opciones.issues }),
  };
}

function crearRegistro0(): RecordSpecBancaria<PatagoniaIssueId> {
  return {
    id: ID_REGISTRO_PAT_0,
    recordLength: 200,
    fields: [
      campo('r0_tipoRegistro', 'Tipo de registro', 1, 1, 'N', 'CONFIRMADA', 'FIJO', [8], {
        fixedValue: '0',
      }),
      campo('r0_codigoBanco', 'Código de banco', 2, 4, 'N', 'CONFIRMADA', 'FIJO', [8], {
        fixedValue: '034',
      }),
      campo('r0_espacios1', 'Espacios', 5, 9, 'A', 'CONFIRMADA', 'FIJO', [8], {
        fixedValue: '     ',
      }),
      campo('r0_numeroEmpresa', 'Número de EMPRESA', 10, 13, 'N', 'CONFIRMADA', 'PERFIL', [8], {
        issues: ['PAT-6'],
        nota: 'PAT-6: no afirmar que coincide con el número de convenio de PAT-XL.',
      }),
      campo(
        'r0_fechaPresentacion',
        'Fecha de presentación',
        14,
        21,
        'N',
        'CONFIRMADA',
        'ENVIO',
        [8],
      ),
      campo('r0_numeroEnvio', 'Número de envío', 22, 23, 'N', 'CONFIRMADA', 'ENVIO', [8], {
        issues: ['PAT-5'],
        nota: 'PAT-5: PAT-XL p.4 exige distinto de 99 y PAT-DR p.8 limita a 1–70.',
      }),
      campo('r0_cantidadLotes', 'Cantidad de lotes', 24, 27, 'N', 'CONFIRMADA', 'DERIVADO', [8]),
      campo('r0_espacios2', 'Espacios', 28, 29, 'A', 'CONFIRMADA', 'FIJO', [8], {
        fixedValue: '  ',
      }),
      campo(
        'r0_importeLotes',
        'Importe total de lotes',
        30,
        44,
        'N',
        'CONFIRMADA',
        'DERIVADO',
        [8],
      ),
      campo('r0_espacios3', 'Espacios', 45, 54, 'A', 'CONFIRMADA', 'FIJO', [8], {
        fixedValue: '          ',
      }),
      campo('r0_tipoAcreditacion', 'Tipo de acreditación', 55, 55, 'N', 'CONFIRMADA', 'FIJO', [8], {
        fixedValue: '0',
        nota: '0 = Plan Sueldos. El tipo 2 (bloqueos) queda fuera de alcance F6.',
      }),
      campo('r0_espacios4', 'Espacios', 56, 188, 'A', 'CONFIRMADA', 'FIJO', [8], {
        fixedValue: ' '.repeat(133),
      }),
      campo('r0_version', 'Versión', 189, 196, 'A', 'CONFIRMADA', 'FIJO', [8], {
        fixedValue: '        ',
      }),
      campo(
        'r0_numeroEmpresaFinal',
        'Número de EMPRESA (repetición)',
        197,
        200,
        'N',
        'CONFIRMADA',
        'PERFIL',
        [8],
        {
          issues: ['PAT-6'],
          nota: 'PAT-6: debe coincidir con el campo 4; misma interpretación pendiente.',
        },
      ),
    ],
  };
}

function crearRegistro1(): RecordSpecBancaria<PatagoniaIssueId> {
  return {
    id: ID_REGISTRO_PAT_1,
    recordLength: 200,
    fields: [
      campo('r1_tipoRegistro', 'Tipo de registro', 1, 1, 'N', 'CONFIRMADA', 'FIJO', [8], {
        fixedValue: '1',
      }),
      campo('r1_numeroLote', 'Número de lote', 2, 5, 'N', 'CONFIRMADA', 'DERIVADO', [8, 9], {
        issues: ['PAT-13'],
        nota: 'PAT-13/P-20: máximo 999 detalles por lote; regla de división no definida.',
      }),
      campo('r1_tipoMovimiento', 'Tipo de movimiento', 6, 6, 'N', 'CONFIRMADA', 'FIJO', [8, 9], {
        fixedValue: PAT_TIPO_MOVIMIENTO_PLAN_SUELDOS,
        nota: '2 = acreditación Plan Sueldos. El tipo 4 (bloqueos) queda fuera de alcance F6.',
      }),
      campo('r1_concepto', 'Concepto', 7, 16, 'A', 'CONFIRMADA', 'ENVIO', [8], {
        issues: ['PAT-12'],
        nota: 'PAT-12: caracteres admitidos no definidos; PAT-XL p.5 no se mapea a este campo.',
      }),
      campo(
        'r1_cantidadLote',
        'Cantidad de detalles del lote',
        17,
        19,
        'N',
        'CONFIRMADA',
        'DERIVADO',
        [8],
        {
          issues: ['PAT-13'],
          nota: 'PAT-13/P-20: máximo 999; la división en lotes no está definida.',
        },
      ),
      campo('r1_importeLote', 'Importe total del lote', 20, 34, 'N', 'CONFIRMADA', 'DERIVADO', [8]),
      campo(
        'r1_fechaAcreditacion',
        'Fecha de acreditación',
        35,
        42,
        'N',
        'CONFIRMADA',
        'ENVIO',
        [8],
      ),
      campo('r1_numeroEnvio', 'Número de envío', 43, 44, 'N', 'CONFIRMADA', 'ENVIO', [8], {
        issues: ['PAT-5'],
        nota: 'PAT-5: mismo valor que R0 campo 6; rango y restricción pendientes.',
      }),
      campo('r1_espacios', 'Espacios', 45, 188, 'A', 'CONFIRMADA', 'FIJO', [8], {
        fixedValue: ' '.repeat(144),
      }),
      campo(
        ID_CAMPO_PAT_VERSION_LOTE,
        'Versión',
        189,
        196,
        'A',
        'INTERPRETACION_PENDIENTE',
        'FIJO',
        [8, 9],
        {
          issues: ['PAT-15'],
          nota: 'PAT-15: sin observación de contenido; no se inventa un valor fijo.',
        },
      ),
      campo('r1_numeroEmpresa', 'Número de EMPRESA', 197, 200, 'N', 'CONFIRMADA', 'PERFIL', [9], {
        issues: ['PAT-6'],
        nota: 'PAT-6: misma interpretación pendiente que R0 campos 4 y 14.',
      }),
    ],
  };
}

function campoDependencia(
  hipotesis: HipotesisDependenciaPat2,
): FieldSpecBancaria<PatagoniaIssueId> {
  const esNumerica = hipotesis === 'NUMERICA';
  return campo(
    ID_CAMPO_PAT_DEPENDENCIA,
    'Código de dependencia',
    85,
    99,
    esNumerica ? 'N' : 'A',
    'BLOQUEADA',
    'MAESTRO',
    [3, 4, 5, 6, 9],
    {
      issues: ['PAT-2'],
      nota: esNumerica
        ? 'PAT-2: hipótesis técnica NUMERICA (N/ZERO_LEFT). B.2 p.9 y Anexo A.3 usan N; A.2/A.4/A.6 usan A. No es decisión bancaria.'
        : 'PAT-2: hipótesis técnica ALFANUMERICA (A/SPACE_RIGHT). B.2 p.9 y Anexo A.3 usan N; A.2/A.4/A.6 usan A. No es decisión bancaria.',
    },
  );
}

function campoRellenoPat1(hipotesis: HipotesisRellenoPat1): FieldSpecBancaria<PatagoniaIssueId> {
  const esEspacios = hipotesis === 'ESPACIOS';
  return campo(
    ID_CAMPO_PAT_RELLENO_PAT1,
    'Espacios (PAT-1)',
    PAT1_POSICION_INICIO,
    PAT1_POSICION_FIN,
    esEspacios ? 'A' : 'N',
    'BLOQUEADA',
    'FIJO',
    [9],
    {
      fixedValue: esEspacios
        ? ' '.repeat(PAT1_LONGITUD_GEOMETRICA)
        : '0'.repeat(PAT1_LONGITUD_GEOMETRICA),
      issues: ['PAT-1'],
      nota: `PAT-1: geometría real de ${String(PAT1_LONGITUD_GEOMETRICA)} posiciones (${String(PAT1_POSICION_INICIO)}–${String(PAT1_POSICION_FIN)}); PAT-DR p.9 declara ${String(PAT1_LONGITUD_DECLARADA_DOCUMENTAL)}. Hipótesis técnica ${hipotesis}; no es decisión bancaria.`,
    },
  );
}

function crearRegistro2(
  hipotesis: HipotesisTecnicasPatagonia,
): RecordSpecBancaria<PatagoniaIssueId> {
  return {
    id: ID_REGISTRO_PAT_2,
    recordLength: 200,
    fields: [
      campo('r2_tipoRegistro', 'Tipo de registro', 1, 1, 'N', 'CONFIRMADA', 'FIJO', [9], {
        fixedValue: '2',
      }),
      campo('r2_numeroLote', 'Número de lote', 2, 5, 'N', 'CONFIRMADA', 'DERIVADO', [9]),
      campo('r2_tipoCuenta', 'Tipo de cuenta', 6, 6, 'N', 'CONFIRMADA', 'MAESTRO', [9]),
      campo('r2_numeroCuenta', 'Número de cuenta', 7, 16, 'N', 'CONFIRMADA', 'MAESTRO', [9]),
      campo('r2_importeNeto', 'Importe neto', 17, 27, 'N', 'CONFIRMADA', 'FINNEGANS', [9], {
        nota: 'PAT-XL p.5: 9 enteros y 2 decimales; debe ser mayor que cero.',
      }),
      campo(
        'r2_numeroComprobante',
        'Número de comprobante',
        28,
        34,
        'N',
        'CONFIRMADA',
        'FINNEGANS',
        [9],
        {
          issues: ['PAT-16'],
          nota: 'PAT-16: si no se informa, no se decide entre ceros u otro valor.',
        },
      ),
      campo(
        'r2_apellidoNombre',
        'Apellido y nombre',
        35,
        54,
        'A',
        'INTERPRETACION_PENDIENTE',
        'FINNEGANS',
        [9],
        {
          issues: ['PAT-9'],
          nota: 'PAT-9/P-14: obligatoriedad, composición y truncado no definidos; PAT-XL p.5 admite caracteres especiales.',
        },
      ),
      campo(
        ID_CAMPO_PAT_CODIGO_BANCO,
        'Código de banco donde está radicada la cuenta',
        55,
        57,
        'N',
        'CONFIRMADA',
        'MAESTRO',
        [9],
        {
          issues: ['PAT-17'],
          nota: 'PAT-17: PAT-DR p.9 no fija 034. El 034 fijo documentado está en R0 campo 2. La regla actual de entidad 034 queda congelada.',
        },
      ),
      campo('r2_codigoSucursal', 'Código de sucursal', 58, 62, 'N', 'CONFIRMADA', 'MAESTRO', [9]),
      campo('r2_tipoDocumento', 'Tipo de documento', 63, 65, 'N', 'CONFIRMADA', 'MAESTRO', [9], {
        issues: ['PAT-8'],
        nota: 'PAT-8: Anexo I p.9 lista 006/007/008/009/010/011/012/013; PAT-XL p.5 omite 004.',
      }),
      campo(
        'r2_numeroDocumento',
        'Número de documento',
        66,
        82,
        'N',
        'CONFIRMADA',
        'MAESTRO',
        [9],
        {
          nota: 'P-28: no se deriva el CUIL del documento; la decisión sigue abierta.',
        },
      ),
      campo(
        'r2_provinciaDocumento',
        'Provincia del documento',
        83,
        84,
        'N',
        'CONFIRMADA',
        'MAESTRO',
        [9],
        {
          issues: ['PAT-4'],
          nota: 'PAT-4: solo aplica a tipo 004; para otros tipos se discute 00 vs. espacios (Anexo II p.10).',
        },
      ),
      campoDependencia(hipotesis.hipotesisDependenciaPat2),
      campo('r2_espacios', 'Espacios', 100, 100, 'A', 'CONFIRMADA', 'FIJO', [9], {
        fixedValue: ' ',
      }),
      campo(
        'r2_tipoLiquidacion',
        'Tipo de liquidación',
        101,
        103,
        'N',
        'CONFIRMADA',
        'DERIVADO',
        [9, 10],
        {
          issues: ['PAT-7'],
          nota: 'PAT-7/P-09/P-10: Anexo III p.10 y D-026; no se mapea “Código de concepto” de PAT-XL.',
        },
      ),
      campoRellenoPat1(hipotesis.hipotesisRellenoPat1),
      campo('r2_numeroEmpresa', 'Número de EMPRESA', 197, 200, 'N', 'CONFIRMADA', 'PERFIL', [9], {
        issues: ['PAT-6'],
        nota: 'PAT-6: misma interpretación pendiente que R0 y R1.',
      }),
    ],
  };
}

/** Construye R0/R1/R2 con las hipótesis explícitas. Sin defaults. */
export function crearRegistrosPatagonia(
  hipotesis: HipotesisTecnicasPatagonia,
): readonly [
  RecordSpecBancaria<PatagoniaIssueId>,
  RecordSpecBancaria<PatagoniaIssueId>,
  RecordSpecBancaria<PatagoniaIssueId>,
] {
  exigirHipotesisPat1(hipotesis.hipotesisRellenoPat1);
  exigirHipotesisPat2(hipotesis.hipotesisDependenciaPat2);
  return [crearRegistro0(), crearRegistro1(), crearRegistro2(hipotesis)];
}

/** Construye la FileSpec técnica. La estructura es `0 (1 2+)+`. Sin defaults. */
export function crearSpecPatagoniaB2(configuracion: ConfiguracionTecnicaPatagonia): SpecPatagonia {
  exigirHipotesisPat1(configuracion.hipotesisRellenoPat1);
  exigirHipotesisPat2(configuracion.hipotesisDependenciaPat2);
  exigirSeparadorLinea(configuracion.lineSeparator);
  exigirSeparadorFinal(configuracion.trailingSeparator);
  return {
    id: 'PATAGONIA_B2',
    records: crearRegistrosPatagonia(configuracion),
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
        { kind: 'registro', recordId: ID_REGISTRO_PAT_0 },
        {
          kind: 'repeticion',
          min: 1,
          parte: {
            kind: 'secuencia',
            partes: [
              { kind: 'registro', recordId: ID_REGISTRO_PAT_1 },
              {
                kind: 'repeticion',
                min: 1,
                parte: { kind: 'registro', recordId: ID_REGISTRO_PAT_2 },
              },
            ],
          },
        },
      ],
    },
  };
}
