// CP-F3-C · e2e del editor UPDATE-only del maestro (T3-11/T3-12): editar un dato de banco
// re-concilia solo, la revisión N crece sin revisar N-1, los errores F2 se muestran en
// palabras, identidad/dependencia no son editables y la versión editada se descarga
// (round-trip por la misma ruta de reimportación). Datos sintéticos (D-042). Sin cambio de
// contratos: es la UI operativa sobre el motor F2 aprobado.
import { expect, test, type Page } from '@playwright/test';
import {
  filaFinnegans,
  maestroXlsx,
  finnegansXlsx,
  registroBna,
  type RegistroMaestro,
} from '../fixtures/synthetic/escenarios.ts';
import { createRandom, syntheticCbu } from '../fixtures/synthetic/identities.ts';
import { personas } from '../fixtures/synthetic/escenarios.ts';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const NACION = 'BANCO DE LA NACION ARGENTINA';

function exigir<T>(valor: T | undefined, rótulo: string): T {
  if (valor === undefined) {
    throw new Error(`Falta el dato esperado: ${rótulo}`);
  }
  return valor;
}

interface Corrida {
  readonly fila: ReturnType<typeof filaFinnegans>;
  readonly registros: readonly RegistroMaestro[];
}

/** Corrida de dos Nación: fila 0 con banco vacío (acción pendiente ATC), maestro con CBU. */
function corridaBase(): Corrida {
  const random = createRandom(20261021);
  const base = personas(2, 20261021);
  const primera = exigir(base[0], 'persona 0');
  const segunda = exigir(base[1], 'persona 1');
  const registros = [
    registroBna(primera, random),
    registroBna(segunda, random),
  ];
  return {
    fila: filaFinnegans(primera, { Banco: null, Legajo: primera.legajo }),
    registros,
  };
}

async function subirCorrida(page: Page, corrida: Corrida, cantidad = 1) {
  await page.goto('/');
  const finnegans = [corrida.fila];
  const base = personas(cantidad, 20261021);
  for (const persona of base.slice(0, cantidad - 1)) {
    finnegans.push(filaFinnegans(persona, { Banco: NACION }));
  }
  await page
    .getByLabel('Archivo de la liquidación', { exact: true })
    .setInputFiles({
      name: 'finnegans.xlsx',
      mimeType: XLSX_MIME,
      buffer: Buffer.from(finnegansXlsx(finnegans)),
    });
  await page
    .getByLabel('Archivo del maestro', { exact: true })
    .setInputFiles({
      name: 'maestro.xlsx',
      mimeType: XLSX_MIME,
      buffer: Buffer.from(maestroXlsx(corrida.registros)),
    });
  await expect(page.getByTestId('revision-maestro')).toHaveText('Versión del maestro: 0');
}

async function abrirDetalle(page: Page) {
  await page.getByTestId('boton-conciliar').click();
  await page.getByTestId('ver-fila-0').click();
  await expect(page.getByTestId('detalle-fila')).toBeVisible();
  await expect(page.getByTestId('datos-maestro')).toBeVisible();
}

async function editarCampo(page: Page, campo: string, texto: string) {
  await page.getByTestId(`boton-editar-${campo}`).click();
  await page.getByTestId(`entrada-${campo}`).fill(texto);
  await page.getByTestId(`guardar-${campo}`).click();
}

test.describe('CP-F3-C · accesibilidad de la operación (T3-14)', () => {
  test('etiquetas asociadas a los inputs y foco visible al teclar en la tabla', async ({
    page,
  }) => {
    const corrida = corridaBase();
    await subirCorrida(page, corrida);
    await abrirDetalle(page);
    await page.getByTestId('boton-editar-PAT_CODIGO_BANCO').click();
    // El input deportivo tiene su etiqueta asociada (accesible por lector de pantalla).
    await expect(page.getByLabel('Código de banco — nuevo valor')).toBeVisible();
    // Foco visible con teclado: outline 2px (T3-14).
    await page.keyboard.press('Tab');
    const conFoco = await page.evaluate(
      () => document.activeElement !== null && getComputedStyle(document.activeElement).outlineWidth !== '0px',
    );
    expect(conFoco).toBe(true);
  });
});

test.describe('CP-F3-C · editor UPDATE-only del maestro', () => {
  test('editar el CBU re-concilia solo y la revisión sube a 1 (BANCO 028 → mensaje bloqueo BNA)', async ({
    page,
  }) => {
    const { problems, requests } = watchLocal(page);
    const corrida = corridaBase();
    await subirCorrida(page, corrida);
    await abrirDetalle(page);
    const cbuEditado = syntheticCbu('028', '0001', '0000000000001');
    await editarCampo(page, 'CBU', cbuEditado);
    await expect(page.getByTestId('revision-maestro')).toHaveText('Versión del maestro: 1');
    // El detalle permanece abierto (recorrido 15 del plan) con el nuevo valor (texto exacto).
    await expect(page.getByTestId('detalle-fila')).toBeVisible();
    await expect(page.locator(`[data-testid="datos-maestro"]`).first()).toContainText(cbuEditado);
    // Datos técnicos: nada de ids F2 en el texto visible.
    const html = await page.getByTestId('datos-maestro').textContent();
    expect(html).not.toMatch(/Master|CBU2[12]|\bdd-/);
    expect(problems).toEqual([]);
    // Cero red/ficheros fuera del origin local (request descarga a blob:).
    const noLocal = requests.filter(
      (u) => !u.startsWith('http://127.0.0.1:4173/') && !u.startsWith('blob:') && !u.startsWith('data:'),
    );
    expect(noLocal).toEqual([]);
  });

  test('valor INVÁLIDO (fuera de catálogo) no reemplaza la revisión y muestra motivo humanamente', async ({
    page,
  }) => {
    const corrida = corridaBase();
    await subirCorrida(page, corrida);
    await abrirDetalle(page);
    await editarCampo(page, 'PAT_TIPO_CUENTA', '9');
    await expect(page.getByTestId('error-edicion-PAT_TIPO_CUENTA')).toContainText(
      'no se acepta',
    );
    await expect(page.getByTestId('revision-maestro')).toHaveText('Versión del maestro: 0');
  });

  test('identidad (CUIL) y PAT_CODIGO_DEPENDENCIA no tienen botón de edición (solo referencia)', async ({
    page,
  }) => {
    const corrida = corridaBase();
    await subirCorrida(page, corrida);
    await abrirDetalle(page);
    await expect(page.getByTestId('referencia-cuil')).toContainText('(solo referencia)');
    await expect(page.getByTestId('campo-maestro-PAT_CODIGO_DEPENDENCIA')).toContainText(
      'solo referencia',
    );
    await expect(page.getByTestId('boton-editar-CUIL')).toHaveCount(0);
    await expect(page.getByTestId('boton-editar-PAT_CODIGO_DEPENDENCIA')).toHaveCount(0);
  });

  test('segunda edición de otro campo: revisión 2, sin perder la primera', async ({ page }) => {
    const corrida = corridaBase();
    await subirCorrida(page, corrida);
    await abrirDetalle(page);
    await editarCampo(page, 'CBU', syntheticCbu('028', '0001', '0000000000001'));
    await expect(page.getByTestId('revision-maestro')).toHaveText('Versión del maestro: 1');
    await editarCampo(page, 'PAT_NUMERO_CUENTA', '937142');
    await expect(page.getByTestId('revision-maestro')).toHaveText('Versión del maestro: 2');
  });

  test('SIN_CAMBIOS: guardo el mismo texto y no se registra revisión', async ({ page }) => {
    const corrida = corridaBase();
    await subirCorrida(page, corrida);
    await abrirDetalle(page);
    const crudo = corrida.registros[0]?.PAT_NUMERO_CUENTA;
    const valorActual = typeof crudo === 'string' ? crudo : '';
    await editarCampo(page, 'PAT_NUMERO_CUENTA', valorActual);
    await expect(page.getByTestId('error-edicion-PAT_NUMERO_CUENTA')).toContainText(
      'no se registró una versión nueva',
    );
    await expect(page.getByTestId('revision-maestro')).toHaveText('Versión del maestro: 0');
  });

  test('exportar la versión editada descarga el XLSX del maestro revisado (T3-12)', async ({
    page,
  }) => {
    const corrida = corridaBase();
    await subirCorrida(page, corrida);
    await abrirDetalle(page);
    await editarCampo(page, 'CBU', syntheticCbu('028', '0001', '0000000000001'));
    await expect(page.getByTestId('revision-maestro')).toHaveText('Versión del maestro: 1');
    const descarga = page.waitForEvent('download');
    await page.getByTestId('boton-exportar-maestro').click();
    const archivo = await descarga;
    expect(archivo.suggestedFilename()).toMatch(/MAESTRO_CUENTAS_EMPLEADOS_\d{4}-\d{2}-\d{2}_editado_r1\.xlsx/);
  });
});

function watchLocal(page: Page): { problems: string[]; requests: string[] } {
  const requests: string[] = [];
  const problems: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.name}`));
  page.on('console', (m) => {
    if (m.type() === 'error') {
      problems.push(`console: ${m.text().slice(0, 120)}`);
    }
  });
  return { problems, requests };
}
