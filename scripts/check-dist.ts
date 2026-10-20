// Verifica el build de producción (dist/):
// - CSP presente con connect-src 'none';
// - sin sourcemaps;
// - toda URL absoluta embebida pertenece a un host permitido y justificado.
// Una URL embebida no implica un pedido de red (la CSP los bloquea), pero cada
// host nuevo debe revisarse y justificarse aquí.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const DIST = 'dist';

/**
 * Hosts permitidos y por qué aparecen en el bundle. Revisado en el spike F1: ninguno
 * se usa como destino de red (el chunk XLSX no contiene XMLHttpRequest, Worker,
 * WebSocket, sendBeacon ni eval/new Function).
 */
const ALLOWED_HOSTS: Readonly<Record<string, string>> = {
  'react.dev': 'Enlaces en los mensajes de error minificados de React.',
  'tailwindcss.com': 'Comentario de licencia MIT en el CSS generado.',
  'www.w3.org': 'Namespaces XML/SVG/MathML (React DOM y ExcelJS).',
  'schemas.openxmlformats.org': 'Namespaces OOXML que ExcelJS escribe en el XLSX.',
  'schemas.microsoft.com': 'Namespaces de extensiones de Office que ExcelJS escribe en el XLSX.',
  'purl.org': 'Namespaces Dublin Core de docProps/core.xml (ExcelJS).',
  'github.com': 'Mensajes de error y licencias (ExcelJS, core-js, crypto-browserify).',
  'stuk.github.io': 'Mensaje de error de JSZip (zip inválido).',
  'rolldown.rs': 'Mensaje de error del runtime del bundler (require no disponible).',
};

const TEXT_EXTENSIONS = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.xml']);
const URL_PATTERN = /https?:\/\/[^\s"'`()<>\\]+/g;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const errors: string[] = [];
const hosts = new Map<string, number>();
const files = walk(DIST);

for (const file of files) {
  const rel = relative(DIST, file);
  if (rel.endsWith('.map')) {
    errors.push(`sourcemap no permitido: ${rel}`);
    continue;
  }
  if (!TEXT_EXTENSIONS.has(extname(file))) {
    continue;
  }
  const content = readFileSync(file, 'utf8');
  for (const match of content.matchAll(URL_PATTERN)) {
    let host: string;
    try {
      host = new URL(match[0]).host;
    } catch {
      host = '(URL inválida)';
    }
    hosts.set(host, (hosts.get(host) ?? 0) + 1);
  }
}

for (const host of hosts.keys()) {
  if (!(host in ALLOWED_HOSTS)) {
    errors.push(`host no permitido en el bundle: ${host}`);
  }
}

// Vite escapa las comillas del atributo (&#39;); el navegador las decodifica.
const indexHtml = readFileSync(join(DIST, 'index.html'), 'utf8')
  .replaceAll('&#39;', "'")
  .replaceAll('&quot;', '"');
if (
  !indexHtml.includes('http-equiv="Content-Security-Policy"') ||
  !indexHtml.includes("connect-src 'none'") ||
  indexHtml.includes('unsafe-eval')
) {
  errors.push("index.html sin CSP con connect-src 'none' (o con unsafe-eval)");
}

process.stdout.write(`check:dist: ${String(files.length)} archivos en ${DIST}/\n`);
for (const [host, count] of [...hosts].sort()) {
  process.stdout.write(
    `  ${host}: ${String(count)} ocurrencia(s) — ${ALLOWED_HOSTS[host] ?? 'NO PERMITIDO'}\n`,
  );
}
if (errors.length > 0) {
  for (const error of errors) {
    process.stderr.write(`  ERROR ${error}\n`);
  }
  process.exit(1);
}
process.stdout.write('check:dist: OK\n');
