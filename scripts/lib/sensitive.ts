// Detección de datos sensibles antes de versionar (herramienta de desarrollo).
// Es deliberadamente conservadora: marca cualquier secuencia con forma de CUIL/CUIT
// o de CBU, sin validar dígitos verificadores. Nunca devuelve el valor detectado.

export interface Finding {
  readonly path: string;
  readonly line?: number;
  readonly rule: string;
  readonly detail: string;
}

/** Carpeta donde viven los datos sintéticos permitidos (fixtures de prueba). */
const SYNTHETIC_PREFIX = 'tests/fixtures/synthetic/';

const DATA_EXTENSIONS = new Set(['.xlsx', '.xls', '.xlsm', '.ods', '.csv', '.pdf', '.txt']);
const ALLOWED_DATA_FILES = new Set(['references/LEEME.txt']);

const CONTENT_RULES: readonly { rule: string; pattern: RegExp; detail: string }[] = [
  {
    rule: 'POSIBLE_CUIL',
    // 11 dígitos con prefijo de CUIL/CUIT, con o sin guiones.
    pattern: /(?<![\d-])(?:20|23|24|27|30|33|34)-?\d{8}-?\d(?![\d-])/,
    detail: 'secuencia con forma de CUIL/CUIT (valor omitido)',
  },
  {
    rule: 'POSIBLE_CBU',
    pattern: /(?<!\d)\d{22}(?!\d)/,
    detail: 'secuencia de 22 dígitos con forma de CBU (valor omitido)',
  },
  {
    rule: 'POSIBLE_CBU',
    pattern: /(?<!\d)\d{8}[-\s]\d{14}(?!\d)/,
    detail: 'CBU en bloques 8 + 14 (valor omitido)',
  },
];

function normalize(path: string): string {
  return path.replaceAll('\\', '/');
}

function extensionOf(path: string): string {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  return dot <= 0 ? '' : name.slice(dot).toLowerCase();
}

/** Reglas sobre la ruta del archivo (independientes del contenido). */
export function checkPath(rawPath: string): Finding[] {
  const path = normalize(rawPath);
  const findings: Finding[] = [];
  const name = path.slice(path.lastIndexOf('/') + 1);

  if (path.startsWith('references/') && !ALLOWED_DATA_FILES.has(path)) {
    findings.push({ path, rule: 'RUTA_REFERENCES', detail: 'references/ no se versiona' });
  }
  if (
    DATA_EXTENSIONS.has(extensionOf(path)) &&
    !ALLOWED_DATA_FILES.has(path) &&
    !path.startsWith(SYNTHETIC_PREFIX)
  ) {
    findings.push({
      path,
      rule: 'ARCHIVO_DE_DATOS',
      detail: `extensión ${extensionOf(path)} fuera de ${SYNTHETIC_PREFIX}`,
    });
  }
  if (/^MAESTRO_/i.test(name) || /^PERFIL_EMPRESA/i.test(name) || /\.perfil\.json$/i.test(name)) {
    findings.push({ path, rule: 'ARCHIVO_OPERATIVO', detail: 'maestro o perfil de empresa' });
  }
  return findings;
}

/**
 * Reglas sobre el contenido de texto, en todo el repositorio. Los fixtures sintéticos no
 * están exceptuados: sus valores con forma de CUIL/CBU se generan en tiempo de ejecución
 * y nunca se escriben como literales (D-042).
 */
export function scanText(rawPath: string, content: string): Finding[] {
  const path = normalize(rawPath);
  const findings: Finding[] = [];
  content.split(/\r?\n/).forEach((text, index) => {
    for (const { rule, pattern, detail } of CONTENT_RULES) {
      if (pattern.test(text)) {
        findings.push({ path, line: index + 1, rule, detail });
      }
    }
  });
  return findings;
}

/** Heurística estándar: un byte NUL en los primeros 8 KB indica contenido binario. */
export function isProbablyBinary(bytes: Uint8Array): boolean {
  return bytes.subarray(0, 8192).includes(0);
}

export function formatFinding(finding: Finding): string {
  const location =
    finding.line === undefined ? finding.path : `${finding.path}:${String(finding.line)}`;
  return `${location}  [${finding.rule}] ${finding.detail}`;
}
