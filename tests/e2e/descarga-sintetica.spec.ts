import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, test, type Download, type Page } from '@playwright/test';
import {
  filaFinnegans,
  finnegansXlsx,
  maestroXlsx,
  personas,
  registroBna,
} from '../fixtures/synthetic/escenarios.ts';
import { createRandom } from '../fixtures/synthetic/identities.ts';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function bytesDescargados(descarga: Download): Promise<Buffer> {
  const rutaTemporal = await descarga.path();
  return readFile(rutaTemporal);
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

async function prepararYDescargar(page: Page, banco: 'bna' | 'patagonia') {
  await page.getByTestId(`preparar-sintetico-${banco}`).click();
  await expect(page.getByTestId('vista-previa-sintetica')).toBeVisible();
  const hashPrevio = await page.getByTestId('sintetico-sha256').textContent();
  const descargaPendiente = page.waitForEvent('download');
  await page.getByTestId('confirmar-descarga-sintetica').click();
  const descarga = await descargaPendiente;
  const bytes = await bytesDescargados(descarga);
  return { descarga, bytes, hashPrevio };
}

test.describe('CP-F8-C · descarga sintética en build de producción', () => {
  for (const caso of [
    {
      banco: 'bna',
      nombre: 'PRUEBA_SINTETICA_BNA_GT200_NO_PRODUCTIVA.TXT',
      sha: 'b72a7e942249a75298bb6041e96b7b4d6505775d22a21f23e600adff40b426de',
    },
    {
      banco: 'patagonia',
      nombre: 'ACREXXXX.TXT',
      sha: '004140b216b76fc56b7a08ac3edde1524df8e7dd8f860ed7fbabed0ddd671a4d',
    },
  ] as const) {
    test(`prepara, confirma y descarga ${caso.banco} con bytes exactos`, async ({ page }) => {
      await page.goto('/');
      await expect(page.getByTestId('panel-descarga-sintetica')).toContainText(
        'No contienen los empleados ni los importes cargados por Recursos Humanos',
      );
      const resultado = await prepararYDescargar(page, caso.banco);
      expect(resultado.descarga.suggestedFilename()).toBe(caso.nombre);
      expect(resultado.bytes.byteLength).toBe(803);
      expect(resultado.hashPrevio?.trim()).toBe(caso.sha);
      expect(sha256(resultado.bytes)).toBe(caso.sha);
      await expect(page.getByTestId('diagnostico-sintetico')).toContainText(
        'Descarga sintética iniciada',
      );
    });
  }

  test('una corrida cargada no influye sobre los bytes sintéticos ni es alterada', async ({
    page,
  }) => {
    await page.goto('/');
    const persona = personas(1, 20261105)[0];
    if (persona === undefined) throw new Error('Falta persona sintética');
    await page.getByLabel('Archivo de la liquidación', { exact: true }).setInputFiles({
      name: 'finnegans_sintetico.xlsx',
      mimeType: XLSX_MIME,
      buffer: Buffer.from(
        finnegansXlsx([
          filaFinnegans(persona, {
            Banco: 'BANCO DE LA NACION ARGENTINA',
            Descripcion: 'PRUEBA RRHH AISLADA',
          }),
        ]),
      ),
    });
    await page.getByLabel('Archivo del maestro', { exact: true }).setInputFiles({
      name: 'maestro_sintetico.xlsx',
      mimeType: XLSX_MIME,
      buffer: Buffer.from(maestroXlsx([registroBna(persona, createRandom(20261105))])),
    });
    await expect(page.getByTestId('resumen-carga')).toContainText(
      'Finnegans: cargada · Maestro: cargado',
    );

    const resultado = await prepararYDescargar(page, 'bna');
    expect(sha256(resultado.bytes)).toBe(
      'b72a7e942249a75298bb6041e96b7b4d6505775d22a21f23e600adff40b426de',
    );
    await expect(page.getByTestId('resumen-carga')).toContainText(
      'Finnegans: cargada · Maestro: cargado',
    );
    await expect(page.getByTestId('boton-conciliar')).toBeEnabled();
  });
});
