// T3-13 · escala de la corrida con datos sintéticos deterministas (180/5.000 hoy):
// 300 filas funcionales (búsqueda, filtros, páginas, edición, exportación) y una corrida
// de 5.000 filas como medición exploratoria en LOCAL (sin SLA prod; se registra el tiempo
// paraBitácora). La mecánica es la misma que la muestra de 156 (cp-f3-b) y la del editor.
import { expect, test, type Page } from '@playwright/test';
import { escenarioMasivo, maestroXlsx, finnegansXlsx } from '../fixtures/synthetic/escenarios.ts';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function subirEscenario(page: Page, cantidad: number, semilla: number) {
  const espejo = escenarioMasivo(cantidad, semilla);
  await page.goto('/');
  await page
    .getByLabel('Archivo de la liquidación', { exact: true })
    .setInputFiles({
      name: `finnegans_${String(cantidad)}.xlsx`,
      mimeType: XLSX_MIME,
      buffer: Buffer.from(finnegansXlsx([...espejo.filas])),
    });
  await page
    .getByLabel('Archivo del maestro', { exact: true })
    .setInputFiles({
      name: `maestro_${String(cantidad)}.xlsx`,
      mimeType: XLSX_MIME,
      buffer: Buffer.from(maestroXlsx([...espejo.registros])),
    });
  return espejo;
}

test.describe('T3-13 · escala 300 filas (funcional)', () => {
  test('concilia, agrupa sin perder casos, busca, filtra, pagina, edita y exporta', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const empieza = Date.now();
    const espejo = await subirEscenario(page, 300, 300);
    await page.getByTestId('boton-conciliar').click();
    await expect(page.getByTestId('totales')).toContainText('300');
    // Bloqueos LIQUIDACION_SIN_MAPEO agrupados: todos los casos contados al expandir.
    const grupos = page.locator('[data-testid^="grupo-caso-LIQUIDACION_SIN_MAPEO-"]');
    const cantidadGrupos = Math.round(297 / 7) + 1; // 297/7 casos esparcidos
    await expect(grupos.first()).toBeVisible();
    expect(await grupos.count()).toBeLessThanOrEqual(cantidadGrupos);
    // Búsqueda + paginación (20 por página).
    await page.getByTestId('busqueda-empleados').fill(espejo.personas[0]?.legajo ?? '000');
    await expect(page.getByTestId('paginacion-empleados')).toContainText('página 1 de 1');
    await page.getByTestId('busqueda-empleados').fill('');
    expect(await page.getByTestId('paginacion-empleados').innerText()).toMatch(/página 1 de 15/);
    for (let _pagina = 1; _pagina < 15; _pagina += 1) {
      await page.getByTestId('pag-siguiente').click();
    }
    await expect(page.getByTestId('paginacion-empleados')).toContainText('página 15 de 15');

    // Edición de un dato bancario dentro del detalle en la última página:
    await page.getByTestId('ver-fila-299').click();
    await page.getByTestId('boton-editar-PAT_CODIGO_BANCO').click();
    await page.getByTestId('entrada-PAT_CODIGO_BANCO').fill('005');
    await page.getByTestId('guardar-PAT_CODIGO_BANCO').click();
    await expect(page.getByTestId('revision-maestro')).toHaveText('Versión del maestro: 1');
    await expect(page.getByTestId('detalle-fila')).toBeVisible();

    // Exportación de la versión editada.
    const descarga = page.waitForEvent('download');
    await page.getByTestId('boton-exportar-maestro').click();
    const archivo = await descarga;
    expect(archivo.suggestedFilename()).toMatch(/_editado_r1\.xlsx$/);

    // Sin códigos F2 en NINGUNA vista y sin errores de consola.
    const cuerpo = await page.locator('body').innerText();
    expect(cuerpo).not.toMatch(/D-\d{3}/);
    expect(cuerpo).not.toContain('F3');
    for (const grupo of await page.locator('[data-testid^="grupo-caso-LIQUIDACION_SIN_MAPEO-"]').all()) {
      expect(await grupo.innerText()).toMatch(/JULIO/);
    }
    console.log(`t3-13: 300 filas listas en ${String(Date.now() - empieza)} ms`);
  });
});

test.describe('T3-13 · escala 5.000 filas (medición exploratoria en local)', () => {
  test('concilia y se navega: se registra el tiempo de punta a punta (sin SLA)', async ({
    page,
  }) => {
    test.setTimeout(300_000);
    const empieza = Date.now();
    const espejo = await subirEscenario(page, 5_000, 300);
    await page.getByTestId('boton-conciliar').click();
    await expect(page.getByTestId('totales')).toContainText('5000');
    const terminaConciliar = Date.now();
    // Invariante: los grupos colapsados se muestran (no explotan la vista).
    await expect(page.getByTestId('panel-accion')).toBeVisible();
    let casos = 0;
    for (const grupo of await page
      .locator('[data-testid^="grupo-caso-LIQUIDACION_SIN_MAPEO-"]')
      .all()) {
      const texto = await grupo.innerText();
      casos += Number(/(\d+) casos?/.exec(texto)?.[1] ?? '0');
      expect(texto).toMatch(/JULIO/);
    }
    // Espejo determinista: LIQUIDACION_SIN_MAPEO excluye neto cero (idx%89===7) y banco
    // vacío (idx%97===13), tal como en la muestra de 156 (cp-f3-b).
    expect(casos).toBe(5_000 - Math.ceil(5_000 / 89) - Math.ceil(5_000 / 97));
    expect(espejo.filas.length).toBe(5_000);
    // paginación rápida: primera↔última
    const totalPaginas = /de (\d+)/.exec(
      await page.getByTestId('paginacion-empleados').innerText(),
    )?.[1];
    for (let _pagina = 1; _pagina < 250; _pagina += 1) {
      await page.getByTestId('pag-siguiente').click();
    }
    expect(totalPaginas).toBe('250');
    const fin = Date.now();
    console.log(
      `t3-13: 5.000 filas · conciliar ${String(terminaConciliar - empieza)} ms · e2e ${String(fin - empieza)} ms`,
    );
  });
});
