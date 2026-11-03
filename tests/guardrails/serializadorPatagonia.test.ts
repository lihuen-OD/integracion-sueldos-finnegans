// Guardrail CP-F7-C2.1: el serializador Patagonia es de bajo nivel y no contiene la
// compuerta productiva. Solo la fachada controlada puede importarlo desde `src/`.
// Detecta imports estáticos con nombre `serializarPatagonia`, incluidos los alias.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ScriptTarget,
  createSourceFile,
  isImportDeclaration,
  isNamedImports,
  isNamespaceImport,
  isStringLiteral,
} from 'typescript';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = join(RAIZ, 'src');
const FACHADA = join(SRC, 'run', 'generacionPatagonia.ts');

function archivosTs(directorio: string): string[] {
  return readdirSync(directorio, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(directorio, entrada.name);
    if (entrada.isDirectory()) {
      return archivosTs(ruta);
    }
    return /\.(ts|tsx)$/.test(entrada.name) ? [ruta] : [];
  });
}

function esModuloPatagonia(archivo: string, especificador: string): boolean {
  if (!especificador.startsWith('.')) {
    return false;
  }
  const destino = resolve(dirname(archivo), especificador).split('\\').join('/');
  return (
    destino.endsWith('/src/banks/patagonia-b2') ||
    destino.endsWith('/src/banks/patagonia-b2/serializacion')
  );
}

export function importaSerializador(texto: string, archivo: string): boolean {
  const fuente = createSourceFile(archivo, texto, ScriptTarget.Latest, true);
  for (const declaracion of fuente.statements) {
    if (!isImportDeclaration(declaracion)) {
      continue;
    }
    if (!isStringLiteral(declaracion.moduleSpecifier)) {
      continue;
    }
    if (!esModuloPatagonia(archivo, declaracion.moduleSpecifier.text)) {
      continue;
    }
    const enlace = declaracion.importClause?.namedBindings;
    if (enlace === undefined) {
      continue;
    }
    // Un namespace import también puede alcanzar el serializador
    // (`patagonia.serializarPatagonia(...)`): se trata como no autorizado fuera
    // de la fachada.
    if (isNamespaceImport(enlace)) {
      return true;
    }
    if (!isNamedImports(enlace)) {
      continue;
    }
    if (
      enlace.elements.some(
        (elemento) => (elemento.propertyName ?? elemento.name).text === 'serializarPatagonia',
      )
    ) {
      return true;
    }
  }
  return false;
}

describe('serializador Patagonia de bajo nivel', () => {
  it('solo la fachada productiva lo importa desde src/', () => {
    const importadores = archivosTs(SRC).filter((archivo) =>
      importaSerializador(readFileSync(archivo, 'utf8'), archivo),
    );

    expect(importadores).toContain(FACHADA);
    expect(importadores.map((archivo) => relative(RAIZ, archivo))).toEqual([
      'src/run/generacionPatagonia.ts',
    ]);
  });

  it('detecta una importación no autorizada (caso sintético)', () => {
    const codigo =
      "import { serializarPatagonia } from '../banks/patagonia-b2';\nexport { serializarPatagonia };";

    expect(importaSerializador(codigo, join(SRC, 'ui', 'Ejemplo.tsx'))).toBe(true);
    expect(importaSerializador(codigo, join(SRC, 'run', 'otraFachada.ts'))).toBe(true);
    expect(
      importaSerializador(
        "import { serializarPatagonia as serializar } from '../banks/patagonia-b2/serializacion';",
        join(SRC, 'export', 'descarga.ts'),
      ),
    ).toBe(true);
    expect(
      importaSerializador(
        "import { inspeccionarPatagonia } from '../banks/patagonia-b2';",
        join(SRC, 'ui', 'Ejemplo.tsx'),
      ),
    ).toBe(false);
    expect(
      importaSerializador(
        "import * as patagonia from '../banks/patagonia-b2';",
        join(SRC, 'run', 'otraFachada.ts'),
      ),
    ).toBe(true);
  });
});
