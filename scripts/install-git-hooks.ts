// Ejecutado por `npm install` (script "prepare"): activa los hooks versionados en .githooks/.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

if (existsSync('.git')) {
  execFileSync('git', ['config', 'core.hooksPath', '.githooks']);
}
