// Vite carga el grafo TypeScript del harness sin abrir servidor HTTP/WebSocket.
// Este runner solo se invoca mediante el comando manual de package.json.
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

interface ModuloCliSintetica {
  readonly main: (argumentos: readonly string[]) => Promise<number>;
}

const rutaCli = fileURLToPath(new URL('./materializar-homologacion-sintetica.ts', import.meta.url));
const { module: modulo } = await runnerImport<ModuloCliSintetica>(rutaCli, { logLevel: 'error' });
process.exitCode = await modulo.main(process.argv.slice(2));
