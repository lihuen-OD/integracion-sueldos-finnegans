// Datos y políticas 100 % sintéticos para CP-F6-B. La política sintética es una
// HIPÓTESIS TÉCNICA de test: elige orden, separador, lote, provincia no aplicable,
// versión, comprobante y tipo de liquidación, pero NO resuelve PAT-4, PAT-7/P-09/P-10,
// PAT-9/P-14, PAT-15, PAT-16 ni P-20 en la política productiva.
import { descripcionSinClasificar } from '../../../../src/domain/liquidacion';
import type { Centavos } from '../../../../src/domain/money';
import {
  construirNombrePatagonia,
  resuelto,
  type LotePropuestoPatagonia,
  type PagoPatagonia,
  type ParametrosEnvioPatagonia,
  type PerfilPatagonia,
  type PoliticaPatagonia,
} from '../../../../src/banks/patagonia-b2';

export function perfilPatagonia(numeroEmpresa = '1234'): PerfilPatagonia {
  return { numeroEmpresa };
}

export function parametrosSinteticos(
  cambios: Partial<ParametrosEnvioPatagonia> = {},
): ParametrosEnvioPatagonia {
  return {
    fechaPresentacion: '20261027',
    fechaAcreditacion: '20261030',
    numeroEnvio: '1',
    concepto: 'HAB.05/00',
    hipotesisRellenoPat1: 'ESPACIOS',
    hipotesisDependenciaPat2: 'NUMERICA',
    lineSeparator: '\n',
    trailingSeparator: false,
    ...cambios,
  };
}

export function pagoSintetico(indice: number, cambios: Partial<PagoPatagonia> = {}): PagoPatagonia {
  return {
    ref: { archivo: 'FINNEGANS', hoja: 'Hoja1', fila: indice + 2 },
    neto: (123_456n + BigInt(indice)) as Centavos,
    tipoCuenta: '2',
    numeroCuenta: '0000001234',
    codigoBanco: '034',
    codigoSucursal: '0001',
    tipoDocumento: '001',
    numeroDocumento: String(20_000_000 + indice),
    provinciaDocumento: null,
    codigoDependencia: '1234',
    legajo: String(1000 + indice).padStart(4, '0'),
    apellido: 'Pérez',
    nombre: 'Ana',
    descripcion: descripcionSinClasificar('SUELDO OCTUBRE'),
    ...cambios,
  };
}

export function loteSintetico(
  numeroLote: string,
  pagos: readonly PagoPatagonia[],
): LotePropuestoPatagonia {
  return { numeroLote, pagos };
}

export function politicaSintetica(cambios: Partial<PoliticaPatagonia> = {}): PoliticaPatagonia {
  const base: PoliticaPatagonia = {
    loteo: (pagos) => resuelto([loteSintetico('0001', pagos)]),
    tipoLiquidacion: () => resuelto('001'),
    nombre: (pago) => {
      const resultado = construirNombrePatagonia(pago.apellido, pago.nombre, {
        orden: 'APELLIDO_NOMBRE',
        separador: ' ',
        recortarExtremos: true,
        colapsarEspaciosInternos: true,
        truncamiento: 'TRUNCAR_A_20',
      });
      if (!resultado.ok) {
        throw new Error(`nombre sintético inválido: ${resultado.error}`);
      }
      return resuelto(resultado.value);
    },
    provinciaNoAplica: () => resuelto('00'),
    versionLote: () => resuelto(''),
    comprobanteNoInformado: () => resuelto('0000000'),
  };
  return { ...base, ...cambios };
}
