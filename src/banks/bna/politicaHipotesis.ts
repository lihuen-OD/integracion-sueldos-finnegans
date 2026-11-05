// Política BNA de hipótesis técnicas provisionales (CP-F7-BNA-Hipotesis-A1).
//
// Esta política es deliberadamente AJENA a la producción: no se usa desde
// `generarBna`, no reemplaza a `POLITICA_BNA_PRODUCTIVA` y no cambia ningún
// `ContractStatus`. Solo permite comprobar, con las interfaces actuales, las
// hipótesis H-BNA-1/H-BNA-2/H-BNA-6 derivadas del diseño GT 200 y de la
// evidencia visual informada del video.
//
// BNA-11/P-17 y P-09/P-10 siguen SIN RESOLUCIÓN: son decisiones internas y no
// se introducen valores por defecto para ellas.
import type { PagoBna, PerfilBna } from './modelo';
import { resuelto, sinResolucion, type PoliticaBna } from './politica';

/**
 * Hipótesis técnica provisional:
 * - BNA-1: clase `1` (clave fiscal) y tipo `02`; el número documental lo toma
 *   el mapper del CUIL validado de la fila, sin cambios en `DocumentoBna`.
 * - BNA-2: el registro individual usa el CBU del beneficiario.
 * - BNA-6: entidad = `0` + primeros 3 dígitos del CBU; sucursal = posiciones
 *   4–7; DV = posición 8 (lo resuelve el mapper); sucursal de empresa =
 *   posiciones 4–7 del CBU empresarial.
 *
 * No es una regla bancaria confirmada ni una autorización de producción.
 */
export const POLITICA_BNA_HIPOTESIS_TECNICA: PoliticaBna = {
  documento: () => resuelto({ claseDocumento: '1', tipoDocumento: '02' }),
  cbuCuenta: (pago: PagoBna) => resuelto(pago.cbu),
  sucursalEmpresa: (perfil: PerfilBna) => resuelto(String(perfil.cbuEmpresa).slice(3, 7)),
  entidadSucursal: (_perfil: PerfilBna, pago: PagoBna) => {
    const cbu = String(pago.cbu);
    return resuelto({
      entidad: `0${cbu.slice(0, 3)}`,
      sucursal: cbu.slice(3, 7),
    });
  },
  identificadorPrestamo: () => sinResolucion('P-09/P-10'),
  infoCriterio: () => sinResolucion('BNA-11/P-17'),
  camposBeneficiario: () => sinResolucion('BNA-11/P-17'),
};
