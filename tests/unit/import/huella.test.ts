import { describe, expect, it } from 'vitest';
import { calcularHuella } from '../../../src/import/huella';

describe('calcularHuella (SHA-256 local)', () => {
  it('coincide con el vector de prueba NIST de "abc"', async () => {
    expect(await calcularHuella(new TextEncoder().encode('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('es determinista y distingue un solo byte distinto', async () => {
    const a = new Uint8Array([1, 2, 3]);
    expect(await calcularHuella(a)).toBe(await calcularHuella(new Uint8Array([1, 2, 3])));
    expect(await calcularHuella(a)).not.toBe(await calcularHuella(new Uint8Array([1, 2, 4])));
    expect(await calcularHuella(a.subarray(1))).toBe(await calcularHuella(new Uint8Array([2, 3])));
  });
});
