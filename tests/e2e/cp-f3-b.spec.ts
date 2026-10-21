import { expect, test, type Page } from '@playwright/test';
import {
  filaFinnegans,
  maestroXlsx,
  finnegansXlsx,
  registroBna,
} from '../fixtures/synthetic/escenarios.ts';
import type { RegistroMaestro } from '../fixtures/synthetic/escenarios.ts';
import { plantillaPerfil } from '../../src/profile/plantilla';
import { createRandom } from '../fixtures/synthetic/identities.ts';
import { personas } from '../fixtures/synthetic/escenarios.ts';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function watch(page: Page) {
  const requests: string[] = [];
  const problems: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.name}`));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      problems.push(`console: ${message.text().slice(0, 120)}`);
    }
  });
  return { requests, problems };
}

async function uploadFinnegans(page: Page, bytes: Uint8Array) {
  await page.getByLabel('Archivo de la liquidación', { exact: true }).setInputFiles({
    name: 'finnegans_demo_sintética.xlsx',
    mimeType: XLSX_MIME,
    buffer: Buffer.from(bytes),
  });
}

async function uploadMaestro(page: Page, bytes: Uint8Array, name = 'maestro_demo_sintético.xlsx') {
  await page
    .getByLabel('Archivo del maestro', { exact: true })
    .setInputFiles({ name, mimeType: XLSX_MIME, buffer: Buffer.from(bytes) });
}

const external = (urls: readonly string[]) =>
  urls.filter(
    (url) =>
      !url.startsWith('http://127.0.0.1:4173/') &&
      !url.startsWith('blob:') &&
      !url.startsWith('data:'),
  );

/** Personas sintéticas sin `!` del índice (la ESLint del repo lo prohíbe). */
function exigir<T>(valor: T | undefined, rótulo: string): T {
  if (valor === undefined) {
    throw new Error(`Falta el dato esperado: ${rótulo}`);
  }
  return valor;
}

const NACION = 'BANCO DE LA NACION ARGENTINA';

test.beforeEach(({ page }) => {
  // Reinicia corrida con confirmación (window.confirm) ya aceptada.
  page.on('dialog', (dialog) => void dialog.accept());
});

test.describe('CP-F3-B · recorrido completo del asistente (datos sintéticos)', () => {
  test('corrida vacía, carga correcta, conciliación cerrada y readiness simétrico', async ({
    page,
  }) => {
    const { requests, problems } = watch(page);
    await page.goto('/');
    await expect(page.getByTestId('boton-conciliar')).toBeDisabled();
    await expect(page.getByTestId('sin-conciliar')).toBeVisible();

    const base = personas(2, 20261020);
    const filas = [
      filaFinnegans(exigir(base[0], 'persona base 0'), {
        Banco: NACION,
        Descripcion: 'JULIO Agrario',
      }),
      filaFinnegans(exigir(base[1], 'persona base 1'), {
        Banco: NACION,
        Descripcion: 'JULIO Agrario',
      }),
    ];
    const registros: RegistroMaestro[] = base.map((persona) =>
      registroBna(persona, createRandom(1)),
    );
    await uploadFinnegans(page, finnegansXlsx(filas));
    await expect(page.getByTestId('estado-finnegans')).toHaveText('Cargada: 2 filas leídas.');
    await uploadMaestro(page, maestroXlsx(registros));
    await expect(page.getByTestId('estado-maestro')).toHaveText('Cargado: 2 registros.');
    await expect(page.getByTestId('boton-conciliar')).toBeEnabled();
    await page.getByTestId('boton-conciliar').click();

    const resumen = page.getByTestId('panel-resumen');
    await expect(page.getByTestId('estado-global')).toHaveText('Conciliación cerrada');
    await expect(resumen).toContainText('cuadra');
    // Sin mapeos aprobados del perfil (P-09/P-10 pendientes), el tipo de liquidación
    // siempre queda como bloqueante DE FILA; el estado global no lo traduce (D-026).
    await expect(page.locator('[data-testid="grupo-BLOQUEANTE"]')).toContainText(
      'Tipo de liquidación sin mapeo aprobado',
    );
    await expect(page.locator('[data-testid="grupo-REQUIERE_REVISION"]')).toHaveCount(0);
    // Readiness simétrico, con estados según el motor (D-065/D-067).
    await expect(page.getByTestId('readiness-BNA_GT_HABERES')).toContainText('Banco Nación');
    await expect(page.getByTestId('readiness-PATAGONIA_B2')).toContainText('Banco Patagonia');
    await expect(page.getByTestId('estado-BNA_GT_HABERES')).toHaveText('Bloqueado');
    await expect(page.getByTestId('estado-PATAGONIA_B2')).toHaveText('Sin registros asignados');
    await expect(page.getByTestId('readiness-BNA_GT_HABERES')).toContainText(
      'Hay filas de este banco con bloqueantes.',
    );
    for (const destino of ['BNA_GT_HABERES', 'PATAGONIA_B2']) {
      await expect(page.getByTestId(`homologacion-${destino}`)).toContainText(
        'pendiente de homologación',
      );
    }
    await page.getByTestId('boton-reiniciar').click();
    await expect(page.getByTestId('resumen-carga')).toHaveText(
      'Finnegans: pendiente · Maestro: pendiente · Perfil: sin cargar',
    );
    expect(problems).toEqual([]);
    expect(external(requests)).toEqual([]);
  });

  test('NETO_CERO: la fila queda excluida y visible en la tabla con su motivo', async ({
    page,
  }) => {
    const { problems } = watch(page);
    await page.goto('/');
    const base = personas(2, 20261020);
    const filas = [
      filaFinnegans(exigir(base[0], 'persona base 0'), { Banco: NACION }),
      filaFinnegans(exigir(base[1], 'persona base 1'), {
        Banco: NACION,
        Remunerativo: '0',
        'No remunerativo': '0',
        Descuento: '0',
        Neto: '0',
      }),
    ];
    const registros = base.map((persona) => registroBna(persona, createRandom(2)));
    await uploadFinnegans(page, finnegansXlsx(filas));
    await uploadMaestro(page, maestroXlsx(registros));
    await page.getByTestId('boton-conciliar').click();
    await expect(page.getByTestId('estado-global')).toHaveText('Conciliación cerrada');
    await expect(page.getByTestId('fila-1')).toContainText('Excluida');
    await page.getByTestId('ver-fila-1').click();
    await expect(page.getByTestId('datos-fila')).toContainText('Neto igual a cero');
    expect(problems).toEqual([]);
  });

  test('BANCO_VACIO: pendiente, asignación manual de destino y decisión aplicada', async ({
    page,
  }) => {
    const { problems } = watch(page);
    await page.goto('/');
    const base = personas(1, 20261020);
    await uploadFinnegans(
      page,
      finnegansXlsx([filaFinnegans(exigir(base[0], 'persona base 0'), { Banco: null })]),
    );
    await uploadMaestro(
      page,
      maestroXlsx([registroBna(exigir(base[0], 'persona base 0'), createRandom(3))]),
    );
    await page.getByTestId('boton-conciliar').click();
    await expect(page.getByTestId('estado-global')).toHaveText('Conciliación pendiente');
    await expect(page.getByTestId('motivos-globales')).toContainText('Hay filas pendientes');
    await expect(page.getByTestId('fila-0')).toContainText('Pendiente · Sin banco');

    const asignar = page.getByTestId('asignar-patagonia');
    await asignar.click();
    // Re-conciliación automática: la fila queda incluida con el banco elegido.
    await expect(page.getByTestId('fila-0')).toContainText('Incluida · Banco Patagonia');
    await expect(page.getByTestId('estado-global')).toHaveText('Conciliación cerrada');
    await expect(page.getByTestId('decisiones-aplicadas')).toContainText(
      'd-1: destino Banco Patagonia',
    );
    expect(problems).toEqual([]);
  });

  test('CONFIRMAR_REVISION: revisión de legajo confirmada, queda aplicada y trazable', async ({
    page,
  }) => {
    const { problems } = watch(page);
    await page.goto('/');
    const base = personas(1, 20261020);
    await uploadFinnegans(
      page,
      finnegansXlsx([
        filaFinnegans({ ...exigir(base[0], 'persona base 0'), legajo: '007' }, { Banco: NACION }),
      ]),
    );
    await uploadMaestro(
      page,
      maestroXlsx([
        registroBna({ ...exigir(base[0], 'persona base 0'), legajo: '7' }, createRandom(4)),
      ]),
    );
    await page.getByTestId('boton-conciliar').click();
    // La fila sigue siendo bloqueante por el tipo sin mapeo (P-09); la revisión del legajo
    // aparece en su grupo con los dos valores observados y su botón (gravedad visible separada).
    await expect(page.getByTestId('fila-0')).toContainText('Incluida · Banco Nación');
    const revisiones = page.locator('[data-testid="grupo-REQUIERE_REVISION"]');
    await expect(revisiones).toContainText('legajo');
    // Los valores observados de ambas fuentes quedan a la vista (sin red ni captura).
    await expect(revisiones).toContainText('«007»');
    await expect(revisiones).toContainText('«7»');
    await page.getByTestId('confirmar-revision').click();
    await expect(revisiones).toContainText('Resuelta por decisión del operador');
    await expect(page.getByTestId('estado-global')).toHaveText('Conciliación cerrada');
    await expect(page.getByTestId('decisiones-aplicadas')).toContainText(
      'd-1: confirmación de datos',
    );
    expect(problems).toEqual([]);
  });

  test('decisión no aplicada: al cambiar el maestro, la confirmación deja de valer (DATOS_CAMBIARON)', async ({
    page,
  }) => {
    const { problems } = watch(page);
    await page.goto('/');
    const base = personas(1, 20261020);
    await uploadFinnegans(
      page,
      finnegansXlsx([
        filaFinnegans({ ...exigir(base[0], 'persona base 0'), legajo: '007' }, { Banco: NACION }),
      ]),
    );
    await uploadMaestro(
      page,
      maestroXlsx([
        registroBna({ ...exigir(base[0], 'persona base 0'), legajo: '7' }, createRandom(4)),
      ]),
    );
    await page.getByTestId('boton-conciliar').click();
    await page.getByTestId('confirmar-revision').click();
    await expect(page.getByTestId('decisiones-aplicadas')).toContainText('d-1');

    // Re-cargar el maestro con contenido lógico distinto (otro legajo distinto): la
    // huella de la revisión cambia (D-063, vía puente) y la decisión vieja deja de valer.
    const random = createRandom(99);
    const registroEditado = registroBna(exigir(base[0], 'persona base 0'), random, {
      LEGAJO: '8',
    });
    await uploadMaestro(page, maestroXlsx([registroEditado]), 'maestro_cambiado_sintético.xlsx');
    // El re-cargo del maestro deja la corrida sin conciliar: esperar ese estado (y no el
    // texto igual de la fase anterior) evita conciliar con el maestro viejo del estado.
    await expect(page.getByTestId('panel-resumen')).toHaveCount(0);
    await expect(page.getByTestId('estado-maestro')).toHaveText('Cargado: 1 registros.');
    await page.getByTestId('boton-conciliar').click();
    await expect(page.locator('[data-testid="grupo-REQUIERE_REVISION"]')).toContainText('legajo');
    await expect(page.getByTestId('decisiones-no-aplicadas')).toContainText(
      'd-1: confirmación de datos',
    );
    await expect(page.getByTestId('decisiones-no-aplicadas')).toContainText('no son los vigentes');
    expect(problems).toEqual([]);
  });

  test('conciliación bloqueada: banco fuera del catálogo es bloqueante global y ambos bancos esperan', async ({
    page,
  }) => {
    const { problems } = watch(page);
    await page.goto('/');
    const base = personas(2, 20261020);
    const filas = [
      filaFinnegans(exigir(base[0], 'persona base 0'), { Banco: NACION }),
      filaFinnegans(exigir(base[1], 'persona base 1'), { Banco: 'BANCO FANTASMA S.A.' }),
    ];
    await uploadFinnegans(page, finnegansXlsx(filas));
    await uploadMaestro(
      page,
      maestroXlsx(base.map((persona) => registroBna(persona, createRandom(5)))),
    );
    await page.getByTestId('boton-conciliar').click();
    await expect(page.getByTestId('estado-global')).toHaveText('Conciliación bloqueada');
    const bloqueantes = page.locator('[data-testid="grupo-BLOQUEANTE"]');
    await expect(bloqueantes).toContainText('Banco fuera del catálogo');
    await expect(page.getByTestId('estado-BNA_GT_HABERES')).toContainText(
      'Esperando que la conciliación cierre',
    );
    await expect(page.getByTestId('estado-PATAGONIA_B2')).toContainText(
      'Esperando que la conciliación cierre',
    );
    expect(problems).toEqual([]);
  });

  test('perfil inválido: error controlado y sin perfil cargado; perfil válido activa la corrida', async ({
    page,
  }) => {
    const { problems } = watch(page);
    await page.goto('/');
    // JSON sin campos: el validador lo rechaza por rutas y códigos, no por excepción.
    await page.getByLabel('Archivo del perfil (JSON)', { exact: true }).setInputFiles({
      name: 'perfil_truncado.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{}'),
    });
    await expect(page.getByTestId('error-perfil')).toContainText('Perfil de empresa inválido');
    await expect(page.getByTestId('estado-perfil')).toHaveText(/Sin perfil de empresa/);

    // Ahora un perfil válido, generado con la misma plantilla que exporta la UI
    // (catálogo canónico) y CUIT estructural sintético armado en runtime (D-042).
    const cuit = ['30', '45678901', '3'].join('-');
    const perfilValido = {
      ...plantillaPerfil(cuit as never),
      nombreEmpresa: 'Empresa de prueba (sintética)',
    };
    await page.getByLabel('Archivo del perfil (JSON)', { exact: true }).setInputFiles({
      name: 'perfil.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(perfilValido)),
    });
    await expect(page.getByTestId('perfil-ok')).toHaveText('Perfil de empresa cargado.');
    await expect(page.getByTestId('perfil-activo')).toContainText('Empresa de prueba');
    expect(problems).toEqual([]);
  });
});
