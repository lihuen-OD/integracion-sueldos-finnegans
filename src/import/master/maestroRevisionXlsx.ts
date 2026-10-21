// Exportación del maestro EDITADO (T3-12, D-062/D-066): escribe la REVISIÓN vigente
// (update-only, con edges de edición) en el mismo contrato v1 que la importación parsea
// (docs/03 §B). Update-only garantizado: cada registro se serializa campo por campo tal
// como quedó, sin ADs ni deletes; los datos del operador (identidad, PAT_CODIGO_DEPENDENCIA)
// salen tal cual están en la revisión. Round-trip garantizado con parseMaestro (ver
// tests/unit/import/maestroRevisionXlsx.test.ts). ExcelJS queda confinado al adaptador (D-038).
import type { MasterRecord } from '../../domain/maestro';
import type { RevisionMaestro } from '../../run/revision';
import { writeWorkbook, type WorkbookDefinition } from '../xlsx';
import {
  CLAVE_VERSION_CONTRATO,
  COLUMNAS_MAESTRO,
  HOJA_CONTROL,
  HOJA_EMPLEADOS,
  HOJA_INSTRUCCIONES,
  NOMBRE_ARCHIVO_MAESTRO,
  type ColumnaMaestro,
} from './contrato';
import { VERSION_CONTRATO_MAESTRO } from '../../domain/maestro';

const INSTRUCCIONES_EXPORTADO: readonly string[] = [
  'Versión editada del maestro, generada por la app en memoria a partir de tu archivo original.',
  'El archivo original no se modificó: esta versión reemplaza a la anterior en la próxima corrida.',
  'Contiene datos personales y bancarios: acceso restringido a RRHH, sin subir a la nube.',
];

function textoDelCampo(
  campo:
    | { readonly estado: 'VACIO' }
    | { readonly estado: 'VALIDO' | 'INVALIDO'; readonly texto: string },
): string {
  return campo.estado === 'VACIO' ? '' : campo.texto;
}

function filaDeRegistro(registro: MasterRecord): string[] {
  return [
    registro.cuilTexto,
    registro.legajo ?? '',
    registro.apellidoNombreRef === '' ? '' : registro.apellidoNombreRef,
    textoDelCampo(registro.cbu),
    textoDelCampo(registro.patagonia.tipoCuenta),
    textoDelCampo(registro.patagonia.numeroCuenta),
    textoDelCampo(registro.patagonia.codigoBanco),
    textoDelCampo(registro.patagonia.codigoSucursal),
    textoDelCampo(registro.patagonia.tipoDocumento),
    textoDelCampo(registro.patagonia.numeroDocumento),
    textoDelCampo(registro.patagonia.provinciaDocumento),
    textoDelCampo(registro.patagonia.codigoDependencia),
  ];
}

/** Nombre del archivo de la versión editada: fecha + número de revisión (docs/03 §B.4). */
export function nombreMaestroEditado(fechaGeneracion: string, numeroRevision: number): string {
  const fecha = fechaGeneracion;
  const revision = String(numeroRevision);
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(fecha)) {
    throw new RangeError('La fecha debe tener el formato AAAA-MM-DD.');
  }
  return NOMBRE_ARCHIVO_MAESTRO.replace('.xlsx', `_${fecha}_editado_r${revision}.xlsx`);
}

function definicionMaestroEditado(
  revision: RevisionMaestro,
  fechaGeneracion: string,
): WorkbookDefinition {
  return {
    sheets: [
      {
        name: HOJA_EMPLEADOS,
        freezeHeader: true,
        columns: COLUMNAS_MAESTRO.map((columna: ColumnaMaestro) => ({
          header: columna,
          format: 'text' as const,
        })),
        rows: revision.registros.map(filaDeRegistro),
      },
      {
        name: HOJA_INSTRUCCIONES,
        columns: [{ header: 'Instrucciones', format: 'text', width: 120 }],
        rows: INSTRUCCIONES_EXPORTADO.map((linea) => [linea]),
      },
      {
        name: HOJA_CONTROL,
        state: 'hidden',
        columns: [
          { header: 'CLAVE', format: 'text', width: 22 },
          { header: 'VALOR', format: 'text', width: 24 },
        ],
        rows: [
          [CLAVE_VERSION_CONTRATO, VERSION_CONTRATO_MAESTRO],
          ['FECHA_GENERACION', fechaGeneracion],
          ['TIPO', 'EDITADO'],
          ['REVISION', String(revision.numero)],
          ['GENERADO_POR', 'Conversor de Haberes'],
        ],
      },
    ],
  };
}

/** Bytes del XLSX con la revisión vigente, generados en memoria con el adaptador. */
export function generarMaestroEditado(
  revision: RevisionMaestro,
  fechaGeneracion: string,
): Promise<Uint8Array> {
  return writeWorkbook(definicionMaestroEditado(revision, fechaGeneracion));
}
