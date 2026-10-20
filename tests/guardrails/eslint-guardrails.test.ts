import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
import { guardrailConfigs } from '../../eslint.guardrails.js';

const linter = new ESLint({
  overrideConfigFile: true,
  overrideConfig: [
    { files: ['**/*.ts', '**/*.tsx'], languageOptions: { parser: tseslint.parser } },
    ...guardrailConfigs,
  ],
});

async function ruleIds(code: string, filePath: string): Promise<(string | null)[]> {
  const [result] = await linter.lintText(code, { filePath });
  return result?.messages.map((message) => message.ruleId) ?? [];
}

describe('protecciones de ESLint en src/', () => {
  it.each([
    ['localStorage', "localStorage.setItem('a', 'b');", 'no-restricted-globals'],
    ['sessionStorage', "sessionStorage.getItem('a');", 'no-restricted-globals'],
    ['indexedDB', "indexedDB.open('x');", 'no-restricted-globals'],
    ['window.localStorage', "window.localStorage.getItem('a');", 'no-restricted-properties'],
    ['document.cookie', "document.cookie = 'a=b';", 'no-restricted-properties'],
    ['service worker', "void navigator.serviceWorker.register('x');", 'no-restricted-properties'],
    ['fetch', "void fetch('x');", 'no-restricted-globals'],
    ['window.fetch', "void window.fetch('x');", 'no-restricted-properties'],
    ['XMLHttpRequest', 'new XMLHttpRequest();', 'no-restricted-globals'],
    ['WebSocket', "new WebSocket('ws://x');", 'no-restricted-globals'],
    ['sendBeacon', "navigator.sendBeacon('x');", 'no-restricted-properties'],
    ['console', 'console.log(1);', 'no-console'],
    ['parseFloat', "parseFloat('1.2');", 'no-restricted-globals'],
    ['Number.parseFloat', "Number.parseFloat('1.2');", 'no-restricted-properties'],
    ['toFixed', 'const n = 1.23; n.toFixed(2);', 'no-restricted-syntax'],
  ])('rechaza %s', async (_name, code, expectedRule) => {
    expect(await ruleIds(code, 'src/domain/ejemplo.ts')).toContain(expectedRule);
  });

  it('acepta código sin usos prohibidos', async () => {
    const code = 'export const suma = (a: bigint, b: bigint): bigint => a + b;';
    expect(await ruleIds(code, 'src/domain/ejemplo.ts')).toEqual([]);
  });

  it('no aplica las reglas fuera de src/', async () => {
    expect(await ruleIds("localStorage.getItem('a');", 'tests/ejemplo.ts')).toEqual([]);
  });
});

describe('límites de capas', () => {
  it('rechaza ExcelJS fuera del adaptador', async () => {
    const code = "import { Workbook } from 'exceljs';\nexport { Workbook };";
    expect(await ruleIds(code, 'src/domain/ejemplo.ts')).toContain('no-restricted-imports');
    expect(await ruleIds(code, 'src/ui/Ejemplo.tsx')).toContain('no-restricted-imports');
  });

  it('rechaza importaciones profundas de ExcelJS fuera del adaptador', async () => {
    const code = "import 'exceljs/dist/exceljs.min.js';";
    expect(await ruleIds(code, 'src/ui/Ejemplo.tsx')).toContain('no-restricted-imports');
  });

  it('permite ExcelJS dentro de src/import/xlsx/', async () => {
    const code = "import { Workbook } from 'exceljs';\nexport { Workbook };";
    expect(await ruleIds(code, 'src/import/xlsx/excelAdapter.ts')).toEqual([]);
  });

  it('impide que la UI importe especificaciones bancarias', async () => {
    const code = "import { spec } from '../banks/bna-gt-haberes/spec';\nexport { spec };";
    expect(await ruleIds(code, 'src/ui/Ejemplo.tsx')).toContain('no-restricted-imports');
  });
});

describe('eslint.config.js aplica las protecciones', () => {
  const realConfig = new ESLint();

  it('resuelve las reglas de src/ y de la UI', async () => {
    const domain = (await realConfig.calculateConfigForFile('src/domain/ejemplo.ts')) as {
      rules: Record<string, unknown>;
    };
    const ui = (await realConfig.calculateConfigForFile('src/ui/Ejemplo.tsx')) as {
      rules: Record<string, unknown>;
    };
    const adapter = (await realConfig.calculateConfigForFile(
      'src/import/xlsx/excelAdapter.ts',
    )) as { rules: Record<string, unknown> };

    for (const rule of [
      'no-console',
      'no-restricted-globals',
      'no-restricted-properties',
      'no-restricted-syntax',
      'no-restricted-imports',
    ]) {
      expect(domain.rules[rule]).toBeDefined();
    }
    expect(JSON.stringify(ui.rules['no-restricted-imports'])).toContain('**/banks');
    // En el adaptador la regla queda apagada (severidad 0).
    expect((adapter.rules['no-restricted-imports'] as unknown[])[0]).toBe(0);
  });
});
