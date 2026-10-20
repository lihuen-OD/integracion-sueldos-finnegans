// Identidades 100 % sintéticas para fixtures de prueba (herramienta de test, no dominio).
// Los DNI se toman de un rango bajo (00.010.000–00.099.999) y los CUIL se calculan con
// el dígito verificador estándar solo para que tengan forma válida.

/** Generador determinístico (mulberry32): mismos datos en cada corrida. */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomInt(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

const CUIL_WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const;

/**
 * CUIL sintético `PP-DDDDDDDD-V`, o `null` si la combinación no admite dígito verificador.
 * Implementación independiente de `src/domain/cuil.ts`: los tests la usan como oráculo.
 */
export function syntheticCuil(prefix: string, dni: number): string | null {
  if (!/^[0-9]{2}$/.test(prefix) || dni < 0 || dni > 99_999_999) {
    throw new Error('prefijo o DNI sintético fuera de rango');
  }
  const base = `${prefix}${String(dni).padStart(8, '0')}`;
  const sum = CUIL_WEIGHTS.reduce((acc, weight, index) => acc + weight * Number(base[index]), 0);
  const remainder = 11 - (sum % 11);
  if (remainder === 10) {
    return null;
  }
  const check = remainder === 11 ? 0 : remainder;
  return `${prefix}-${base.slice(2)}-${String(check)}`;
}

/** Dígito verificador con pesos que se repiten cíclicamente (formulación distinta a la de src). */
function checkDigit(digits: string, cyclicWeights: string): string {
  let sum = 0;
  for (let index = 0; index < digits.length; index += 1) {
    sum += Number(digits[index]) * Number(cyclicWeights[index % cyclicWeights.length]);
  }
  return String((10 - (sum % 10)) % 10);
}

/**
 * CBU sintético: entidad (3) + sucursal (4) + DV + cuenta (13) + DV. Implementación
 * independiente de `src/domain/cbu.ts`: los tests la usan como oráculo. Nunca se escribe
 * un CBU literal en el código (D-042).
 */
export function syntheticCbu(entidad: string, sucursal: string, cuenta: string): string {
  if (!/^[0-9]{3}$/.test(entidad) || !/^[0-9]{4}$/.test(sucursal) || !/^[0-9]{13}$/.test(cuenta)) {
    throw new Error('partes del CBU sintético fuera de formato');
  }
  const bloque1 = `${entidad}${sucursal}`;
  return `${bloque1}${checkDigit(bloque1, '7139')}${cuenta}${checkDigit(cuenta, '3971')}`;
}

/** Cuenta sintética de 13 dígitos para `syntheticCbu`. */
export function syntheticCuenta(random: () => number): string {
  let digits = '';
  while (digits.length < 13) {
    digits += String(randomInt(random, 0, 9));
  }
  return digits;
}

// Apellidos y nombres evidentemente ficticios, con acentos, diéresis, ñ y longitudes variadas.
const APELLIDOS = [
  'Prueba',
  'Ejemplo',
  'Ficticio',
  'Muestra',
  'Ensayo',
  'Simulación',
  'Ñandú',
  'Cigüeña',
  'Pingüino',
  'De la Prueba',
  'Sintético Compuesto',
  'Demostración',
] as const;

const NOMBRES = [
  'Ana Clara',
  'José Luis',
  'María Inés',
  'Íñigo',
  'Ángel Rubén',
  'Lucía Belén',
  'Tomás',
  'Sofía Noemí',
  'Joaquín Andrés Benjamín',
  'Zoe',
] as const;

export interface SyntheticPerson {
  readonly cuil: string;
  readonly apellido: string;
  readonly nombre: string;
}

/** Personas sintéticas únicas; algunas con espacios finales como en el archivo real. */
export function syntheticPeople(count: number, seed: number): SyntheticPerson[] {
  const random = createRandom(seed);
  const people: SyntheticPerson[] = [];
  const used = new Set<string>();
  while (people.length < count) {
    const index = people.length;
    const cuil = syntheticCuil(index % 3 === 0 ? '27' : '20', randomInt(random, 10_000, 99_999));
    if (cuil === null || used.has(cuil)) {
      continue;
    }
    used.add(cuil);
    const apellido = APELLIDOS[index % APELLIDOS.length] ?? 'Prueba';
    const nombre = NOMBRES[(index * 7) % NOMBRES.length] ?? 'Ana';
    people.push({
      cuil,
      apellido: index % 11 === 0 ? `${apellido} ` : apellido,
      nombre: index % 9 === 0 ? `${nombre} ` : nombre,
    });
  }
  return people;
}
