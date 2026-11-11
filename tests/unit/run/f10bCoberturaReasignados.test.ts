// F10-B: cobertura bancaria de filas con `Banco` vacío reasignadas manualmente.
// La selección BNA/Patagonia debe reconocer la decisión vigente por `SourceRef`, sin
// heredar códigos, sin cubrir el otro banco y sin mutar las líneas originales.
import { describe, expect, it } from 'vitest';
import { produccionBnaHabilitada } from '../../../src/banks/bna';
import { produccionPatagoniaHabilitada } from '../../../src/banks/patagonia-b2';
import { claveRef } from '../../../src/domain/incidencias';
import type { PayrollLine } from '../../../src/domain/liquidacion';
import { parseFinnegans } from '../../../src/import/finnegans/parseFinnegans';
import { parseMaestro } from '../../../src/import/master/parseMaestro';
import type { DecisionOperador } from '../../../src/reconciliation';
import {
  conDecision,
  conFinnegans,
  conMaestro,
  nuevaCorrida,
  type EstadoCorrida,
} from '../../../src/run/corrida';
import { evaluarGeneracionBna } from '../../../src/run/generacionBna';
import { evaluarAptitudTecnicaPatagonia } from '../../../src/run/generacionPatagonia';
import {
  asignacionesBancariasValidas,
  lineasBancariasEfectivas,
} from '../../../src/run/lineasBancariasEfectivas';
import {
  aplicarSeleccionesIdentificadorHaberesBnaCorrida,
  politicaLiquidacionesDesdeSeleccionBna,
  resolverSeleccionIdentificadorHaberesBna,
  seleccionarIdentificadoresHaberesBnaCorrida,
} from '../../../src/run/seleccionIdentificadorHaberesBna';
import {
  aplicarSeleccionesLiquidacionPatagoniaCorrida,
  politicaLiquidacionesDesdeSeleccionPatagonia,
  seleccionarLiquidacionesPatagoniaCorrida,
} from '../../../src/run/seleccionLiquidacionPatagonia';
import { conciliarCorrida, crearDecisionAsignarDestino } from '../../../src/ui/orquestacion';
import { createRandom } from '../../fixtures/synthetic/identities';
import { BANCO_NACION, BANCO_PATAGONIA } from '../../fixtures/synthetic/finnegansLike';
import {
  espejoMuestra,
  filaFinnegans,
  finnegansLibro,
  maestroLibro,
  personas,
  registroBna,
  registroPatagonia,
  type FilaFinnegans,
  type RegistroMaestro,
} from '../../fixtures/synthetic/escenarios';
import { parametrosGoldenBna, perfilV2Golden } from '../../fixtures/synthetic/goldenBna';
import {
  parametrosGoldenPatagoniaAlfanumerica,
  perfilV3Golden,
} from '../../fixtures/synthetic/goldenPatagonia';

const HUELLA = 'huella-f10-b';
const HUELLA_MAESTRO = 'huella-maestro-f10-b';
const BNA = 'BNA_GT_HABERES' as const;
const PATAGONIA = 'PATAGONIA_B2' as const;

function corridaDesde(
  filas: readonly FilaFinnegans[],
  registros: readonly RegistroMaestro[],
  huella = HUELLA,
): EstadoCorrida {
  const finnegans = parseFinnegans(finnegansLibro(filas));
  const maestro = parseMaestro(maestroLibro(registros));
  return conMaestro(conFinnegans(nuevaCorrida(), finnegans, huella), maestro, HUELLA_MAESTRO);
}

async function asignar(
  estado: EstadoCorrida,
  linea: PayrollLine,
  destino: typeof BNA | typeof PATAGONIA,
): Promise<EstadoCorrida> {
  const previo = await conciliarCorrida(estado);
  if (!previo.ok) throw new Error(previo.error);
  const incidencia = previo.value.incidencias.find(
    (item) =>
      item.codigo === 'BANCO_VACIO' &&
      item.refs.some((ref) => claveRef(ref) === claveRef(linea.ref)),
  );
  if (incidencia === undefined) throw new Error('BANCO_VACIO esperado');
  return conDecision(estado, crearDecisionAsignarDestino(estado, incidencia, destino));
}

function seleccionarBna(
  estado: EstadoCorrida,
  selecciones: readonly {
    readonly descripcionOriginal: string;
    readonly codigo: '0000' | '0003';
  }[],
): EstadoCorrida {
  const aplicado = aplicarSeleccionesIdentificadorHaberesBnaCorrida(
    estado,
    selecciones.map((seleccion) => ({
      huellaFinnegans: HUELLA,
      destino: BNA,
      descripcionOriginal: seleccion.descripcionOriginal,
      codigoIdentificadorHaberes: seleccion.codigo,
    })),
  );
  if (!aplicado.ok) throw new Error(aplicado.error.map((error) => error.codigo).join());
  return aplicado.value.estado;
}

function seleccionarTodasBna(estado: EstadoCorrida): EstadoCorrida {
  const preparadas = seleccionarIdentificadoresHaberesBnaCorrida(estado, []);
  if (!preparadas.ok) throw new Error('pendientes BNA esperadas');
  return seleccionarBna(
    estado,
    preparadas.value.pendientes.map((item) => ({
      descripcionOriginal: item.descripcionOriginal,
      codigo: '0000' as const,
    })),
  );
}

function seleccionarPatagonia(
  estado: EstadoCorrida,
  selecciones: readonly string[],
): EstadoCorrida {
  const aplicado = aplicarSeleccionesLiquidacionPatagoniaCorrida(
    estado,
    selecciones.map((descripcionOriginal) => ({
      huellaFinnegans: HUELLA,
      destino: PATAGONIA,
      descripcionOriginal,
      codigoTipoLiquidacion: '001',
    })),
  );
  if (!aplicado.ok) throw new Error(aplicado.error.map((error) => error.codigo).join());
  return aplicado.value.estado;
}

function seleccionarTodasPatagonia(estado: EstadoCorrida): EstadoCorrida {
  const preparadas = seleccionarLiquidacionesPatagoniaCorrida(estado, []);
  if (!preparadas.ok) throw new Error('pendientes Patagonia esperadas');
  return seleccionarPatagonia(
    estado,
    preparadas.value.pendientes.map((item) => item.descripcionOriginal),
  );
}

function lineaPorLegajo(estado: EstadoCorrida, legajo: string): PayrollLine {
  const linea = estado.finnegans?.lineas.find((item) => item.legajo === legajo);
  if (linea === undefined) throw new Error(`legajo ${legajo} esperado`);
  return linea;
}

function tieneSinMapeo(fila: {
  readonly incidencias: readonly { readonly codigo: string }[];
}): boolean {
  return fila.incidencias.some((incidencia) => incidencia.codigo === 'LIQUIDACION_SIN_MAPEO');
}

describe('F10-B · cobertura efectiva de filas reasignadas', () => {
  it('BNA: el legajo 067 asignado desde banco vacío queda cubierto por SourceRef', async () => {
    const muestra = espejoMuestra();
    const base = corridaDesde(muestra.filas, muestra.registros);
    const legajo067 = lineaPorLegajo(base, '067');
    expect(legajo067.bancoFinnegans).toBe('');

    const previo = await conciliarCorrida(base);
    if (!previo.ok) throw new Error(previo.error);
    expect(previo.value.filas.find((fila) => fila.linea.legajo === '067')?.estado).toEqual({
      estado: 'PENDIENTE',
      motivo: 'BANCO_VACIO',
    });
    // Estado inicial reproducible: la única fila sin destino es el legajo 067 y el estado
    // global todavía no está cerrado (requiere la decisión del operador).
    expect(previo.value.global).toMatchObject({
      estado: 'PENDIENTE',
      finnegans: { cantidad: 156, importe: 11_506_980_700n },
      bna: { cantidad: 116, importe: 8_022_715_600n },
      patagonia: { cantidad: 38, importe: 3_357_660_800n },
      excluidas: { cantidad: 1, importe: 0n },
      pendientes: { cantidad: 1, importe: 126_604_300n },
    });

    const asignada = await asignar(base, legajo067, BNA);
    expect(asignada.finnegans?.lineas.find((linea) => linea.legajo === '067')?.bancoFinnegans).toBe(
      '',
    );
    const seleccionada = seleccionarTodasPatagonia(seleccionarTodasBna(asignada));
    const resultado = await conciliarCorrida(seleccionada);
    if (!resultado.ok) throw new Error(resultado.error);

    const fila067 = resultado.value.filas.find((fila) => fila.linea.legajo === '067');
    if (fila067 === undefined) throw new Error('fila 067 esperada');
    expect(fila067.estado).toEqual({
      estado: 'INCLUIDA',
      destino: BNA,
      origen: 'DECISION_OPERADOR',
    });
    expect(tieneSinMapeo(fila067)).toBe(false);
    // Ninguna fila incluida (BNA o Patagonia) queda sin mapeo: la cobertura se completó
    // sobre las 156 filas y la descripción nueva no existe en este escenario.
    const incluidas = resultado.value.filas.filter((fila) => fila.estado.estado === 'INCLUIDA');
    expect(incluidas.filter(tieneSinMapeo)).toEqual([]);
    expect(
      resultado.value.incidencias.some(
        (incidencia) => incidencia.codigo === 'LIQUIDACION_SIN_MAPEO',
      ),
    ).toBe(false);
    expect(resultado.value.global).toMatchObject({
      estado: 'CERRADA',
      finnegans: { cantidad: 156, importe: 11_506_980_700n },
      bna: { cantidad: 117, importe: 8_149_319_900n },
      patagonia: { cantidad: 38, importe: 3_357_660_800n },
      excluidas: { cantidad: 1, importe: 0n },
      pendientes: { cantidad: 0, importe: 0n },
    });
    // Ambas selecciones quedaron aplicadas: el resultado no depende de una cobertura parcial.
    expect(resultado.value.revisionSeleccionIdentificadorHaberesBna).toEqual(expect.any(String));
    expect(resultado.value.revisionSeleccionLiquidacionPatagonia).toEqual(expect.any(String));
    // La reasignación no altera la fila ni sus importes: solo cambia el destino efectivo.
    expect(previo.value.global.finnegans).toEqual(resultado.value.global.finnegans);
    expect(fila067.linea.neto).toBe(legajo067.neto);
    expect(fila067.linea.ref).toEqual(legajo067.ref);
    expect(resultado.value.decisiones.aplicadas).toHaveLength(1);

    const cobertura = seleccionada.seleccionIdentificadorHaberesBna?.cantidadesAfectadas.find(
      (item) => item.descripcionOriginal === 'JULIO Liq final ',
    );
    expect(cobertura?.cantidadFilasBna).toBe(2);
    expect(cobertura?.refs.map(claveRef)).toContain(claveRef(legajo067.ref));

    const efectivasBna = lineasBancariasEfectivas(seleccionada, BNA);
    expect(
      efectivasBna.find((linea) => claveRef(linea.ref) === claveRef(legajo067.ref))?.bancoFinnegans,
    ).toBe('BANCO DE LA NACION ARGENTINA');
    const efectivasPatagonia = lineasBancariasEfectivas(seleccionada, PATAGONIA);
    expect(
      efectivasPatagonia.find((linea) => claveRef(linea.ref) === claveRef(legajo067.ref))
        ?.bancoFinnegans,
    ).toBe('');
    expect(asignacionesBancariasValidas(seleccionada).get(claveRef(legajo067.ref))).toBe(BNA);

    const resolucion = resolverSeleccionIdentificadorHaberesBna(
      seleccionada.seleccionIdentificadorHaberesBna,
      HUELLA,
      efectivasBna,
    );
    expect(resolucion?.porRef.get(claveRef(legajo067.ref))).toEqual({
      descripcionOriginal: 'JULIO Liq final ',
      destino: BNA,
      codigoIdentificadorHaberes: '0000',
    });
    expect(
      politicaLiquidacionesDesdeSeleccionPatagonia(seleccionada).resolver(legajo067, PATAGONIA),
    ).toEqual({ estado: 'SIN_RESOLUCION' });

    const generacionBna = evaluarGeneracionBna({
      perfil: perfilV2Golden(),
      conciliacion: resultado.value,
      parametros: parametrosGoldenBna(),
      seleccionIdentificadorHaberesBna: seleccionada.seleccionIdentificadorHaberesBna,
      huellaFinnegans: HUELLA,
    });
    expect(generacionBna.estado).not.toBe('MAPEO_NO_RESUELTO');
    expect(generacionBna.estado).not.toBe('COBERTURA_PAGOS_INCOMPLETA');
    expect('bytes' in generacionBna).toBe(false);
    expect(produccionBnaHabilitada()).toBe(false);
  });

  it('Patagonia: una fila vacía asignada manualmente participa con su SourceRef y no con BNA', async () => {
    const [primera, segunda] = personas(2, 20261117);
    if (primera === undefined || segunda === undefined) throw new Error('personas insuficientes');
    const random = createRandom(20261117);
    const base = corridaDesde(
      [
        filaFinnegans(primera, { Banco: BANCO_PATAGONIA, Descripcion: 'SUELDO' }),
        filaFinnegans(segunda, { Banco: '', Descripcion: 'SUELDO' }),
      ],
      [registroPatagonia(primera, random), registroPatagonia(segunda, random)],
    );
    const filaAsignada = lineaPorLegajo(base, segunda.legajo);
    const asignada = await asignar(base, filaAsignada, PATAGONIA);
    const seleccionada = seleccionarPatagonia(asignada, ['SUELDO']);
    const resultado = await conciliarCorrida(seleccionada);
    if (!resultado.ok) throw new Error(resultado.error);

    const filas = resultado.value.filas.filter(
      (fila) => fila.estado.estado === 'INCLUIDA' && fila.estado.destino === PATAGONIA,
    );
    expect(filas).toHaveLength(2);
    expect(filas.every((fila) => !tieneSinMapeo(fila))).toBe(true);
    const fila = filas.find((item) => item.linea.legajo === segunda.legajo);
    expect(fila?.estado.estado === 'INCLUIDA' ? fila.estado.origen : undefined).toBe(
      'DECISION_OPERADOR',
    );
    expect(resultado.value.global.patagonia).toMatchObject({ cantidad: 2 });
    expect(resultado.value.global.pendientes.cantidad).toBe(0);

    const cobertura = seleccionada.seleccionLiquidacionPatagonia?.cantidadesAfectadas[0];
    expect(cobertura?.refs.map(claveRef)).toContain(claveRef(filaAsignada.ref));
    const efectivas = lineasBancariasEfectivas(seleccionada, PATAGONIA);
    expect(
      efectivas.find((linea) => claveRef(linea.ref) === claveRef(filaAsignada.ref))?.bancoFinnegans,
    ).toBe('BANCO PATAGONIA S.A.');
    expect(
      efectivas.find((linea) => claveRef(linea.ref) === claveRef(filaAsignada.ref))?.ref,
    ).toEqual(filaAsignada.ref);
    expect(
      politicaLiquidacionesDesdeSeleccionPatagonia(seleccionada).resolver(filaAsignada, BNA),
    ).toEqual({ estado: 'SIN_RESOLUCION' });

    const aptitud = evaluarAptitudTecnicaPatagonia({
      perfil: perfilV3Golden(),
      conciliacion: resultado.value,
      parametros: parametrosGoldenPatagoniaAlfanumerica(),
      seleccionLiquidacionPatagonia: seleccionada.seleccionLiquidacionPatagonia,
      huellaFinnegans: HUELLA,
    });
    expect(aptitud.estado).toBe('APTO_TECNICAMENTE');
    if (aptitud.estado === 'APTO_TECNICAMENTE') {
      expect(aptitud.autorizadoParaGenerar).toBe(false);
      expect(aptitud.motivoAutorizacion).toBe('HOMOLOGACION_PATAGONIA_PENDIENTE');
      expect(aptitud.pagos.map((pago) => claveRef(pago.ref))).toContain(claveRef(filaAsignada.ref));
    }
    expect('bytes' in aptitud).toBe(false);
    expect(produccionPatagoniaHabilitada()).toBe(false);
  });

  it('una descripción nueva introducida por la fila reasignada queda pendiente y bloquea BNA', async () => {
    const [primera, segunda] = personas(2, 20261118);
    if (primera === undefined || segunda === undefined) throw new Error('personas insuficientes');
    const random = createRandom(20261118);
    const base = corridaDesde(
      [
        filaFinnegans(primera, { Banco: BANCO_NACION, Descripcion: 'SUELDO' }),
        filaFinnegans(segunda, { Banco: '', Descripcion: 'NUEVA LIQUIDACION' }),
      ],
      [registroBna(primera, random), registroBna(segunda, random)],
    );
    const asignada = await asignar(base, lineaPorLegajo(base, segunda.legajo), BNA);

    const parcial = seleccionarBna(asignada, [{ descripcionOriginal: 'SUELDO', codigo: '0000' }]);
    expect(
      parcial.seleccionIdentificadorHaberesBna?.pendientes.map((item) => item.descripcionOriginal),
    ).toEqual(['NUEVA LIQUIDACION']);
    expect(
      politicaLiquidacionesDesdeSeleccionBna(parcial).resolver(
        lineaPorLegajo(asignada, segunda.legajo),
        BNA,
      ),
    ).toEqual({ estado: 'SIN_RESOLUCION' });

    const bloqueado = await conciliarCorrida(parcial);
    if (!bloqueado.ok) throw new Error(bloqueado.error);
    const bna = bloqueado.value.filas.filter(
      (fila) => fila.estado.estado === 'INCLUIDA' && fila.estado.destino === BNA,
    );
    expect(bna).toHaveLength(2);
    expect(bna.every((fila) => tieneSinMapeo(fila))).toBe(true);
    expect(bloqueado.value.revisionSeleccionIdentificadorHaberesBna).toBeNull();

    const completa = seleccionarBna(asignada, [
      { descripcionOriginal: 'SUELDO', codigo: '0000' },
      { descripcionOriginal: 'NUEVA LIQUIDACION', codigo: '0003' },
    ]);
    const resuelto = await conciliarCorrida(completa);
    if (!resuelto.ok) throw new Error(resuelto.error);
    expect(resuelto.value.filas.every((fila) => !tieneSinMapeo(fila))).toBe(true);
    expect(resuelto.value.revisionSeleccionIdentificadorHaberesBna).toEqual(expect.any(String));
  });

  it('cambiar el destino BNA ↔ Patagonia invalida el snapshot y no hereda la selección anterior', async () => {
    const [persona] = personas(1, 20261119);
    if (persona === undefined) throw new Error('persona insuficiente');
    const random = createRandom(20261119);
    const base = corridaDesde(
      [filaFinnegans(persona, { Banco: '', Descripcion: 'SOLO REASIGNADA' })],
      [registroBna(persona, random)],
    );
    const linea = lineaPorLegajo(base, persona.legajo);
    const conBna = seleccionarBna(await asignar(base, linea, BNA), [
      { descripcionOriginal: 'SOLO REASIGNADA', codigo: '0000' },
    ]);
    expect(conBna.seleccionIdentificadorHaberesBna).not.toBeNull();

    const decisionBna = conBna.decisiones[0];
    if (decisionBna?.tipo !== 'ASIGNAR_DESTINO') {
      throw new Error('decisión BNA esperada');
    }
    const decisionPatagonia: DecisionOperador = { ...decisionBna, id: 'd-2', destino: PATAGONIA };
    const conPatagonia: EstadoCorrida = { ...conBna, decisiones: [decisionPatagonia] };

    expect(asignacionesBancariasValidas(conPatagonia).get(claveRef(linea.ref))).toBe(PATAGONIA);
    expect(
      resolverSeleccionIdentificadorHaberesBna(
        conPatagonia.seleccionIdentificadorHaberesBna,
        HUELLA,
        lineasBancariasEfectivas(conPatagonia, BNA),
      ),
    ).toBeNull();
    expect(politicaLiquidacionesDesdeSeleccionBna(conPatagonia).resolver(linea, BNA)).toEqual({
      estado: 'SIN_RESOLUCION',
    });

    const pendientesPatagonia = seleccionarLiquidacionesPatagoniaCorrida(conPatagonia, []);
    if (!pendientesPatagonia.ok) throw new Error('pendientes Patagonia esperadas');
    expect(pendientesPatagonia.value.pendientes.map((item) => item.descripcionOriginal)).toEqual([
      'SOLO REASIGNADA',
    ]);
    expect(conPatagonia.seleccionLiquidacionPatagonia).toBeNull();

    const pendientesBna = seleccionarIdentificadoresHaberesBnaCorrida(conPatagonia, []);
    if (!pendientesBna.ok) throw new Error('preparación BNA esperada');
    expect(pendientesBna.value.pendientes).toEqual([]);
    expect(pendientesBna.value.cantidadesAfectadas).toEqual([]);
  });

  it('reimportar Finnegans invalida las coberturas ya aplicadas aunque la huella se repita', async () => {
    const [persona] = personas(1, 20261120);
    if (persona === undefined) throw new Error('persona insuficiente');
    const random = createRandom(20261120);
    const base = corridaDesde(
      [filaFinnegans(persona, { Banco: '', Descripcion: 'REIMPORTADA' })],
      [registroBna(persona, random)],
    );
    const conBna = seleccionarBna(await asignar(base, lineaPorLegajo(base, persona.legajo), BNA), [
      { descripcionOriginal: 'REIMPORTADA', codigo: '0000' },
    ]);
    if (conBna.finnegans === null) throw new Error('Finnegans esperado');
    const reimportada = conFinnegans(conBna, conBna.finnegans, HUELLA);
    expect(reimportada.seleccionIdentificadorHaberesBna).toBeNull();
    expect(reimportada.seleccionLiquidacionPatagonia).toBeNull();
  });
});
