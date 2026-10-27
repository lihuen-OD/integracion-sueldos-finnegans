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
    ['src/domain/ejemplo.ts', '../run/generacionBna'],
    ['src/domain/ejemplo.ts', 'react'],
    ['src/shared/ejemplo.ts', '../domain/cuil'],
    ['src/shared/ejemplo.ts', '../import/xlsx'],
    ['src/shared/ejemplo.ts', '../run/generacionBna'],
    ['src/reconciliation/ejemplo.ts', '../import/finnegans/parseFinnegans'],
    ['src/reconciliation/ejemplo.ts', '../import/xlsx'],
    ['src/reconciliation/ejemplo.ts', '../ui/App'],
    ['src/reconciliation/ejemplo.ts', '../run/generacionBna'],
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
    ['la capa run', '../../run/generacionBna'],
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

  it('rechaza conocimiento bancario en imports del motor (D-068)', async () => {
    for (const source of [
      './bna/spec',
      './patagoniaB2/spec',
      './patagonia-b2/spec',
      './bnaGt/spec',
      './bna-gt-haberes/spec',
      './SUE/spec',
      './034/spec',
      './Destino/spec',
    ]) {
      expect(await ruleIds(importa(source), 'src/banks/fixed-width/ejemplo.ts')).toContain(
        'fixed-width/sin-conocimiento-bancario',
      );
    }
  });

  it('rechaza tokens bancarios en identifiers, strings y templates (D-068)', async () => {
    const casos = [
      'const bnaGt = 1;\nexport { bnaGt };',
      "const x = 'patagonia-b2';\nexport { x };",
      'const x = `034`;\nexport { x };',
      'const destino = 1;\nexport { destino };',
    ];
    for (const code of casos) {
      expect(await ruleIds(code, 'src/banks/fixed-width/ejemplo.ts')).toContain(
        'fixed-width/sin-conocimiento-bancario',
      );
    }
  });

  it('mantiene permitidos los ids sintéticos neutrales (H, D, C, I, R0)', async () => {
    const code =
      'const H = 1;\nconst D = 2;\nconst C = 3;\nconst I = 4;\nconst R0 = 5;\nexport { H, D, C, I, R0 };';
    expect(await ruleIds(code, 'src/banks/fixed-width/ejemplo.ts')).toEqual([]);
  });

  it('rechaza import(variable) porque el destino no es verificable', async () => {
    const code = "const ruta = './estructura';\nexport const modulo = import(ruta);";
    expect(await ruleIds(code, 'src/banks/fixed-width/ejemplo.ts')).toContain(
      'fixed-width/destino-permitido',
    );
  });

  it('valida import(literal) con el mismo destino que un import estático', async () => {
    const propio = "export const modulo = import('./estructura');";
    expect(await ruleIds(propio, 'src/banks/fixed-width/ejemplo.ts')).toEqual([]);
    const fuera = "export const modulo = import('../../otro/x');";
    expect(await ruleIds(fuera, 'src/banks/fixed-width/ejemplo.ts')).toContain(
      'fixed-width/destino-permitido',
    );
  });

  it('la restricción no aplica a otros módulos de bancos', async () => {
    expect(await ruleIds(importa('../domain/cuil'), 'src/banks/otro-banco/ejemplo.ts')).toEqual([]);
  });
});

describe('frontera de la capa bancaria BNA (F5)', () => {
  const importa = (source: string) => `import { x } from '${source}';\nexport { x };`;

  it.each([
    ['internals de fixed-width (serializer)', '../fixed-width/serializer'],
    ['internals de fixed-width (estructura)', '../fixed-width/estructura'],
    ['la UI', '../../ui/App'],
    ['la importación', '../../import/finnegans/parseFinnegans'],
    ['la conciliación', '../../reconciliation/conciliar'],
    ['la exportación', '../../export/archivos'],
    ['la fachada run', '../../run/generacionBna'],
    ['Patagonia', '../patagonia-b2/spec'],
    ['Patagonia (otra ruta)', '../patagoniaB2/spec'],
    ['React', 'react'],
    ['React DOM', 'react-dom'],
    ['ExcelJS', 'exceljs'],
    ['un paquete npm arbitrario (zod)', 'zod'],
    ['otro paquete npm arbitrario (lodash)', 'lodash'],
    ['un builtin de Node', 'node:fs'],
    ['un alias no autorizado', '@/domain/cuil'],
    ['una ruta absoluta', '/etc/passwd'],
    ['traversal hacia otro destino', '../../domain/../ui/App'],
    ['traversal desde un subdirectorio', './sub/../../../ui/App'],
    ['traversal tras shared', '../../shared/../ui/App'],
  ])('rechaza que BNA importe %s', async (_caso, source) => {
    expect(await ruleIds(importa(source), 'src/banks/bna/ejemplo.ts')).toContain(
      'bna/destino-permitido',
    );
  });

  it.each([
    ['la API pública de fixed-width', '../fixed-width'],
    ['la API pública de fixed-width (index)', '../fixed-width/index'],
    ['la API pública de fixed-width (index.ts)', '../fixed-width/index.ts'],
    ['la trazabilidad bancaria', '../trazabilidad'],
    ['la trazabilidad bancaria (archivo)', '../trazabilidad.ts'],
    ['el dominio', '../../domain/cuil'],
    ['el dominio (raíz)', '../../domain'],
    ['shared', '../../shared/result'],
    ['shared (raíz)', '../../shared'],
    ['su propio subárbol', './spec'],
    ['otra ruta interna propia', './sub/spec'],
  ])('permite que BNA importe %s', async (_caso, source) => {
    expect(await ruleIds(importa(source), 'src/banks/bna/ejemplo.ts')).toEqual([]);
  });

  it('rechaza import(variable) porque el destino no es verificable', async () => {
    const code = "const ruta = '../fixed-width';\nexport const modulo = import(ruta);";
    expect(await ruleIds(code, 'src/banks/bna/ejemplo.ts')).toContain('bna/destino-permitido');
  });

  it('valida import(literal) con el mismo destino que un import estático', async () => {
    const permitido = "export const modulo = import('../fixed-width');";
    expect(await ruleIds(permitido, 'src/banks/bna/ejemplo.ts')).toEqual([]);
    const prohibido = "export const modulo = import('../patagonia-b2/spec');";
    expect(await ruleIds(prohibido, 'src/banks/bna/ejemplo.ts')).toContain('bna/destino-permitido');
  });

  it('la whitelist real de eslint.config.js rechaza internals y bare packages', async () => {
    const realConfig = new ESLint();
    for (const source of ['../fixed-width/serializer', 'zod']) {
      // Archivo real del proyecto: el parser tipado exige pertenencia al tsconfig.
      const [result] = await realConfig.lintText(importa(source), {
        filePath: 'src/banks/bna/spec.ts',
      });
      expect(result?.messages.map((message) => message.ruleId)).toContain('bna/destino-permitido');
    }
  });

  it('la restricción no aplica a otros módulos de bancos', async () => {
    expect(await ruleIds(importa('../../ui/App'), 'src/banks/otro-banco/ejemplo.ts')).toEqual([]);
  });
});

describe('frontera de la capa Patagonia B.2 (F6)', () => {
  const importa = (source: string) => `import { x } from '${source}';\nexport { x };`;

  it.each([
    ['BNA (API pública)', '../bna'],
    ['BNA (spec)', '../bna/spec'],
    ['traversal hacia BNA', '../patagonia-b2/../bna/spec'],
    ['traversal desde subdirectorio hacia BNA', './sub/../../../banks/bna/spec'],
    ['traversal desde shared hacia BNA', '../../shared/../banks/bna/spec'],
    ['internals de fixed-width (serializer)', '../fixed-width/serializer'],
    ['internals de fixed-width (estructura)', '../fixed-width/estructura'],
    ['la UI', '../../ui/App'],
    ['la importación Finnegans', '../../import/finnegans/parseFinnegans'],
    ['la importación XLSX', '../../import/xlsx'],
    ['la conciliación', '../../reconciliation/conciliar'],
    ['la exportación', '../../export/archivos'],
    ['la fachada run', '../../run/generacionBna'],
    ['React', 'react'],
    ['React DOM', 'react-dom'],
    ['ExcelJS', 'exceljs'],
    ['un paquete npm arbitrario (zod)', 'zod'],
    ['otro paquete npm arbitrario (lodash)', 'lodash'],
    ['un builtin de Node', 'node:fs'],
    ['un alias no autorizado', '@/domain/cuil'],
    ['una ruta absoluta', '/etc/passwd'],
    ['traversal hacia otro destino', '../../domain/../ui/App'],
    ['traversal desde un subdirectorio', './sub/../../../ui/App'],
    ['traversal tras shared', '../../shared/../ui/App'],
  ])('rechaza que Patagonia importe %s', async (_caso, source) => {
    expect(await ruleIds(importa(source), 'src/banks/patagonia-b2/spec.ts')).toContain(
      'patagonia/destino-permitido',
    );
  });

  it.each([
    ['la API pública de fixed-width', '../fixed-width'],
    ['la API pública de fixed-width (index)', '../fixed-width/index'],
    ['la API pública de fixed-width (index.ts)', '../fixed-width/index.ts'],
    ['la trazabilidad bancaria', '../trazabilidad'],
    ['la trazabilidad bancaria (archivo)', '../trazabilidad.ts'],
    ['el dominio', '../../domain/cuil'],
    ['el dominio (raíz)', '../../domain'],
    ['shared', '../../shared/result'],
    ['shared (raíz)', '../../shared'],
    ['su propio subárbol', './spec'],
    ['otra ruta interna propia', './sub/spec'],
  ])('permite que Patagonia importe %s', async (_caso, source) => {
    expect(await ruleIds(importa(source), 'src/banks/patagonia-b2/spec.ts')).toEqual([]);
  });

  it('rechaza import(variable) porque el destino no es verificable', async () => {
    const code = "const ruta = '../fixed-width';\nexport const modulo = import(ruta);";
    expect(await ruleIds(code, 'src/banks/patagonia-b2/spec.ts')).toContain(
      'patagonia/destino-permitido',
    );
  });

  it('valida import(literal) con el mismo destino que un import estático', async () => {
    const permitido = "export const modulo = import('../fixed-width');";
    expect(await ruleIds(permitido, 'src/banks/patagonia-b2/spec.ts')).toEqual([]);
    const prohibido = "export const modulo = import('../bna/spec');";
    expect(await ruleIds(prohibido, 'src/banks/patagonia-b2/spec.ts')).toContain(
      'patagonia/destino-permitido',
    );
  });

  it('la whitelist real de eslint.config.js rechaza BNA, internals y bare packages', async () => {
    const realConfig = new ESLint();
    for (const source of ['../bna/spec', '../fixed-width/serializer', 'zod']) {
      const [result] = await realConfig.lintText(importa(source), {
        filePath: 'src/banks/patagonia-b2/spec.ts',
      });
      expect(result?.messages.map((message) => message.ruleId)).toContain(
        'patagonia/destino-permitido',
      );
    }
  });

  it('BNA sigue sin poder importar Patagonia', async () => {
    expect(await ruleIds(importa('../patagonia-b2/spec'), 'src/banks/bna/ejemplo.ts')).toContain(
      'bna/destino-permitido',
    );
  });

  it('fixed-width sigue sin poder importar bancos', async () => {
    expect(
      await ruleIds(importa('../../banks/patagonia-b2/spec'), 'src/banks/fixed-width/ejemplo.ts'),
    ).toContain('fixed-width/destino-permitido');
  });

  it('la restricción no aplica a otros módulos de bancos', async () => {
    expect(await ruleIds(importa('../../ui/App'), 'src/banks/otro-banco/ejemplo.ts')).toEqual([]);
  });
});

describe('frontera de la capa run (F5)', () => {
  const importa = (source: string) => `import { x } from '${source}';\nexport { x };`;

  it.each([
    ['internals de fixed-width (serializer)', '../banks/fixed-width/serializer'],
    ['la API pública de fixed-width', '../banks/fixed-width'],
    ['internals de BNA (modelo)', '../banks/bna/modelo'],
    ['internals de BNA (spec)', '../banks/bna/spec'],
    ['internals de BNA (mapeo)', '../banks/bna/mapeo'],
    ['internals de BNA (política)', '../banks/bna/politica'],
    ['internals de BNA (serialización)', '../banks/bna/serializacion'],
    ['internals de BNA (inspección)', '../banks/bna/inspeccion'],
    ['traversal que normaliza a un internal BNA', '../banks/bna/../bna/modelo'],
    ['traversal desde subdirectorio a un internal BNA', './sub/../../../banks/bna/modelo'],
    ['traversal que sale de index.ts a un internal BNA', '../banks/bna/index.ts/../modelo'],
    ['internals de Patagonia (spec)', '../banks/patagonia-b2/spec'],
    ['internals de Patagonia (mapeo)', '../banks/patagonia-b2/mapeo'],
    ['internals de Patagonia (serialización)', '../banks/patagonia-b2/serializacion'],
    ['internals de Patagonia (inspección)', '../banks/patagonia-b2/inspeccion'],
    [
      'traversal que normaliza a un internal Patagonia',
      '../banks/patagonia-b2/../patagonia-b2/spec',
    ],
    [
      'traversal desde subdirectorio a un internal Patagonia',
      './sub/../../../banks/patagonia-b2/mapeo',
    ],
    [
      'traversal que sale de index.ts a un internal Patagonia',
      '../banks/patagonia-b2/index.ts/../spec',
    ],
    ['la UI', '../ui/App'],
    ['la exportación', '../export/archivos'],
    ['la importación XLSX', '../import/xlsx'],
    ['la importación Finnegans', '../import/finnegans/parseFinnegans'],
    ['React', 'react'],
    ['React DOM', 'react-dom'],
    ['ExcelJS', 'exceljs'],
    ['un paquete npm arbitrario (zod)', 'zod'],
    ['un builtin de Node', 'node:fs'],
    ['un alias no autorizado', '@/domain/cuil'],
    ['una ruta absoluta', '/etc/passwd'],
    ['traversal hacia otro destino', '../domain/../ui/App'],
    ['traversal desde un subdirectorio', './sub/../../../ui/App'],
  ])('rechaza que run importe %s', async (_caso, source) => {
    expect(await ruleIds(importa(source), 'src/run/generacionBna.ts')).toContain(
      'run/destino-permitido',
    );
  });

  it.each([
    ['su propio subárbol', './corrida'],
    ['el perfil', '../profile'],
    ['la conciliación', '../reconciliation'],
    ['la API pública de BNA', '../banks/bna'],
    ['la API pública de BNA (index)', '../banks/bna/index'],
    ['la API pública de BNA (index.ts)', '../banks/bna/index.ts'],
    ['la API pública de Patagonia', '../banks/patagonia-b2'],
    ['la API pública de Patagonia (index)', '../banks/patagonia-b2/index'],
    ['la API pública de Patagonia (index.ts)', '../banks/patagonia-b2/index.ts'],
    ['la huella del maestro usada por revisión', '../import/huella'],
    ['el dominio', '../domain/cuil'],
    ['el dominio (raíz)', '../domain'],
    ['shared', '../shared/result'],
    ['shared (raíz)', '../shared'],
  ])('permite que run importe %s', async (_caso, source) => {
    expect(await ruleIds(importa(source), 'src/run/generacionBna.ts')).toEqual([]);
  });

  it('rechaza import(variable) porque el destino no es verificable', async () => {
    const code = "const ruta = '../banks/fixed-width';\nexport const modulo = import(ruta);";
    expect(await ruleIds(code, 'src/run/generacionBna.ts')).toContain('run/destino-permitido');
  });

  it('valida import(literal) con el mismo destino que un import estático', async () => {
    const permitido = "export const modulo = import('../domain/cuil');";
    expect(await ruleIds(permitido, 'src/run/generacionBna.ts')).toEqual([]);
    const prohibido = "export const modulo = import('../banks/fixed-width');";
    expect(await ruleIds(prohibido, 'src/run/generacionBna.ts')).toContain('run/destino-permitido');
  });

  it('la whitelist real de eslint.config.js rechaza internals de BNA, Patagonia, fixed-width y bare packages', async () => {
    const realConfig = new ESLint();
    for (const source of [
      '../banks/fixed-width/serializer',
      '../banks/bna/modelo',
      '../banks/bna/spec',
      '../banks/patagonia-b2/spec',
      '../banks/patagonia-b2/serializacion',
      'zod',
    ]) {
      const [result] = await realConfig.lintText(importa(source), {
        filePath: 'src/run/generacionPatagonia.ts',
      });
      expect(result?.messages.map((message) => message.ruleId)).toContain('run/destino-permitido');
    }
  });

  it('la whitelist real acepta solo las APIs públicas de BNA y Patagonia desde run', async () => {
    const realConfig = new ESLint();
    for (const source of [
      '../banks/bna',
      '../banks/bna/index',
      '../banks/bna/index.ts',
      '../banks/patagonia-b2',
      '../banks/patagonia-b2/index',
      '../banks/patagonia-b2/index.ts',
    ]) {
      const [result] = await realConfig.lintText(importa(source), {
        filePath: 'src/run/generacionPatagonia.ts',
      });
      expect(result?.messages.map((message) => message.ruleId)).not.toContain(
        'run/destino-permitido',
      );
    }
  });

  it('la restricción no aplica a otros módulos fuera de run', async () => {
    expect(await ruleIds(importa('../banks/fixed-width'), 'src/profile/ejemplo.ts')).toEqual([]);
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
