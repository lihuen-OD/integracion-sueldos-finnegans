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

  const importa = (source: string) => `import { x } from '${source}';\nexport { x };`;

  it.each([
    ['la UI', 'src/ui/spike/Ejemplo.tsx', '../../import/xlsx/excelAdapter'],
    ['un parser', 'src/import/finnegans/ejemplo.ts', '../xlsx/types'],
    ['el dominio', 'src/domain/ejemplo.ts', '../import/xlsx/types'],
  ])('rechaza que %s importe archivos internos del adaptador XLSX', async (_capa, file, source) => {
    expect(await ruleIds(importa(source), file)).toContain('no-restricted-imports');
  });

  it.each([
    ['src/ui/spike/Ejemplo.tsx', '../../import/xlsx'],
    ['src/import/finnegans/ejemplo.ts', '../xlsx'],
    ['src/import/master/ejemplo.ts', '../xlsx'],
  ])('permite que %s use la API pública del adaptador', async (file, source) => {
    expect(await ruleIds(importa(source), file)).toEqual([]);
  });

  it.each([
    ['src/domain/ejemplo.ts', '../import/finnegans/parseFinnegans'],
    ['src/domain/ejemplo.ts', '../reconciliation/conciliar'],
    ['src/domain/ejemplo.ts', '../ui/App'],
    ['src/domain/ejemplo.ts', '../banks/fixed-width/spec'],
    ['src/domain/ejemplo.ts', 'react'],
    ['src/shared/ejemplo.ts', '../domain/cuil'],
    ['src/shared/ejemplo.ts', '../import/xlsx'],
    ['src/reconciliation/ejemplo.ts', '../import/finnegans/parseFinnegans'],
    ['src/reconciliation/ejemplo.ts', '../import/xlsx'],
    ['src/reconciliation/ejemplo.ts', '../ui/App'],
    ['src/import/finnegans/ejemplo.ts', '../../reconciliation/conciliar'],
    ['src/import/master/ejemplo.ts', '../../ui/App'],
    ['src/import/master/ejemplo.ts', 'react'],
  ])('%s no puede importar %s', async (file, source) => {
    expect(await ruleIds(importa(source), file)).toContain('no-restricted-imports');
  });

  it.each([
    ['src/domain/ejemplo.ts', '../shared/result'],
    ['src/domain/ejemplo.ts', './cuil'],
    ['src/reconciliation/ejemplo.ts', '../domain/cuil'],
    ['src/import/finnegans/ejemplo.ts', '../../domain/cuil'],
    ['src/import/master/ejemplo.ts', '../comun'],
  ])('%s puede importar %s', async (file, source) => {
    expect(await ruleIds(importa(source), file)).toEqual([]);
  });
});

describe('frontera del motor fixed-width (T4-11)', () => {
  const importa = (source: string) => `import { x } from '${source}';\nexport { x };`;

  it.each([
    ['el dominio', '../domain/cuil'],
    ['la conciliación', '../reconciliation/conciliar'],
    ['la UI', '../ui/App'],
    ['la importación', '../import/finnegans/parseFinnegans'],
    ['la exportación', '../export/archivos'],
    ['un banco hermano', '../bna-gt-haberes/spec'],
    ['React', 'react'],
    ['React DOM', 'react-dom'],
    ['ExcelJS', 'exceljs'],
    ['un paquete externo arbitrario (zod)', 'zod'],
    ['otro paquete bare neutral (lodash)', 'lodash'],
    ['otro paquete bare neutral (uuid)', 'uuid'],
    ['un paquete scopeado', '@scope/pkg'],
    ['traversal tras ./sub/', './sub/../../../otro/x'],
    ['traversal tras ../fixed-width/', '../fixed-width/../../otro/x'],
    ['traversal tras ../../shared/', '../../shared/../otro/x'],
    ['traversal tras ../../banks/fixed-width/', '../../banks/fixed-width/../../../otro/x'],
    ['un relativo que sube dos niveles a otro destino', '../../otro/x'],
    ['un relativo que sube un nivel a otro destino', '../otro/x'],
  ])('rechaza que el motor importe %s', async (_capa, source) => {
    expect(await ruleIds(importa(source), 'src/banks/fixed-width/ejemplo.ts')).toContain(
      'fixed-width/destino-permitido',
    );
  });

  it.each([
    ['shared', '../../shared/result'],
    ['shared en subdirectorio', '../../shared/sub/modulo'],
    ['su propio subárbol', './estructura'],
    ['otra ruta interna legítima', './sub/estructura'],
    ['su subárbol vía ../fixed-width', '../fixed-width/estructura'],
    ['su subárbol vía ../../banks/fixed-width', '../../banks/fixed-width/estructura'],
  ])('permite que el motor importe %s', async (_capa, source) => {
    expect(await ruleIds(importa(source), 'src/banks/fixed-width/ejemplo.ts')).toEqual([]);
  });

  const desdeRaiz = 'src/banks/fixed-width/index.ts';
  const desdeSubdirectorio = 'src/banks/fixed-width/sub/modulo.ts';
  const desdeProfundidad = 'src/banks/fixed-width/sub/deep/modulo.ts';

  it.each([
    ['raíz → shared', desdeRaiz, '../../shared/result'],
    ['raíz → propio subárbol', desdeRaiz, './estructura'],
    ['subdirectorio → propio subárbol', desdeSubdirectorio, './otro'],
    ['subdirectorio → raíz del motor', desdeSubdirectorio, '../index'],
    ['subdirectorio → shared real', desdeSubdirectorio, '../../../shared/result'],
    ['profundidad → propio subárbol', desdeProfundidad, '../../index'],
    ['profundidad → shared real', desdeProfundidad, '../../../../shared/result'],
  ])('valida destino desde %s', async (_caso, file, source) => {
    expect(await ruleIds(importa(source), file)).toEqual([]);
  });

  it.each([
    [
      'subdirectorio: ../../shared ya no llega a src/shared',
      desdeSubdirectorio,
      '../../shared/result',
    ],
    [
      'profundidad: ../../../shared tampoco llega a src/shared',
      desdeProfundidad,
      '../../../shared/result',
    ],
    ['subdirectorio: traversal a src/otro', desdeSubdirectorio, '../../../otro/x'],
    ['profundidad: traversal a src/otro', desdeProfundidad, '../../../../otro/x'],
  ])('rechaza destino inválido desde %s', async (_caso, file, source) => {
    expect(await ruleIds(importa(source), file)).toContain('fixed-width/destino-permitido');
  });

  it('la whitelist real de eslint.config.js rechaza bare packages', async () => {
    const realConfig = new ESLint();
    // Archivo real del proyecto: el parser tipado exige pertenencia al tsconfig.
    const [result] = await realConfig.lintText(importa('zod'), {
      filePath: 'src/banks/fixed-width/index.ts',
    });
    expect(result?.messages.map((message) => message.ruleId)).toContain(
      'fixed-width/destino-permitido',
    );
  });

  it('la whitelist real de eslint.config.js rechaza escapes de traversal', async () => {
    const realConfig = new ESLint();
    const [result] = await realConfig.lintText(importa('../../shared/../otro/x'), {
      filePath: 'src/banks/fixed-width/index.ts',
    });
    expect(result?.messages.map((message) => message.ruleId)).toContain(
      'fixed-width/destino-permitido',
    );
  });

  it('rechaza rutas con nombres de bancos reales (D-068)', async () => {
    expect(await ruleIds(importa('./bna/spec'), 'src/banks/fixed-width/ejemplo.ts')).toContain(
      'no-restricted-imports',
    );
    expect(
      await ruleIds(importa('../patagonia-b2/spec'), 'src/banks/fixed-width/ejemplo.ts'),
    ).toContain('fixed-width/destino-permitido');
    expect(
      await ruleIds(importa('./patagoniaB2/spec'), 'src/banks/fixed-width/ejemplo.ts'),
    ).toEqual([]);
  });

  it('la restricción no aplica a otros módulos de bancos', async () => {
    expect(await ruleIds(importa('../domain/cuil'), 'src/banks/otro-banco/ejemplo.ts')).toEqual([]);
  });
});

describe('dinero sin aritmética de number (src/domain/money.ts)', () => {
  it.each([
    ['Number()', "export const x = Number('1');"],
    ['parseInt', "export const x = parseInt('1', 10);"],
    ['Math', 'export const x = Math.round(1.5);'],
    ['Number.*', 'export const x = Number.isInteger(1);'],
    ['toFixed', 'const n = 1.23; export const x = n.toFixed(2);'],
  ])('rechaza %s', async (_name, code) => {
    expect(await ruleIds(code, 'src/domain/money.ts')).toContain('no-restricted-syntax');
  });

  it('acepta operaciones con bigint y strings', async () => {
    const code =
      "export const x = BigInt('125') + 1n;\nexport const y = String(x).padStart(3, '0');";
    expect(await ruleIds(code, 'src/domain/money.ts')).toEqual([]);
  });

  it('la restricción de number es exclusiva de money.ts', async () => {
    expect(await ruleIds("export const x = Number('7');", 'src/domain/cuil.ts')).toEqual([]);
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

  it('resuelve los límites de dominio, conciliación, parsers y dinero', async () => {
    const rulesFor = async (file: string) =>
      ((await realConfig.calculateConfigForFile(file)) as { rules: Record<string, unknown> }).rules;
    expect(
      JSON.stringify((await rulesFor('src/domain/cuil.ts'))['no-restricted-imports']),
    ).toContain('**/reconciliation');
    expect(
      JSON.stringify((await rulesFor('src/reconciliation/conciliar.ts'))['no-restricted-imports']),
    ).toContain('**/import');
    expect(
      JSON.stringify(
        (await rulesFor('src/import/finnegans/parseFinnegans.ts'))['no-restricted-imports'],
      ),
    ).toContain('(^|/)xlsx/.+');
    expect(
      JSON.stringify((await rulesFor('src/domain/money.ts'))['no-restricted-syntax']),
    ).toContain("callee.name='Number'");
  });
});
