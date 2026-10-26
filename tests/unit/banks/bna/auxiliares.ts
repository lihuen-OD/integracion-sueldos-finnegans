// Datos y políticas 100 % sintéticos para CP-F5-B. Ningún valor literal tiene forma de
// CUIL, CUIT o CBU completo: se generan con los oráculos de tests (D-042). La política
// sintética es una HIPÓTESIS TÉCNICA de test; no resuelve BNA-1/2/6/P-09/P-10/BNA-11 y
// no modifica la spec, `ISSUES_BNA` ni la habilitación productiva.
import { parseCbu } from '../../../../src/domain/cbu';
import { parseCuitEmpresa } from '../../../../src/domain/cuitEmpresa';
import { parseCuil } from '../../../../src/domain/cuil';
import { descripcionSinClasificar } from '../../../../src/domain/liquidacion';
import type { Centavos } from '../../../../src/domain/money';
import type {
  PagoBna,
  ParametrosEnvioBna,
  PerfilBna,
  PoliticaBna,
} from '../../../../src/banks/bna';
import { resuelto } from '../../../../src/banks/bna';
import {
  createRandom,
  syntheticCbu,
  syntheticCuenta,
  syntheticCuil,
} from '../../../fixtures/synthetic/identities.ts';

function cuilSintetico(prefix: string, dniBase: number) {
  for (let intento = 0; intento < 100; intento += 1) {
    const texto = syntheticCuil(prefix, dniBase + intento);
    if (texto === null) {
      continue;
    }
    const resultado = parseCuil(texto);
    if (!resultado.ok) {
      throw new Error(`CUIL sintético rechazado: ${resultado.error}`);
    }
    return resultado.value;
  }
  throw new Error('CUIL sintético no asignable');
}

function cbuSintetico(semilla: number, sucursal = '0001') {
  const random = createRandom(semilla);
  const resultado = parseCbu(syntheticCbu('011', sucursal, syntheticCuenta(random)));
  if (!resultado.ok) {
    throw new Error(`CBU sintético rechazado: ${resultado.error}`);
  }
  return resultado.value;
}

export function cuitSintetico(): PerfilBna['cuitEmpresa'] {
  const texto = syntheticCuil('30', 12_345_678);
  if (texto === null) {
    throw new Error('CUIT sintético no asignable');
  }
  const resultado = parseCuitEmpresa(texto);
  if (!resultado.ok) {
    throw new Error(`CUIT sintético rechazado: ${resultado.error}`);
  }
  return resultado.value;
}

export function perfilSintetico(codigoConvenio = '4455'): PerfilBna {
  return {
    cuitEmpresa: cuitSintetico(),
    cbuEmpresa: cbuSintetico(101),
    codigoConvenio,
    moneda: '0',
  };
}

export function parametrosSinteticos(
  cambios: Partial<ParametrosEnvioBna> = {},
): ParametrosEnvioBna {
  return {
    fechaCompensacion: '20261030',
    numeroEnvio: '1',
    infoCriterioEmpresa: 'PAGO DE HABERES',
    referenciaUnivoca: 'HABERES OCTUBRE',
    lineSeparator: '\n',
    trailingSeparator: false,
    ...cambios,
  };
}

export function pagoSintetico(indice: number, cambios: Partial<PagoBna> = {}): PagoBna {
  return {
    ref: { archivo: 'FINNEGANS', hoja: 'hoja1', fila: indice + 2 },
    cuil: cuilSintetico(indice % 2 === 0 ? '20' : '27', 20_000 + indice * 10),
    cbu: cbuSintetico(500 + indice),
    neto: (123_456n + BigInt(indice)) as Centavos,
    descripcion: descripcionSinClasificar('JULIO Agrario'),
    ...cambios,
  };
}

export function mismaCuenta(pago: PagoBna): PagoBna {
  return {
    ...pago,
    cuil: cuilSintetico('20', 30_000 + (pago.ref.fila ?? 0) * 10),
    cbu: pago.cbu,
  };
}

/**
 * Política sintética explícita para probar la capacidad técnica. Es solo una hipótesis:
 * BNA-1 sigue BLOQUEADA y elegir `02` aquí no la resuelve.
 */
export function politicaSintetica(cambios: Partial<PoliticaBna> = {}): PoliticaBna {
  const base: PoliticaBna = {
    documento: () => resuelto({ claseDocumento: '1', tipoDocumento: '02' }),
    cbuCuenta: (pago) => resuelto(pago.cbu),
    sucursalEmpresa: (perfil) => resuelto(String(perfil.cbuEmpresa).slice(3, 7)),
    entidadSucursal: (perfil) => {
      const cbu = String(perfil.cbuEmpresa);
      return resuelto({ entidad: `0${cbu.slice(0, 3)}`, sucursal: cbu.slice(3, 7) });
    },
    identificadorPrestamo: () => resuelto('0000'),
    infoCriterio: (_perfil, parametros) => resuelto(parametros.infoCriterioEmpresa),
    camposBeneficiario: (pago) =>
      resuelto({
        identificacionBeneficiario: String(pago.cuil),
        datosEmpresa: 'USO INTERNO',
      }),
  };
  return { ...base, ...cambios };
}
