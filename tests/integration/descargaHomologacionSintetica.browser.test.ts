import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { build, type Rollup } from 'vite';

function salidasDelBuild(resultado: Awaited<ReturnType<typeof build>>): Rollup.OutputChunk[] {
  const resultados = Array.isArray(resultado) ? resultado : [resultado];
  return resultados.flatMap((item) =>
    'output' in item
      ? item.output.filter((salida): salida is Rollup.OutputChunk => salida.type === 'chunk')
      : [],
  );
}

describe('CP-F8-C · bundle browser-safe del panel sintético', () => {
  it('no arrastra Node, scripts ni tests al grafo de la UI', async () => {
    const entrada = fileURLToPath(
      new URL('../../src/ui/PanelDescargaHomologacionSintetica.tsx', import.meta.url),
    );
    const resultado = await build({
      configFile: false,
      logLevel: 'silent',
      build: {
        target: 'es2022',
        write: false,
        lib: { entry: entrada, formats: ['es'] },
        rollupOptions: { external: ['react', 'react/jsx-runtime'] },
      },
    });
    const chunks = salidasDelBuild(resultado);
    const modulos = chunks.flatMap((chunk) => Object.keys(chunk.modules));
    const codigo = chunks.map((chunk) => chunk.code).join('\n');

    expect(chunks.length).toBeGreaterThan(0);
    expect(modulos.some((id) => /[/\\]tests[/\\]/.test(id))).toBe(false);
    expect(modulos.some((id) => /[/\\]scripts[/\\]/.test(id))).toBe(false);
    expect(modulos.some((id) => id.startsWith('node:'))).toBe(false);
    expect(codigo).not.toMatch(/from\s+["']node:/);
    expect(codigo).not.toMatch(/[/\\](tests|scripts)[/\\]/);
  });
});
