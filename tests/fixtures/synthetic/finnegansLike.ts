// Fixture con la misma estructura que el reporte real de Finnegans (14 columnas, hoja1,
// inlineStr, dimensión "A1" incorrecta), pero con datos 100 % sintéticos.
import { createRandom, randomInt, syntheticPeople } from './identities.ts';
import { buildXlsx, inlineStr, javaDoubleText, num, type CellSpec } from './xlsxBuilder.ts';

export const FINNEGANS_HEADERS = [
  'Cuil',
  'Apellido',
  'Nombre',
  'Legajo',
  'Banco',
  'Remunerativo',
  'No remunerativo',
  'Descuento',
  'Contribucion',
  'Neto',
  'Descripcion',
  'Transaccionsubtipoid',
  'Legajoapellidonombre',
  'Centrodecosto',
] as const;

export const BANCO_NACION = 'BANCO DE LA NACION ARGENTINA';
export const BANCO_PATAGONIA = 'BANCO PATAGONIA S.A.';

export interface FinnegansLikeRow {
  readonly cuil: string;
  readonly apellido: string;
  readonly nombre: string;
  readonly legajo: string;
  readonly banco: string;
  /** Importes como decimales exactos con 2 decimales (p. ej. "1234.50"). */
  readonly remunerativo: string;
  readonly noRemunerativo: string;
  readonly descuento: string;
  readonly contribucion: string;
  readonly neto: string;
  readonly descripcion: string;
  readonly legajoApellidoNombre: string;
  readonly centroDeCosto: string;
}

export interface FinnegansLikeFixture {
  readonly bytes: Uint8Array;
  readonly rows: readonly FinnegansLikeRow[];
}

function centsToDecimal(cents: bigint): string {
  const whole = cents / 100n;
  const fraction = (cents % 100n).toString().padStart(2, '0');
  return `${whole.toString()}.${fraction}`;
}

const DESCRIPCIONES = [
  'JULIO Agrario',
  'JULIO Agrario',
  'JULIO Agrario',
  'JULIO Comercio ',
  'JULIO Directivos',
] as const;

/**
 * Fila 17: banco vacío (liquidación final). Fila 43: neto cero (Patagonia).
 * Fila 99: neto ≥ 10.000.000 (POI lo escribe en notación científica).
 */
export function buildFinnegansLike(rowCount = 160, seed = 20261014): FinnegansLikeFixture {
  const random = createRandom(seed);
  const people = syntheticPeople(rowCount, seed);
  const rows: FinnegansLikeRow[] = people.map((person, index) => {
    const legajo = String(50 + index).padStart(3, '0');
    const banco = index === 17 ? '' : index % 4 === 3 ? BANCO_PATAGONIA : BANCO_NACION;
    const zero = index === 43;
    const big = index === 99;
    const remunerativo = zero
      ? 0n
      : big
        ? 1_250_000_000n
        : BigInt(randomInt(random, 80_000_000, 400_000_000));
    const noRemunerativo = zero ? 0n : BigInt(randomInt(random, 1_000_000, 30_000_000));
    const descuento = zero ? 0n : BigInt(randomInt(random, 10_000_000, 70_000_000));
    const contribucion = BigInt(randomInt(random, 10_000_000, 90_000_000));
    const neto = remunerativo + noRemunerativo - descuento;
    const descripcion =
      index === 17 || index === 120
        ? 'JULIO Liq final '
        : index === 121 || index === 122
          ? 'JULIO Liq Final'
          : (DESCRIPCIONES[index % DESCRIPCIONES.length] ?? 'JULIO Agrario');
    return {
      cuil: person.cuil,
      apellido: person.apellido,
      nombre: person.nombre,
      legajo,
      banco,
      remunerativo: centsToDecimal(remunerativo),
      noRemunerativo: centsToDecimal(noRemunerativo),
      descuento: centsToDecimal(descuento),
      contribucion: centsToDecimal(contribucion),
      neto: centsToDecimal(neto),
      descripcion,
      legajoApellidoNombre: `${legajo} - ${person.apellido}, ${person.nombre}`,
      centroDeCosto: `Centro de prueba ${String((index % 5) + 1)}`,
    };
  });

  const sheetRows: CellSpec[][] = [
    FINNEGANS_HEADERS.map((header) => inlineStr(header)),
    ...rows.map((row) => [
      inlineStr(row.cuil),
      inlineStr(row.apellido),
      inlineStr(row.nombre),
      inlineStr(row.legajo),
      inlineStr(row.banco),
      num(javaDoubleText(row.remunerativo)),
      num(javaDoubleText(row.noRemunerativo)),
      num(javaDoubleText(row.descuento)),
      num(javaDoubleText(row.contribucion)),
      num(javaDoubleText(row.neto)),
      inlineStr(row.descripcion),
      num('281.0'),
      inlineStr(row.legajoApellidoNombre),
      inlineStr(row.centroDeCosto),
    ]),
  ];

  return {
    bytes: buildXlsx([{ name: 'hoja1', rows: sheetRows, dimension: 'A1' }]),
    rows,
  };
}
