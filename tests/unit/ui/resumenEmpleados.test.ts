import { describe, expect, it } from 'vitest';
import type { CodigoIncidencia, NivelIncidencia } from '../../../src/domain/incidencias';
import type { FilaConciliada, IncidenciaConciliada } from '../../../src/reconciliation';
import {
  accionPendiente,
  coincideBusqueda,
  estadoDatosBancarios,
  pasaFiltroEmpleado,
  resumirEmpleados,
} from '../../../src/ui/resumenEmpleados';

interface OpcionesIncidencia {
  readonly resoluble?: boolean;
  readonly resuelta?: boolean;
}

function incidencia(
  codigo: CodigoIncidencia,
  nivel: NivelIncidencia,
  opciones: OpcionesIncidencia = {},
): IncidenciaConciliada {
  const observado = { cuilTexto: 'cuil-sintetico', valores: {}, huellas: {} };
  return {
    id: `${codigo}-1`,
    codigo,
    nivel,
    alcance: 'GLOBAL',
    refs: [{ archivo: 'FINNEGANS', hoja: 'Liquidacion', fila: 2 }],
    detalle: codigo,
    ...(opciones.resoluble === true
      ? { resoluble: { por: 'CONFIRMAR_REVISION' as const, observado } }
      : {}),
    ...(opciones.resuelta === true
      ? {
          resolucion: {
            decisionId: `decision-${codigo}`,
            tipo: 'CONFIRMAR_REVISION' as const,
            momento: '2026-01-01T00:00:00.000Z',
          },
        }
      : {}),
  };
}

interface OpcionesFila {
  readonly estado:
    | { readonly estado: 'INCLUIDA'; readonly destino: 'BNA_GT_HABERES' | 'PATAGONIA_B2' }
    | { readonly estado: 'PENDIENTE' }
    | { readonly estado: 'EXCLUIDA' };
  readonly nivel: FilaConciliada['nivel'];
  readonly incidencias?: readonly IncidenciaConciliada[];
  readonly legajo?: string;
  readonly nombre?: string;
}

function fila(opciones: OpcionesFila): FilaConciliada {
  const estado =
    opciones.estado.estado === 'INCLUIDA'
      ? { ...opciones.estado, origen: 'BANCO_FINNEGANS' as const }
      : opciones.estado.estado === 'PENDIENTE'
        ? { estado: 'PENDIENTE' as const, motivo: 'BANCO_VACIO' as const }
        : { estado: 'EXCLUIDA' as const, motivo: 'NETO_CERO' as const };
  return {
    linea: {
      legajo: opciones.legajo ?? '000',
      legajoApellidoNombre: opciones.nombre ?? 'SINTETICO, PRUEBA',
    },
    registro: null,
    estado,
    incidencias: opciones.incidencias ?? [],
    nivel: opciones.nivel,
  } as unknown as FilaConciliada;
}

const bnaCorrecto = fila({
  estado: { estado: 'INCLUIDA', destino: 'BNA_GT_HABERES' },
  nivel: 'CORRECTO',
  legajo: '001',
  nombre: '001 ALVAREZ, MARIA',
});
const patagoniaCbuFaltante = fila({
  estado: { estado: 'INCLUIDA', destino: 'PATAGONIA_B2' },
  nivel: 'REQUIERE_REVISION',
  incidencias: [incidencia('CBU_FALTANTE', 'REQUIERE_REVISION', { resoluble: true })],
  legajo: '002',
  nombre: '002 BENITEZ, JUAN',
});
const pendienteBancoVacio = fila({
  estado: { estado: 'PENDIENTE' },
  nivel: 'REQUIERE_REVISION',
  incidencias: [incidencia('BANCO_VACIO', 'REQUIERE_REVISION', { resoluble: true })],
  legajo: '003',
  nombre: '003 GOMEZ, ANA',
});
const excluidaNetoCero = fila({
  estado: { estado: 'EXCLUIDA' },
  nivel: 'BLOQUEANTE',
  incidencias: [incidencia('NETO_CERO', 'BLOQUEANTE')],
  legajo: '004',
  nombre: '004 DIAZ, LUIS',
});
const bnaConInformacion = fila({
  estado: { estado: 'INCLUIDA', destino: 'BNA_GT_HABERES' },
  nivel: 'INFORMACION',
  incidencias: [
    incidencia('SIN_MAESTRO', 'INFORMACION', { resoluble: true, resuelta: true }),
    incidencia('CUIL_REPETIDO_FINNEGANS', 'INFORMACION'),
  ],
  legajo: '005',
  nombre: '005 FERNANDEZ, SOFIA',
});

const FILAS: readonly FilaConciliada[] = [
  bnaCorrecto,
  patagoniaCbuFaltante,
  pendienteBancoVacio,
  excluidaNetoCero,
  bnaConInformacion,
];

describe('resumenEmpleados', () => {
  it('cuenta destinos, exclusiones y pendientes a partir de los estados ya calculados', () => {
    expect(resumirEmpleados(FILAS)).toEqual({
      total: 5,
      bna: 2,
      patagonia: 1,
      pendientes: 1,
      excluidos: 1,
      conBloqueos: 1,
      requierenAccion: 2,
      sinMaestro: 1,
      datosBancariosARevisar: 1,
      datosCompletos: 2,
      duplicados: 1,
    });
  });

  it('solo cuenta como acción pendiente las incidencias resolubles sin resolución', () => {
    expect(accionPendiente(bnaCorrecto)).toBe(false);
    expect(accionPendiente(pendienteBancoVacio)).toBe(true);
    expect(accionPendiente(bnaConInformacion)).toBe(false);
  });

  it('filtra por estado, banco, datos bancarios y datos duplicados', () => {
    const cantidades = Object.fromEntries(
      (
        [
          'TODOS',
          'ACCION',
          'BLOQUEANTES',
          'INFORMACION',
          'BNA',
          'PATAGONIA',
          'PENDIENTES',
          'EXCLUIDOS',
          'SIN_MAESTRO',
          'DATOS',
          'DUPLICADOS',
        ] as const
      ).map((filtro) => [filtro, FILAS.filter((item) => pasaFiltroEmpleado(item, filtro)).length]),
    );
    expect(cantidades).toEqual({
      TODOS: 5,
      ACCION: 2,
      BLOQUEANTES: 1,
      INFORMACION: 1,
      BNA: 2,
      PATAGONIA: 1,
      PENDIENTES: 1,
      EXCLUIDOS: 1,
      SIN_MAESTRO: 1,
      DATOS: 1,
      DUPLICADOS: 1,
    });
  });

  it('busca por legajo o nombre sin distinguir mayúsculas y acepta texto vacío', () => {
    expect(coincideBusqueda(pendienteBancoVacio, '  gomez  ')).toBe(true);
    expect(coincideBusqueda(pendienteBancoVacio, '003')).toBe(true);
    expect(coincideBusqueda(pendienteBancoVacio, 'benitez')).toBe(false);
    expect(coincideBusqueda(pendienteBancoVacio, '   ')).toBe(true);
  });

  it('describe el estado de los datos bancarios para la tabla', () => {
    expect(estadoDatosBancarios(bnaCorrecto)).toEqual({
      texto: 'Completos',
      tono: 'exito',
    });
    expect(estadoDatosBancarios(patagoniaCbuFaltante)).toEqual({
      texto: 'Revisar',
      tono: 'atencion',
    });
    expect(estadoDatosBancarios(pendienteBancoVacio)).toEqual({
      texto: 'Falta destino',
      tono: 'atencion',
    });
    expect(estadoDatosBancarios(excluidaNetoCero)).toEqual({
      texto: 'No aplica',
      tono: 'neutral',
    });
  });
});
