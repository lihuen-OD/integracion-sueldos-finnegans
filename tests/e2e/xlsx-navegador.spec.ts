import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';
import { E2E_ORIGIN } from '../../playwright.config.ts';
import { buildMaestroTiposMezclados, notAZip } from '../fixtures/synthetic/edgeCases.ts';
import { espejoMuestra, finnegansXlsx, textoDeCelda } from '../fixtures/synthetic/escenarios.ts';
import { buildFinnegansLike } from '../fixtures/synthetic/finnegansLike.ts';

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

async function upload(page: Page, name: string, bytes: Uint8Array) {
  // `exact`: el título de la sección ("Diagnóstico de archivo XLSX…") también coincidiría.
  await page
    .getByLabel('Archivo XLSX', { exact: true })
    .setInputFiles({ name, mimeType: XLSX_MIME, buffer: Buffer.from(bytes) });
}

const external = (urls: readonly string[]) =>
  urls.filter(
    (url) =>
      !url.startsWith(`${E2E_ORIGIN}/`) && !url.startsWith('blob:') && !url.startsWith('data:'),
  );

test.describe('T6/T7 · XLSX en el navegador, build de producción con CSP', () => {
  test('lee Finnegans y el maestro, escribe la plantilla, sin red y sin persistencia', async ({
    page,
    context,
  }) => {
    const { requests, problems } = watch(page);
    await page.goto('/');

    // T7: ExcelJS no se descarga al abrir la app (carga diferida).
    const scriptsAlInicio = requests.filter((url) => url.endsWith('.js'));
    expect(scriptsAlInicio).toHaveLength(1);

    // T6 lectura: estructura tipo Finnegans (POI, inlineStr, dimensión "A1").
    const finnegans = buildFinnegansLike();
    await upload(page, 'finnegans_sintetico.xlsx', finnegans.bytes);
    const diagnostico = page.getByTestId('diagnostico');
    await expect(diagnostico).toContainText('Hoja «hoja1» (visible) · Filas de datos: 160');
    await expect(diagnostico).toContainText('Columnas: 14');
    await expect(diagnostico.getByRole('row', { name: /Cuil texto 160/ })).toBeVisible();
    await expect(diagnostico.getByRole('row', { name: /Neto número 160/ })).toBeVisible();
    // La pantalla nunca muestra valores de celdas.
    const contenido = await page.locator('main').innerText();
    for (const row of finnegans.rows.slice(0, 10)) {
      expect(contenido).not.toContain(row.cuil);
    }
    expect(requests.filter((url) => url.endsWith('.js')).length).toBeGreaterThan(1);

    // Desde aquí, sin red: la app sigue funcionando con lo ya cargado.
    await context.setOffline(true);

    await upload(page, 'maestro_sintetico.xlsx', buildMaestroTiposMezclados());
    await expect(diagnostico).toContainText('Hoja «Empleados» (visible)');
    await expect(diagnostico).toContainText('Hoja «Oculta» (hidden)');
    await expect(diagnostico.getByRole('row', { name: /CONTROL fórmula 1/ })).toBeVisible();

    // T6 escritura: plantilla de prueba descargada desde el navegador.
    const descarga = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Descargar plantilla de prueba (T11)' }).click();
    const archivo = await descarga;
    expect(archivo.suggestedFilename()).toBe('plantilla_prueba_spike_F1.xlsx');
    const partes = unzipSync(new Uint8Array(readFileSync(await archivo.path())));
    const libro = strFromU8(partes['xl/workbook.xml'] ?? new Uint8Array());
    for (const hoja of ['Empleados', 'Instrucciones', 'Catalogos', 'Control']) {
      expect(libro).toContain(`name="${hoja}"`);
    }
    expect(strFromU8(partes['xl/styles.xml'] ?? new Uint8Array())).toContain('numFmtId="49"');
    const hoja1 = strFromU8(partes['xl/worksheets/sheet1.xml'] ?? new Uint8Array());
    expect(hoja1).toContain('type="list"');
    expect(hoja1).not.toContain('<f>');

    // Limpiar y recargar: no queda nada en pantalla ni en el navegador.
    await page.getByRole('button', { name: 'Limpiar' }).click();
    await expect(diagnostico).toHaveCount(0);
    await context.setOffline(false);
    await page.reload();
    await expect(page.getByTestId('diagnostico')).toHaveCount(0);
    const almacenamiento = await page.evaluate(async () => ({
      local: localStorage.length,
      session: sessionStorage.length,
      cookies: document.cookie,
      indexedDB: (await indexedDB.databases()).length,
      serviceWorkers: (await navigator.serviceWorker.getRegistrations()).length,
      caches: (await caches.keys()).length,
    }));
    expect(almacenamiento).toEqual({
      local: 0,
      session: 0,
      cookies: '',
      indexedDB: 0,
      serviceWorkers: 0,
      caches: 0,
    });

    expect(external(requests)).toEqual([]);
    expect(problems).toEqual([]);
  });

  test('T-F2-M1 · plantilla del maestro vacía y prellenada, sin red y sin mostrar datos', async ({
    page,
    context,
  }) => {
    const { requests, problems } = watch(page);
    await page.goto('/');
    const prellenado = page.getByTestId('prellenado');
    const botonPrellenado = page.getByRole('button', {
      name: 'Descargar maestro prellenado (T-F2-M1)',
    });
    await expect(botonPrellenado).toBeDisabled();

    const espejo = espejoMuestra();
    await upload(page, 'finnegans_espejo_sintetico.xlsx', finnegansXlsx(espejo.filas));
    await expect(prellenado).toHaveText(
      'Maestro prellenado: 156 filas · omitidas por CUIL inválido: 0 · por CUIL repetido: 0 · por legajo ilegible: 0.',
    );
    await context.setOffline(true);

    const descargaPrellenada = page.waitForEvent('download');
    await botonPrellenado.click();
    const prellenada = await descargaPrellenada;
    expect(prellenada.suggestedFilename()).toMatch(
      /^MAESTRO_CUENTAS_EMPLEADOS_[0-9]{4}-[0-9]{2}-[0-9]{2}\.xlsx$/,
    );
    const partes = unzipSync(new Uint8Array(readFileSync(await prellenada.path())));
    const libro = strFromU8(partes['xl/workbook.xml'] ?? new Uint8Array());
    for (const hoja of ['Empleados', 'Instrucciones', 'Catalogos']) {
      expect(libro).toContain(`name="${hoja}"`);
    }
    expect(libro).toMatch(/name="Control"[^>]*state="hidden"/);
    const textos = strFromU8(partes['xl/sharedStrings.xml'] ?? new Uint8Array());
    expect(textos).toContain(textoDeCelda(espejo.filas[0]?.Cuil));
    expect(textos).toContain('PRELLENADA');

    const descargaVacia = page.waitForEvent('download');
    await page
      .getByRole('button', { name: 'Descargar plantilla del maestro vacía (T-F2-M1)' })
      .click();
    const vacia = await descargaVacia;
    expect(vacia.suggestedFilename()).toBe('MAESTRO_CUENTAS_EMPLEADOS.xlsx');
    const hoja1 = strFromU8(
      unzipSync(new Uint8Array(readFileSync(await vacia.path())))['xl/worksheets/sheet1.xml'] ??
        new Uint8Array(),
    );
    expect(hoja1).toContain('&quot;001,002,003,004,006&quot;');
    expect(hoja1).not.toContain('<f>');

    // La pantalla muestra solo conteos, nunca CUIL ni legajos.
    const contenido = await page.locator('main').innerText();
    for (const fila of espejo.filas.slice(0, 20)) {
      expect(contenido).not.toContain(textoDeCelda(fila.Cuil));
    }
    await page.getByRole('button', { name: 'Limpiar' }).click();
    await expect(botonPrellenado).toBeDisabled();
    expect(external(requests)).toEqual([]);
    expect(problems).toEqual([]);
  });

  test('un archivo inválido muestra un error controlado', async ({ page }) => {
    const { problems } = watch(page);
    await page.goto('/');
    await upload(page, 'no_es_xlsx.xlsx', notAZip());
    await expect(page.getByRole('alert')).toHaveText('El archivo no es un XLSX válido.');
    await expect(page.getByTestId('diagnostico')).toHaveCount(0);
    expect(problems).toEqual([]);
  });
});
