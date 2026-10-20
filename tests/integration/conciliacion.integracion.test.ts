// Integración F2 de punta a punta: bytes XLSX sintéticos → adaptador (bundle de navegador de
// ExcelJS) → parsers → conciliación → readiness, con huellas SHA-256 reales. Datos 100 %
// sintéticos (D-042). Los contextos y políticas "habilitados" son DOBLES DE TEST.
import { describe, expect, it } from 'vitest';
import { calcularHuella } from '../../src/import/huella';
import { parseFinnegans } from '../../src/import/finnegans/parseFinnegans';
import { parseMaestro } from '../../src/import/master/parseMaestro';
import { readWorkbook } from '../../src/import/xlsx';
import {
  conciliar,
  decisionAsignarDestino,
  evaluarReadiness,
  type ContextoReadiness,
  type DecisionOperador,
  type PoliticaLiquidaciones,
  type ResultadoConciliacion,
} from '../../src/reconciliation';
import {
  escenarioMasivo,
  espejoMuestra,
  finnegansXlsx,
  maestroXlsx,
  textoDeCelda,
  type FilaFinnegans,
  type RegistroMaestro,
} from '../fixtures/synthetic/escenarios.ts';
import { BANCO_NACION, BANCO_PATAGONIA } from '../fixtures/synthetic/finnegansLike.ts';

const TODO_MAPEADO: PoliticaLiquidaciones = { tieneMapeoAprobado: () => true };
const TODO_HABILITADO: ContextoReadiness = {
  configuracionCompleta: { BNA_GT_HABERES: true, PATAGONIA_B2: true },
  generadorHabilitado: { BNA_GT_HABERES: true, PATAGONIA_B2: true },
};

async function procesar(
  filas: readonly FilaFinnegans[],
  registros: readonly RegistroMaestro[],
  opciones: {
    decisiones?: readonly DecisionOperador[];
    liquidaciones?: PoliticaLiquidaciones;
  } = {},
): Promise<ResultadoConciliacion> {
  const bytesF = finnegansXlsx(filas);
  const bytesM = maestroXlsx(registros);
  const [libroF, libroM] = await Promise.all([readWorkbook(bytesF), readWorkbook(bytesM)]);
  if (!libroF.ok || !libroM.ok) {
    throw new Error('lectura fallida');
  }
  return conciliar({
    finnegans: parseFinnegans(libroF.value),
    maestro: parseMaestro(libroM.value),
    huellas: { finnegans: await calcularHuella(bytesF), maestro: await calcularHuella(bytesM) },
    ...opciones,
  });
}

function contar(valores: readonly string[]): Record<string, number> {
  const conteo: Record<string, number> = {};
  for (const valor of valores) {
    conteo[valor] = (conteo[valor] ?? 0) + 1;
  }
  return conteo;
}

const estados = (r: ResultadoConciliacion) =>
  contar(
    r.filas.map((f) =>
      f.estado.estado === 'INCLUIDA' ? `INCLUIDA:${f.estado.destino}` : f.estado.estado,
    ),
  );
const codigos = (r: ResultadoConciliacion) =>
  contar(r.incidencias.map((i) => `${i.codigo}:${i.nivel}:${i.alcance}`));

/** Estado esperado por fila, calculado aparte desde los datos sintéticos (oráculo). */
function estadosEsperados(filas: readonly FilaFinnegans[]): Record<string, number> {
  return contar(
    filas.map((fila) =>
      fila.Neto === '0'
        ? 'EXCLUIDA'
        : fila.Banco === BANCO_NACION
          ? 'INCLUIDA:BNA_GT_HABERES'
          : fila.Banco === BANCO_PATAGONIA
            ? 'INCLUIDA:PATAGONIA_B2'
            : 'PENDIENTE',
    ),
  );
}

function totalEsperado(filas: readonly FilaFinnegans[]): bigint {
  return filas.reduce((total, fila) => {
    const [enteros = '0', decimales = ''] = textoDeCelda(fila.Neto).split('.');
    return total + BigInt(enteros) * 100n + BigInt(decimales.padEnd(2, '0'));
  }, 0n);
}

async function asignarPendientes(
  filas: readonly FilaFinnegans[],
  registros: readonly RegistroMaestro[],
  previo: ResultadoConciliacion,
): Promise<DecisionOperador[]> {
  const decisiones = previo.incidencias
    .filter((i) => i.codigo === 'BANCO_VACIO')
    .map((i, n) =>
      decisionAsignarDestino(i, 'BNA_GT_HABERES', { id: `d-${String(n)}`, momento: 'm' }),
    );
  // La decisión se toma sobre los mismos archivos (mismas huellas).
  expect((await procesar(filas, registros, { decisiones })).decisiones.noAplicadas).toEqual([]);
  return decisiones;
}

describe('espejo sintético de la muestra (156 filas)', () => {
  const espejo = espejoMuestra();

  it('producción: 116 BNA, 38 Patagonia, 1 excluida, 1 pendiente; sin mapeos, ambos bloqueados', async () => {
    const resultado = await procesar(espejo.filas, espejo.registros);
    expect(estados(resultado)).toEqual({
      'INCLUIDA:BNA_GT_HABERES': 116,
      'INCLUIDA:PATAGONIA_B2': 38,
      EXCLUIDA: 1,
      PENDIENTE: 1,
    });
    expect(codigos(resultado)).toEqual({
      'LIQUIDACION_SIN_MAPEO:BLOQUEANTE:BNA_GT_HABERES': 116,
      'LIQUIDACION_SIN_MAPEO:BLOQUEANTE:PATAGONIA_B2': 38,
      'NETO_CERO:INFORMACION:GLOBAL': 1,
      'BANCO_VACIO:REQUIERE_REVISION:GLOBAL': 1,
    });
    const { global } = resultado;
    expect(global.estado).toBe('PENDIENTE');
    expect(global.finnegans).toEqual({
      cantidad: 156,
      importe: totalEsperado(espejo.filas),
      filasSinImporte: 0,
    });
    expect([
      global.invarianteCantidad,
      global.invarianteImporte,
      global.invarianteSinPendientes,
    ]).toEqual([true, true, null]);
    const { bna, patagonia } = evaluarReadiness(resultado);
    expect([bna.estado, patagonia.estado]).toEqual([
      'BLOQUEADO_POR_CONCILIACION_GLOBAL',
      'BLOQUEADO_POR_CONCILIACION_GLOBAL',
    ]);
  });

  it('con la fila pendiente asignada: conciliación CERRADA; en producción, ningún banco LISTO', async () => {
    const previo = await procesar(espejo.filas, espejo.registros);
    const decisiones = await asignarPendientes(espejo.filas, espejo.registros, previo);
    const resultado = await procesar(espejo.filas, espejo.registros, { decisiones });
    expect(resultado.global.estado).toBe('CERRADA');
    expect(resultado.global.invarianteSinPendientes).toBe(true);
    expect(resultado.global.bna.cantidad).toBe(117);
    const { bna, patagonia } = evaluarReadiness(resultado);
    expect([bna.estado, patagonia.estado]).toEqual(['BLOQUEADO', 'BLOQUEADO']);
    expect(bna.motivos).toEqual([
      'BLOQUEANTES_DEL_BANCO',
      'CONFIGURACION_INCOMPLETA',
      'GENERADOR_NO_HABILITADO',
    ]);
  });

  it('con dobles de mapeo y de generador: ambos bancos LISTO y PENDIENTE DE HOMOLOGACION', async () => {
    const previo = await procesar(espejo.filas, espejo.registros, { liquidaciones: TODO_MAPEADO });
    const decisiones = await asignarPendientes(espejo.filas, espejo.registros, previo);
    const resultado = await procesar(espejo.filas, espejo.registros, {
      decisiones,
      liquidaciones: TODO_MAPEADO,
    });
    const { bna, patagonia } = evaluarReadiness(resultado, TODO_HABILITADO);
    expect([bna.estado, patagonia.estado]).toEqual(['LISTO_PARA_GENERAR', 'LISTO_PARA_GENERAR']);
    expect([bna.pendienteHomologacion, patagonia.pendienteHomologacion]).toEqual([true, true]);
    expect(
      bna.asignadas.cantidad + patagonia.asignadas.cantidad + resultado.global.excluidas.cantidad,
    ).toBe(156);
  });

  it('si cambia el archivo Finnegans, la asignación de destino deja de aplicarse', async () => {
    const previo = await procesar(espejo.filas, espejo.registros);
    const decisiones = await asignarPendientes(espejo.filas, espejo.registros, previo);
    const modificadas = espejo.filas.map((fila, i) =>
      i === 0 ? { ...fila, Centrodecosto: 'Otro centro' } : fila,
    );
    const resultado = await procesar(modificadas, espejo.registros, { decisiones });
    expect(resultado.decisiones.noAplicadas.map((n) => n.motivo)).toEqual(['DATOS_CAMBIARON']);
    expect(resultado.global.estado).toBe('PENDIENTE');
  });
});

describe('independencia BNA / Patagonia de punta a punta', () => {
  const espejo = espejoMuestra();
  const indicePatagonia = espejo.filas.findIndex(
    (f) => f.Banco === BANCO_PATAGONIA && f.Neto !== '0',
  );
  const indiceBna = espejo.filas.findIndex((f) => f.Banco === BANCO_NACION);
  const conRegistro = (indice: number, cambios: Partial<RegistroMaestro>) =>
    espejo.registros.map((registro, i) => (i === indice ? { ...registro, ...cambios } : registro));

  async function readiness(registros: readonly RegistroMaestro[]) {
    const previo = await procesar(espejo.filas, registros, { liquidaciones: TODO_MAPEADO });
    const decisiones = await asignarPendientes(espejo.filas, registros, previo);
    const resultado = await procesar(espejo.filas, registros, {
      decisiones,
      liquidaciones: TODO_MAPEADO,
    });
    return { resultado, ...evaluarReadiness(resultado, TODO_HABILITADO) };
  }

  it('Patagonia sin número de cuenta: Patagonia BLOQUEADO, BNA LISTO', async () => {
    const { bna, patagonia } = await readiness(
      conRegistro(indicePatagonia, { PAT_NUMERO_CUENTA: null }),
    );
    expect([bna.estado, patagonia.estado]).toEqual(['LISTO_PARA_GENERAR', 'BLOQUEADO']);
  });

  it('BNA sin CBU: BNA BLOQUEADO, Patagonia LISTO', async () => {
    const { bna, patagonia } = await readiness(conRegistro(indiceBna, { CBU: null }));
    expect([bna.estado, patagonia.estado]).toEqual(['BLOQUEADO', 'LISTO_PARA_GENERAR']);
  });

  it('empleado BNA con CBU válido y PAT_TIPO_CUENTA inválido: se informa y BNA sigue LISTO (D-048)', async () => {
    const { resultado, bna } = await readiness(conRegistro(indiceBna, { PAT_TIPO_CUENTA: '9' }));
    expect(bna.estado).toBe('LISTO_PARA_GENERAR');
    expect(codigos(resultado)['DATO_PATAGONIA_INVALIDO:INFORMACION:BNA_GT_HABERES']).toBe(1);
  });
});

describe('volumen', () => {
  it('300 filas: estados según el oráculo, invariantes y totales exactos', async () => {
    const { filas, registros } = escenarioMasivo(300);
    const inicio = performance.now();
    const resultado = await procesar(filas, registros);
    const ms = performance.now() - inicio;
    expect(estados(resultado)).toEqual(estadosEsperados(filas));
    expect(resultado.global.finnegans.importe).toBe(totalEsperado(filas));
    expect([resultado.global.invarianteCantidad, resultado.global.invarianteImporte]).toEqual([
      true,
      true,
    ]);
    expect(ms).toBeLessThan(5_000);
  });

  it('5.000 filas: lectura + parsers + conciliación + readiness en tiempo acotado', async () => {
    const { filas, registros } = escenarioMasivo(5_000, 5_000);
    const bytesF = finnegansXlsx(filas);
    const bytesM = maestroXlsx(registros);
    const inicio = performance.now();
    const [libroF, libroM] = await Promise.all([readWorkbook(bytesF), readWorkbook(bytesM)]);
    if (!libroF.ok || !libroM.ok) {
      throw new Error('lectura fallida');
    }
    const finnegans = parseFinnegans(libroF.value);
    const maestro = parseMaestro(libroM.value);
    const antesDeConciliar = performance.now();
    const resultado = conciliar({ finnegans, maestro, huellas: { finnegans: 'f', maestro: 'm' } });
    const readiness = evaluarReadiness(resultado);
    const fin = performance.now();
    expect(resultado.filas).toHaveLength(5_000);
    expect(estados(resultado)).toEqual(estadosEsperados(filas));
    expect(resultado.global.invarianteCantidad).toBe(true);
    expect(resultado.global.invarianteImporte).toBe(true);
    expect(readiness.bna.asignadas.cantidad).toBe(resultado.global.bna.cantidad);
    expect(fin - antesDeConciliar).toBeLessThan(3_000);
    expect(fin - inicio).toBeLessThan(20_000);
  });
});
