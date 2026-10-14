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

const UI_SIN_BANCOS = {
  group: ['**/banks', '**/banks/**'],
  message: 'La UI no conoce posiciones ni construye TXT (D-027).',
};

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
      'no-restricted-imports': ['error', { patterns: [EXCELJS_FUERA_DEL_ADAPTADOR] }],
    },
  },
  {
    name: 'guardrails/ui',
    files: ['src/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [EXCELJS_FUERA_DEL_ADAPTADOR, UI_SIN_BANCOS] },
      ],
    },
  },
  {
    name: 'guardrails/adaptador-xlsx',
    files: ['src/import/xlsx/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
];
