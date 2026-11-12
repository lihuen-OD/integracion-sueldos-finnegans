import { createHash } from 'node:crypto';
import {
  lstat,
  mkdtemp,
  mkdir,
  readFile,
  realpath,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { join, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ADVERTENCIA_ARCHIVO_SINTETICO,
  NOMBRE_ARCHIVO_BNA_SINTETICO,
  NOMBRE_ARCHIVO_PATAGONIA_SINTETICO,
  formatearVistaPrevia,
  materializarPlanSintetico,
  prepararMaterializacionSintetica,
  type PlanMaterializacionSintetica,
} from '../../scripts/lib/materializacionHomologacionSintetica.ts';
import { parsearArgumentosCli } from '../../scripts/materializar-homologacion-sintetica.ts';
import { scanText } from '../../scripts/lib/sensitive.ts';
import {
  componerBnaHomologacionSintetica,
  componerPatagoniaHomologacionSintetica,
} from '../../src/run/composicionHomologacionSintetica.ts';

let raizTemporal = '';
let directorioPermitido = '';

async function existe(ruta: string): Promise<boolean> {
  try {
    await lstat(ruta);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

function planPreparado(banco: 'BNA' | 'PATAGONIA' = 'BNA'): PlanMaterializacionSintetica {
  const preparacion = prepararMaterializacionSintetica(banco, 'VALIDA');
  if (preparacion.estado !== 'PREPARADA') {
    throw new Error(`plan sintético no preparado: ${preparacion.codigo}`);
  }
  return preparacion.plan;
}

function hash(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

beforeEach(async () => {
  const temporalReal = await realpath(tmpdir());
  raizTemporal = await mkdtemp(join(temporalReal, 'cp-f7-d1-b-'));
  directorioPermitido = join(raizTemporal, 'homologacion-sintetica');
});

afterEach(async () => {
  if (raizTemporal !== '') {
    await rm(raizTemporal, { recursive: true, force: true });
  }
});

describe('CP-F7-D1-B · preparación y confirmación humana', () => {
  it.each([
    ['BNA', '87d55ec2bdcec1f8ecd22103c95ce78c7d36720ee26db9ef9ea15b6e2011d123', 4 * 200 + 4 * 2],
    ['PATAGONIA', '004140b216b76fc56b7a08ac3edde1524df8e7dd8f860ed7fbabed0ddd671a4d', 4 * 200 + 3],
  ] as const)(
    'conserva identidad byte a byte entre el compositor, D1-A y D1-B: %s',
    (banco, sha, cantidadBytes) => {
      const composicion =
        banco === 'BNA'
          ? componerBnaHomologacionSintetica('VALIDA')
          : componerPatagoniaHomologacionSintetica('VALIDA');
      const plan = planPreparado(banco);
      expect(composicion.estado).toBe('COMPUESTA_EN_MEMORIA');
      if (composicion.estado !== 'COMPUESTA_EN_MEMORIA') return;
      expect(plan.bytes).toEqual(composicion.bytes);
      expect(plan.cantidadBytes).toBe(cantidadBytes);
      expect(plan.sha256Preparado).toBe(sha);
      expect(hash(composicion.bytes)).toBe(sha);
    },
  );

  it.each([
    ['BNA', NOMBRE_ARCHIVO_BNA_SINTETICO],
    ['PATAGONIA', NOMBRE_ARCHIVO_PATAGONIA_SINTETICO],
  ] as const)(
    'muestra banco, variante, nombre, tamaño, hash, inspección y advertencia: %s',
    (banco, nombre) => {
      const plan = planPreparado(banco);
      const vista = formatearVistaPrevia(plan);

      expect(plan.nombreArchivo).toBe(nombre);
      expect(plan.nombreArchivo).toMatch(/\.TXT$/);
      expect(plan.cantidadBytes).toBeGreaterThan(0);
      expect(plan.sha256Preparado).toMatch(/^[a-f0-9]{64}$/);
      expect(plan.inspeccion.estado).toBe('OK');
      expect(plan.inspeccion.cantidadPagos).toBe(2);
      expect(vista).toContain(ADVERTENCIA_ARCHIVO_SINTETICO);
      expect(vista).toContain(`Banco: ${banco}`);
      expect(vista).toContain('Variante sintética: VALIDA');
      expect(vista).toContain(`Nombre: ${nombre}`);
      expect(vista).toContain(`Bytes: ${String(plan.cantidadBytes)}`);
      expect(vista).toContain(`SHA-256: ${plan.sha256Preparado}`);
      expect(vista).toContain('Inspección: OK');
    },
  );

  it('cancela sin crear siquiera el directorio cuando la frase no coincide', async () => {
    const plan = planPreparado();
    const resultado = await materializarPlanSintetico(plan, 'NO CONFIRMO', directorioPermitido);

    expect(resultado).toEqual({ estado: 'CANCELADA', motivo: 'CONFIRMACION_NO_COINCIDE' });
    expect(await existe(directorioPermitido)).toBe(false);
  });

  it('el parser exige banco y variante explícitos y rechaza argumentos extra', () => {
    expect(parsearArgumentosCli(['--banco', 'BNA', '--variante', 'VALIDA'])).toEqual({
      ok: true,
      value: { banco: 'BNA', variante: 'VALIDA' },
    });
    expect(parsearArgumentosCli(['--banco', 'PATAGONIA', '--variante', 'VALIDA']).ok).toBe(true);
    expect(parsearArgumentosCli(['--banco', 'BNA']).ok).toBe(false);
    expect(parsearArgumentosCli(['--banco', 'OTRO', '--variante', 'VALIDA']).ok).toBe(false);
    expect(
      parsearArgumentosCli(['--banco', 'BNA', '--variante', 'VALIDA', '--salida', '/tmp']).ok,
    ).toBe(false);
  });

  it('rechaza bancos, variantes y variantes negativas que D1-A no compone', () => {
    expect(prepararMaterializacionSintetica('OTRO', 'VALIDA')).toMatchObject({
      estado: 'RECHAZADA',
      codigo: 'BANCO_NO_ADMITIDO',
    });
    expect(prepararMaterializacionSintetica('BNA', 'NO_EXISTE')).toMatchObject({
      estado: 'RECHAZADA',
      codigo: 'VARIANTE_NO_ADMITIDA',
    });
    expect(prepararMaterializacionSintetica('PATAGONIA', 'HUELLA_VENCIDA')).toMatchObject({
      estado: 'RECHAZADA',
      codigo: 'HARNESS_D1_A_RECHAZO',
    });
  });
});

describe('CP-F7-D1-B · escritura, integridad y manifiesto', () => {
  it.each(['BNA', 'PATAGONIA'] as const)(
    'escribe %s con wx y verifica tamaño/hash antes y después',
    async (banco) => {
      const plan = planPreparado(banco);
      const resultado = await materializarPlanSintetico(
        plan,
        plan.fraseConfirmacion,
        directorioPermitido,
      );

      expect(resultado.estado).toBe('MATERIALIZADA');
      if (resultado.estado !== 'MATERIALIZADA') return;
      const guardados = await readFile(resultado.rutaArchivo);
      expect(guardados.byteLength).toBe(plan.cantidadBytes);
      expect(hash(guardados)).toBe(plan.sha256Preparado);
      expect(resultado.cantidadBytes).toBe(plan.cantidadBytes);
      expect(resultado.sha256Preparado).toBe(plan.sha256Preparado);
      expect(resultado.sha256AntesEscritura).toBe(plan.sha256Preparado);
      expect(resultado.sha256Archivo).toBe(plan.sha256Preparado);
      expect(resultado.inspeccion).toEqual(plan.inspeccion);
      expect((await lstat(resultado.rutaArchivo)).isFile()).toBe(true);
      expect((await lstat(resultado.rutaManifiesto)).isFile()).toBe(true);
    },
  );

  it('usa ACREXXXX.TXT sin inventar convenio y un nombre BNA inequívocamente de prueba', () => {
    expect(planPreparado('PATAGONIA').nombreArchivo).toBe('ACREXXXX.TXT');
    expect(planPreparado('BNA').nombreArchivo).toBe('PRUEBA_SINTETICA_BNA_GT200_NO_PRODUCTIVA.TXT');
  });

  it('registra un manifiesto sin identidades, cuentas ni importes individuales', async () => {
    const plan = planPreparado('PATAGONIA');
    const resultado = await materializarPlanSintetico(
      plan,
      plan.fraseConfirmacion,
      directorioPermitido,
    );
    if (resultado.estado !== 'MATERIALIZADA') throw new Error('materialización esperada');

    const texto = await readFile(resultado.rutaManifiesto, 'utf8');
    const manifiesto = JSON.parse(texto) as Record<string, unknown>;
    expect(manifiesto).toMatchObject({
      schemaVersion: '1',
      advertencia: ADVERTENCIA_ARCHIVO_SINTETICO,
      banco: 'PATAGONIA',
      variante: 'VALIDA',
      nombreArchivo: 'ACREXXXX.TXT',
      cantidadBytes: plan.cantidadBytes,
      sha256: plan.sha256Preparado,
      sintetico: true,
      productivo: false,
      homologado: false,
      confirmacionHumana: true,
    });
    expect(texto).not.toMatch(/cuil|cbu|legajo|emplead|importe/i);
    expect(scanText('manifiesto-sintetico.json', texto)).toEqual([]);
  });

  it('no sobrescribe un TXT existente', async () => {
    const plan = planPreparado();
    await mkdir(directorioPermitido, { mode: 0o700 });
    await writeFile(join(directorioPermitido, plan.nombreArchivo), 'ocupado', {
      flag: 'wx',
    });

    const resultado = await materializarPlanSintetico(
      plan,
      plan.fraseConfirmacion,
      directorioPermitido,
    );
    expect(resultado).toMatchObject({ estado: 'RECHAZADA', codigo: 'ARCHIVO_EXISTENTE' });
    expect(await readFile(join(directorioPermitido, plan.nombreArchivo), 'utf8')).toBe('ocupado');
  });

  it('rechaza bytes alterados después de preparar e inspeccionar y no escribe', async () => {
    const plan = planPreparado();
    plan.bytes[0] = (plan.bytes[0] ?? 0) ^ 0xff;

    const resultado = await materializarPlanSintetico(
      plan,
      plan.fraseConfirmacion,
      directorioPermitido,
    );
    expect(resultado).toMatchObject({ estado: 'RECHAZADA', codigo: 'BYTES_ALTERADOS' });
    expect(await existe(directorioPermitido)).toBe(false);
  });
});

describe('CP-F7-D1-B · confinamiento de rutas y separación productiva', () => {
  it.each(['relativo/homologacion-sintetica', '/tmp/salida-no-permitida'])(
    'rechaza el directorio inválido %s',
    async (ruta) => {
      const plan = planPreparado();
      const resultado = await materializarPlanSintetico(plan, plan.fraseConfirmacion, ruta);
      expect(resultado).toMatchObject({ estado: 'RECHAZADA', codigo: 'RUTA_NO_PERMITIDA' });
    },
  );

  it('rechaza path traversal aun cuando resuelva a un nombre permitido', async () => {
    const plan = planPreparado();
    const traversal = `${raizTemporal}${sep}sub${sep}..${sep}homologacion-sintetica`;
    const resultado = await materializarPlanSintetico(plan, plan.fraseConfirmacion, traversal);
    expect(resultado).toMatchObject({ estado: 'RECHAZADA', codigo: 'RUTA_NO_PERMITIDA' });
  });

  it('rechaza un directorio permitido que sea symlink', async () => {
    const plan = planPreparado();
    const destino = join(raizTemporal, 'destino-real');
    await mkdir(destino);
    await symlink(destino, directorioPermitido, 'dir');

    const resultado = await materializarPlanSintetico(
      plan,
      plan.fraseConfirmacion,
      directorioPermitido,
    );
    expect(resultado).toMatchObject({ estado: 'RECHAZADA', codigo: 'DIRECTORIO_INSEGURO' });
    expect(await readdir(destino)).toEqual([]);
  });

  it('mantiene la escritura fuera de verify/build y el compositor fuera de la interfaz RRHH', async () => {
    const packageJson = JSON.parse(await readFile('package.json', 'utf8')) as {
      readonly scripts: Readonly<Record<string, string>>;
    };
    expect(packageJson.scripts['homologacion:sintetica']).toContain(
      'run-materializar-homologacion-sintetica.mts',
    );
    expect(packageJson.scripts['verify']).not.toContain('homologacion:sintetica');
    expect(packageJson.scripts['build']).not.toContain('homologacion:sintetica');

    const buscarEnSrc = async (directorio: string): Promise<string[]> => {
      const entradas = await readdir(directorio, { withFileTypes: true });
      const hallazgos: string[] = [];
      for (const entrada of entradas) {
        const ruta = join(directorio, entrada.name);
        if (entrada.isDirectory()) {
          hallazgos.push(...(await buscarEnSrc(ruta)));
        } else if (/\.(ts|tsx)$/.test(entrada.name)) {
          const texto = await readFile(ruta, 'utf8');
          if (
            /materializacionHomologacionSintetica|homologacion:sintetica|composicionHomologacionSintetica/.test(
              texto,
            )
          ) {
            hallazgos.push(ruta);
          }
        }
      }
      return hallazgos;
    };
    expect(await buscarEnSrc('src/ui')).toEqual([]);
    const compositor = await readFile('src/run/composicionHomologacionSintetica.ts', 'utf8');
    expect(compositor).not.toMatch(/materializarPlanSintetico|node:fs|node:path/);
  });
});
