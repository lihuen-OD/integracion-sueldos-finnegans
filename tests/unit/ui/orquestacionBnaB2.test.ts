import { describe, expect, it } from 'vitest';
import { parseFinnegans } from '../../../src/import/finnegans/parseFinnegans';
import { parseMaestro } from '../../../src/import/master/parseMaestro';
import type { FilaConciliada } from '../../../src/reconciliation';
import {
  conFinnegans,
  conMaestro,
  nuevaCorrida,
  type EstadoCorrida,
} from '../../../src/run/corrida';
import {
  aplicarSeleccionesIdentificadorHaberesBnaCorrida,
  aplicarSeleccionesLiquidacionPatagoniaCorrida,
  conciliarCorrida,
} from '../../../src/ui/orquestacion';
import { createRandom } from '../../fixtures/synthetic/identities';
import { BANCO_PATAGONIA } from '../../fixtures/synthetic/finnegansLike';
import {
  filaFinnegans,
  finnegansLibro,
  maestroLibro,
  personas,
  registroBna,
  registroPatagonia,
} from '../../fixtures/synthetic/escenarios';

const HUELLA = 'huella-bna-b2-orquestacion';

function corridaMixta(): EstadoCorrida {
  const [primera, segunda, tercera] = personas(3, 20261116);
  if (primera === undefined || segunda === undefined || tercera === undefined) {
    throw new Error('personas sintéticas insuficientes');
  }
  const random = createRandom(20261116);
  const finnegans = parseFinnegans(
    finnegansLibro([
      filaFinnegans(primera, { Descripcion: 'SUELDO' }),
      filaFinnegans(segunda, { Descripcion: 'SAC' }),
      filaFinnegans(tercera, { Banco: BANCO_PATAGONIA, Descripcion: 'SUELDO' }),
    ]),
  );
  const maestro = parseMaestro(
    maestroLibro([
      registroBna(primera, random),
      registroBna(segunda, random),
      registroPatagonia(tercera, random),
    ]),
  );
  return conMaestro(conFinnegans(nuevaCorrida(), finnegans, HUELLA), maestro, 'huella-maestro');
}

function seleccionarBna(
  estado: EstadoCorrida,
  selecciones: readonly {
    readonly descripcionOriginal: string;
    readonly codigoIdentificadorHaberes: '0000' | '0003';
  }[],
): EstadoCorrida {
  const resultado = aplicarSeleccionesIdentificadorHaberesBnaCorrida(
    estado,
    selecciones.map((seleccion) => ({
      huellaFinnegans: HUELLA,
      destino: 'BNA_GT_HABERES',
      ...seleccion,
    })),
  );
  if (!resultado.ok) throw new Error('selección BNA sintética inválida');
  return resultado.value.estado;
}

function seleccionarPatagonia(estado: EstadoCorrida): EstadoCorrida {
  const resultado = aplicarSeleccionesLiquidacionPatagoniaCorrida(estado, [
    {
      huellaFinnegans: HUELLA,
      descripcionOriginal: 'SUELDO',
      destino: 'PATAGONIA_B2',
      codigoTipoLiquidacion: '001',
    },
  ]);
  if (!resultado.ok) throw new Error('selección Patagonia sintética inválida');
  return resultado.value.estado;
}

function tieneLiquidacionSinMapeo(fila: FilaConciliada): boolean {
  return fila.incidencias.some((incidencia) => incidencia.codigo === 'LIQUIDACION_SIN_MAPEO');
}

describe('BNA-B2 · composición de políticas en conciliarCorrida', () => {
  it('resuelve cada banco con su snapshot y conserva revisiones independientes', async () => {
    const estado = seleccionarPatagonia(
      seleccionarBna(corridaMixta(), [
        { descripcionOriginal: 'SUELDO', codigoIdentificadorHaberes: '0000' },
        { descripcionOriginal: 'SAC', codigoIdentificadorHaberes: '0003' },
      ]),
    );
    const resultado = await conciliarCorrida(estado);
    if (!resultado.ok) throw new Error(resultado.error);

    expect(resultado.value.filas.every((fila) => !tieneLiquidacionSinMapeo(fila))).toBe(true);
    expect(resultado.value.revisionSeleccionIdentificadorHaberesBna).toEqual(expect.any(String));
    expect(resultado.value.revisionSeleccionLiquidacionPatagonia).toEqual(expect.any(String));
  });

  it('una selección BNA parcial no resuelve BNA y no afecta Patagonia', async () => {
    const estado = seleccionarPatagonia(
      seleccionarBna(corridaMixta(), [
        { descripcionOriginal: 'SUELDO', codigoIdentificadorHaberes: '0000' },
      ]),
    );
    const resultado = await conciliarCorrida(estado);
    if (!resultado.ok) throw new Error(resultado.error);
    const bna = resultado.value.filas.filter(
      (fila) => fila.estado.estado === 'INCLUIDA' && fila.estado.destino === 'BNA_GT_HABERES',
    );
    const patagonia = resultado.value.filas.filter(
      (fila) => fila.estado.estado === 'INCLUIDA' && fila.estado.destino === 'PATAGONIA_B2',
    );

    expect(bna).toHaveLength(2);
    expect(bna.every(tieneLiquidacionSinMapeo)).toBe(true);
    expect(patagonia).toHaveLength(1);
    expect(patagonia.every((fila) => !tieneLiquidacionSinMapeo(fila))).toBe(true);
    expect(resultado.value.revisionSeleccionIdentificadorHaberesBna).toBeNull();
    expect(resultado.value.revisionSeleccionLiquidacionPatagonia).toEqual(expect.any(String));
  });

  it('corregir BNA cambia solo su snapshot y su revisión', async () => {
    const inicial = seleccionarPatagonia(
      seleccionarBna(corridaMixta(), [
        { descripcionOriginal: 'SUELDO', codigoIdentificadorHaberes: '0000' },
        { descripcionOriginal: 'SAC', codigoIdentificadorHaberes: '0003' },
      ]),
    );
    const primera = await conciliarCorrida(inicial);
    if (!primera.ok) throw new Error(primera.error);
    const snapshotPatagonia = inicial.seleccionLiquidacionPatagonia;

    const corregido = seleccionarBna(inicial, [
      { descripcionOriginal: 'SUELDO', codigoIdentificadorHaberes: '0003' },
      { descripcionOriginal: 'SAC', codigoIdentificadorHaberes: '0003' },
    ]);
    const segunda = await conciliarCorrida(corregido);
    if (!segunda.ok) throw new Error(segunda.error);

    expect(corregido.seleccionLiquidacionPatagonia).toBe(snapshotPatagonia);
    expect(segunda.value.revisionSeleccionIdentificadorHaberesBna).not.toBe(
      primera.value.revisionSeleccionIdentificadorHaberesBna,
    );
    expect(segunda.value.revisionSeleccionLiquidacionPatagonia).toBe(
      primera.value.revisionSeleccionLiquidacionPatagonia,
    );
  });

  it('reimportar incluso con la misma huella invalida la evidencia anterior', async () => {
    const seleccionado = seleccionarPatagonia(
      seleccionarBna(corridaMixta(), [
        { descripcionOriginal: 'SUELDO', codigoIdentificadorHaberes: '0000' },
        { descripcionOriginal: 'SAC', codigoIdentificadorHaberes: '0003' },
      ]),
    );
    const anterior = await conciliarCorrida(seleccionado);
    if (!anterior.ok || seleccionado.finnegans === null) throw new Error('corrida esperada');
    const reimportado = conFinnegans(seleccionado, seleccionado.finnegans, HUELLA);
    const nuevo = await conciliarCorrida(reimportado);
    if (!nuevo.ok) throw new Error(nuevo.error);

    expect(reimportado.seleccionIdentificadorHaberesBna).toBeNull();
    expect(nuevo.value.revisionSeleccionIdentificadorHaberesBna).toBeNull();
    expect(
      nuevo.value.filas
        .filter(
          (fila) => fila.estado.estado === 'INCLUIDA' && fila.estado.destino === 'BNA_GT_HABERES',
        )
        .every(tieneLiquidacionSinMapeo),
    ).toBe(true);
    expect(anterior.value.revisionSeleccionIdentificadorHaberesBna).not.toBeNull();
  });
});
