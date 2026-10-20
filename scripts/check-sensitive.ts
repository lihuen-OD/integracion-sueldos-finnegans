// Uso:
//   node scripts/check-sensitive.ts --staged   (hook pre-commit: contenido en el índice)
//   node scripts/check-sensitive.ts --all      (archivos versionados y no ignorados)
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import {
  checkPath,
  formatFinding,
  isProbablyBinary,
  scanText,
  type Finding,
} from './lib/sensitive.ts';

const staged = process.argv.includes('--staged');

function git(args: string[]): Buffer {
  return execFileSync('git', args, { maxBuffer: 256 * 1024 * 1024 });
}

function listFiles(): string[] {
  const args = staged
    ? ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']
    : ['ls-files', '--cached', '--others', '--exclude-standard', '-z'];
  return git(args)
    .toString('utf8')
    .split('\0')
    .filter((path) => path.length > 0);
}

function readContent(path: string): Buffer | undefined {
  if (staged) {
    return git(['show', `:${path}`]);
  }
  return existsSync(path) ? readFileSync(path) : undefined;
}

const files = listFiles();
const findings: Finding[] = [];
for (const path of files) {
  findings.push(...checkPath(path));
  const content = readContent(path);
  if (content !== undefined && !isProbablyBinary(content)) {
    findings.push(...scanText(path, content.toString('utf8')));
  }
}

const scope = staged ? 'archivos en el índice' : 'archivos del repositorio';
if (findings.length > 0) {
  process.stderr.write(`check:sensitive: ${String(findings.length)} hallazgo(s) en ${scope}:\n`);
  for (const finding of findings) {
    process.stderr.write(`  ${formatFinding(finding)}\n`);
  }
  process.stderr.write('Revisar y quitar los datos antes de commitear.\n');
  process.exit(1);
}
process.stdout.write(`check:sensitive: sin hallazgos (${String(files.length)} ${scope}).\n`);
