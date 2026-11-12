import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { build } from 'vite';

interface ChunkGenerado {
  readonly type: 'chunk';
  readonly modules: Readonly<Record<string, unknown>>;
  readonly code: string;
}

interface SalidaGenerada {
  readonly output: readonly ({ readonly type: string } | ChunkGenerado)[];
}

describe('CP-F8-B · bundle browser-safe del compositor sintético', () => {
  it('genera ESM sin Node, scripts ni tests en el grafo del navegador', async () => {
    const entry = fileURLToPath(
      new URL('../../src/run/composicionHomologacionSintetica.ts', import.meta.url),
    );
    const resultado = await build({
      configFile: false,
      logLevel: 'silent',
      build: {
        target: 'es2022',
        write: false,
        minify: false,
        lib: { entry, formats: ['es'], fileName: () => 'compositor-sintetico.js' },
      },
    });
    const salidas = (Array.isArray(resultado)
      ? resultado
      : [resultado]) as unknown as readonly SalidaGenerada[];
    const chunks = salidas.flatMap((salida) =>
      salida.output.filter((item): item is ChunkGenerado => item.type === 'chunk'),
    );
    const modulos = chunks.flatMap((chunk) => Object.keys(chunk.modules));
    const codigo = chunks.map((chunk) => chunk.code).join('\n');

    expect(chunks.length).toBeGreaterThan(0);
    expect(modulos).toContain(entry);
    expect(modulos.some((id) => /[\\/]tests[\\/]/.test(id))).toBe(false);
    expect(modulos.some((id) => /[\\/]scripts[\\/]/.test(id))).toBe(false);
    expect(modulos.some((id) => id.startsWith('node:'))).toBe(false);
    expect(codigo).not.toMatch(/\b(?:require|process)\s*\(/);
    expect(codigo).not.toMatch(/from\s+["']node:/);
  });
});
