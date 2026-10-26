// Reglas de protección del proyecto (privacidad, offline, dinero y límites de capas).
// Se comparten entre eslint.config.js y tests/guardrails para que el test verifique
// exactamente las mismas reglas que se aplican al código.

import path from 'node:path';

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
  group: [...capas('domain', 'import', 'reconciliation', 'ui', 'export'), ...REACT],
  message: 'El motor fixed-width solo depende de src/shared y de sí mismo (T4-11, docs/02).',
};

// Whitelist arquitectónica (D-076) dependiente del archivo origen: el destino se
// resuelve con path.resolve desde el archivo real y debe quedar dentro de
// src/banks/fixed-width/** o src/shared/**. No alcanza con mirar el texto del
// specifier: '../../shared/x' es válido desde la raíz del motor pero no desde un
// subdirectorio. Cualquier bare package, alias, ruta absoluta o traversal que
// salga de esos dos árboles se rechaza.
const MENSAJE_DESTINO_FIXED_WIDTH =
  'El motor fixed-width solo puede importar destinos dentro de src/banks/fixed-width o src/shared (D-076).';
const MARCADOR_FIXED_WIDTH = '/src/banks/fixed-width/';

const reglaDestinoFixedWidth = {
  meta: {
    type: 'problem',
    docs: { description: 'Limita los imports de fixed-width a su subárbol y src/shared.' },
    schema: [],
    messages: {
      destino: MENSAJE_DESTINO_FIXED_WIDTH,
      dinamico: 'El import dinámico en fixed-width exige un specifier literal verificable (D-076).',
    },
  },
  create(context) {
    const archivo = context.filename.split(path.sep).join('/');
    const indice = archivo.indexOf(MARCADOR_FIXED_WIDTH);
    if (indice === -1) {
      return {};
    }
    const raiz = archivo.slice(0, indice);
    const prefijoPropio = `${raiz}/src/banks/fixed-width/`;
    const prefijoShared = `${raiz}/src/shared/`;

    const verificar = (fuente) => {
      const specifier = fuente.value;
      if (typeof specifier !== 'string' || !specifier.startsWith('.')) {
        context.report({ node: fuente, messageId: 'destino' });
        return;
      }
      const destino = path.resolve(path.dirname(archivo), specifier).split(path.sep).join('/');
      if (!destino.startsWith(prefijoPropio) && !destino.startsWith(prefijoShared)) {
        context.report({ node: fuente, messageId: 'destino' });
      }
    };

    return {
      ImportDeclaration: (nodo) => verificar(nodo.source),
      ExportNamedDeclaration: (nodo) => {
        if (nodo.source) {
          verificar(nodo.source);
        }
      },
      ExportAllDeclaration: (nodo) => verificar(nodo.source),
      ImportExpression: (nodo) => {
        if (nodo.source.type === 'Literal' && typeof nodo.source.value === 'string') {
          verificar(nodo.source);
        } else {
          context.report({ node: nodo, messageId: 'dinamico' });
        }
      },
    };
  },
};

const MENSAJE_SIN_CONOCIMIENTO_BANCARIO =
  'El motor fixed-width no admite conocimiento bancario: BNA, PATAGONIA, SUE, 034 ni Destino (D-068).';
const TOKENS_BANCARIOS = new Set(['sue', '034', 'destino']);

function tokensDeTexto(texto) {
  return texto
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])([0-9])/g, '$1 $2')
    .replace(/([0-9])([A-Za-z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((token) => token.toLowerCase());
}

function esTokenBancario(token) {
  return TOKENS_BANCARIOS.has(token) || token.startsWith('bna') || token.startsWith('patagonia');
}

function tieneConocimientoBancario(texto) {
  return tokensDeTexto(texto).some(esTokenBancario);
}

const reglaSinConocimientoBancario = {
  meta: {
    type: 'problem',
    docs: { description: 'Impide tokens bancarios dentro del motor fixed-width (D-068).' },
    schema: [],
    messages: { bancario: MENSAJE_SIN_CONOCIMIENTO_BANCARIO },
  },
  create(context) {
    const revisar = (nodo, texto) => {
      if (tieneConocimientoBancario(texto)) {
        context.report({ node: nodo, messageId: 'bancario' });
      }
    };
    return {
      Identifier: (nodo) => revisar(nodo, nodo.name),
      Literal: (nodo) => {
        if (typeof nodo.value === 'string') {
          revisar(nodo, nodo.value);
        }
      },
      TemplateElement: (nodo) => revisar(nodo, nodo.value.raw),
    };
  },
};

const pluginFixedWidth = {
  rules: {
    'destino-permitido': reglaDestinoFixedWidth,
    'sin-conocimiento-bancario': reglaSinConocimientoBancario,
  },
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
    plugins: { 'fixed-width': pluginFixedWidth },
    rules: {
      'fixed-width/destino-permitido': 'error',
      'fixed-width/sin-conocimiento-bancario': 'error',
      'no-restricted-imports': restringirImports(
        EXCELJS_FUERA_DEL_ADAPTADOR,
        FIXED_WIDTH_SIN_CAPAS,
      ),
    },
  },
];
