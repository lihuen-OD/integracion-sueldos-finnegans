// Reglas de protección del proyecto (privacidad, offline, dinero y límites de capas).
// Se comparten entre eslint.config.js y tests/guardrails para que el test verifique
// exactamente las mismas reglas que se aplican al código.

const SIN_PERSISTENCIA = 'Prohibido: no se persisten datos sensibles (D-009).';
const SIN_RED = 'Prohibido: sin red en runtime (D-001).';
const SIN_FLOAT = 'Prohibido: los importes se manejan en centavos bigint (D-031).';

const restrictedGlobals = [
  { name: 'localStorage', message: SIN_PERSISTENCIA },
  { name: 'sessionStorage', message: SIN_PERSISTENCIA },
  { name: 'indexedDB', message: SIN_PERSISTENCIA },
  { name: 'caches', message: SIN_PERSISTENCIA },
  { name: 'fetch', message: SIN_RED },
  { name: 'XMLHttpRequest', message: SIN_RED },
  { name: 'WebSocket', message: SIN_RED },
  { name: 'EventSource', message: SIN_RED },
  { name: 'parseFloat', message: SIN_FLOAT },
];

const restrictedProperties = [
  { object: 'window', property: 'localStorage', message: SIN_PERSISTENCIA },
  { object: 'window', property: 'sessionStorage', message: SIN_PERSISTENCIA },
  { object: 'window', property: 'indexedDB', message: SIN_PERSISTENCIA },
  { object: 'globalThis', property: 'localStorage', message: SIN_PERSISTENCIA },
  { object: 'document', property: 'cookie', message: SIN_PERSISTENCIA },
  { object: 'navigator', property: 'serviceWorker', message: SIN_PERSISTENCIA },
  { object: 'window', property: 'fetch', message: SIN_RED },
  { object: 'globalThis', property: 'fetch', message: SIN_RED },
  { object: 'navigator', property: 'sendBeacon', message: SIN_RED },
  { object: 'Number', property: 'parseFloat', message: SIN_FLOAT },
];

const restrictedSyntax = [
  {
    selector: "CallExpression[callee.property.name='toFixed']",
    message: SIN_FLOAT,
  },
];

const EXCELJS_FUERA_DEL_ADAPTADOR = {
  group: ['exceljs', 'exceljs/*'],
  message: 'ExcelJS solo puede importarse desde src/import/xlsx/ (D-038).',
};

const ADAPTADOR_SOLO_POR_INDEX = {
  regex: '(^|/)xlsx/.+',
  message: 'Fuera del adaptador solo se usa su API pública, src/import/xlsx/index.ts (D-040).',
};

const UI_SIN_BANCOS = {
  group: ['**/banks', '**/banks/**'],
  message: 'La UI no conoce posiciones ni construye TXT (D-027).',
};

const REACT = ['react', 'react/**', 'react-dom', 'react-dom/**'];
const capas = (...nombres) => nombres.flatMap((nombre) => [`**/${nombre}`, `**/${nombre}/**`]);

const SHARED_SIN_CAPAS = {
  group: [...capas('domain', 'import', 'reconciliation', 'ui', 'banks', 'export'), ...REACT],
  message: 'src/shared/ no depende de ninguna otra capa (docs/02).',
};

const DOMINIO_PURO = {
  group: [...capas('import', 'reconciliation', 'ui', 'banks', 'export'), ...REACT],
  message:
    'El dominio es puro: no depende de importación, conciliación, UI, bancos ni React (docs/02).',
};

const CONCILIACION_SOLO_DOMINIO = {
  group: [...capas('import', 'ui', 'banks', 'export'), ...REACT],
  message: 'La conciliación solo depende del dominio: recibe filas ya interpretadas (docs/02).',
};

const PARSERS_SIN_CAPAS_SUPERIORES = {
  group: [...capas('reconciliation', 'ui', 'banks', 'export'), ...REACT],
  message: 'Los parsers no dependen de la conciliación, la UI, los bancos ni React (docs/02).',
};

// Frontera del motor fixed-width (T4-11): solo puede depender de sí mismo y de src/shared.
// Capas superiores, React y bancos hermanos prohibidos (imports relativos internos como
// './estructura' no contienen 'banks' y quedan permitidos; el hermano '../banks/<otro>/x'
// sí). No queda prohibido 'src/shared' ni el propio subárbol.
const FIXED_WIDTH_SIN_CAPAS = {
  group: [...capas('domain', 'import', 'reconciliation', 'ui', 'export'), ...REACT, '**/banks/**'],
  message: 'El motor fixed-width solo depende de src/shared y de sí mismo (T4-11, docs/02).',
};

// Whitelist arquitectónica (D-076): se bloquea TODO specifier que no sea un relativo
// interno del propio subárbol o una ruta relativa válida a src/shared. No es una
// blacklist de paquetes: cualquier bare package ('zod', 'lodash', '@scope/x') y
// cualquier ruta relativa que escape de la whitelist queda rechazado.
// Válidos: './estructura', './sub/x', '../fixed-width/x' y '../../shared/x'. Otras
// reglas de frontera pueden seguir restringiendo rutas equivalentes al propio subárbol.
const FIXED_WIDTH_SOLO_WHITELIST = {
  regex:
    '^(?!(?:\\./[^.]|\\.\\./(?:fixed-width|banks/fixed-width)/|\\.\\./\\.\\./(?:shared|banks/fixed-width)/))',
  message: 'El motor fixed-width solo depende de src/shared y de sí mismo (T4-11, docs/02).',
};

const FIXED_WIDTH_SIN_BANCOS_REALES = {
  regex: '(^|/)(patagonia|bna)(/|$)',
  caseSensitive: false,
  message: 'El motor genérico no conoce bancos: ni ids, nombres ni códigos (D-068).',
};

// Un hermano se importa como '../<otro>/x' (sin 'banks' en el specifier): se bloquea toda
// ruta de importación que SUBA dos niveles salvo la a '../shared'.
const FIXED_WIDTH_SIN_HERMANOS = {
  regex:
    '^\\.\\./\\.{2}/(?!(?:shared|banks/fixed-width)(/|$))|^\\.\\./(?!(?:shared|fixed-width|\\.{2})(/|$))',
  message: 'El motor fixed-width solo depende de src/shared y de sí mismo (T4-11, docs/02).',
};

const restringirImports = (...patterns) => ['error', { patterns }];

const SIN_NUMBER_EN_DINERO =
  'En money.ts no se usa aritmética de number: solo bigint y strings (D-031).';

/** @type {import('eslint').Linter.Config[]} */
export const guardrailConfigs = [
  {
    name: 'guardrails/src',
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-console': 'error',
      'no-restricted-globals': ['error', ...restrictedGlobals],
      'no-restricted-properties': ['error', ...restrictedProperties],
      'no-restricted-syntax': ['error', ...restrictedSyntax],
      'no-restricted-imports': restringirImports(
        EXCELJS_FUERA_DEL_ADAPTADOR,
        ADAPTADOR_SOLO_POR_INDEX,
      ),
    },
  },
  {
    name: 'guardrails/ui',
    files: ['src/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restringirImports(
        EXCELJS_FUERA_DEL_ADAPTADOR,
        ADAPTADOR_SOLO_POR_INDEX,
        UI_SIN_BANCOS,
      ),
    },
  },
  {
    name: 'guardrails/shared',
    files: ['src/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': restringirImports(EXCELJS_FUERA_DEL_ADAPTADOR, SHARED_SIN_CAPAS),
    },
  },
  {
    name: 'guardrails/domain',
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': restringirImports(EXCELJS_FUERA_DEL_ADAPTADOR, DOMINIO_PURO),
    },
  },
  {
    name: 'guardrails/dinero',
    files: ['src/domain/money.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...restrictedSyntax,
        { selector: "CallExpression[callee.name='Number']", message: SIN_NUMBER_EN_DINERO },
        { selector: "CallExpression[callee.name='parseInt']", message: SIN_NUMBER_EN_DINERO },
        { selector: "MemberExpression[object.name='Math']", message: SIN_NUMBER_EN_DINERO },
        { selector: "MemberExpression[object.name='Number']", message: SIN_NUMBER_EN_DINERO },
      ],
    },
  },
  {
    name: 'guardrails/reconciliation',
    files: ['src/reconciliation/**/*.ts'],
    rules: {
      'no-restricted-imports': restringirImports(
        EXCELJS_FUERA_DEL_ADAPTADOR,
        CONCILIACION_SOLO_DOMINIO,
      ),
    },
  },
  {
    name: 'guardrails/parsers',
    files: ['src/import/finnegans/**/*.ts', 'src/import/master/**/*.ts', 'src/import/*.ts'],
    rules: {
      'no-restricted-imports': restringirImports(
        EXCELJS_FUERA_DEL_ADAPTADOR,
        ADAPTADOR_SOLO_POR_INDEX,
        PARSERS_SIN_CAPAS_SUPERIORES,
      ),
    },
  },
  {
    name: 'guardrails/adaptador-xlsx',
    files: ['src/import/xlsx/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    name: 'guardrails/fixed-width',
    files: ['src/banks/fixed-width/**/*.ts'],
    rules: {
      'no-restricted-imports': restringirImports(
        EXCELJS_FUERA_DEL_ADAPTADOR,
        FIXED_WIDTH_SIN_CAPAS,
        FIXED_WIDTH_SIN_HERMANOS,
        FIXED_WIDTH_SIN_BANCOS_REALES,
        FIXED_WIDTH_SOLO_WHITELIST,
      ),
    },
  },
];
