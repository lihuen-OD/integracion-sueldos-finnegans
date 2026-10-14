import { expect, test } from '@playwright/test';
import { E2E_ORIGIN } from '../../playwright.config.ts';

test.describe('privacidad y operación sin red', () => {
  test('solo hay pedidos al origen local y ninguna violación de CSP', async ({ page }) => {
    const requests: string[] = [];
    const cspViolations: string[] = [];
    page.on('request', (request) => requests.push(request.url()));
    page.on('console', (message) => {
      if (message.type() === 'error' && message.text().includes('Content Security Policy')) {
        cspViolations.push(message.text());
      }
    });

    await page.goto('/');
    await expect(page.getByRole('note')).toContainText('No apto para pagos');

    expect(requests.filter((url) => !url.startsWith(`${E2E_ORIGIN}/`))).toEqual([]);
    expect(cspViolations).toEqual([]);
  });

  test('la CSP de producción bloquea pedidos de red', async ({ page }) => {
    await page.goto('/');
    const csp = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute('content');
    expect(csp).toContain("connect-src 'none'");
    expect(csp).not.toContain('unsafe-eval');

    const resultado = await page.evaluate(async () => {
      try {
        await fetch('/');
        return 'permitido';
      } catch {
        return 'bloqueado';
      }
    });
    expect(resultado).toBe('bloqueado');
  });

  test('no queda nada almacenado en el navegador', async ({ page }) => {
    await page.goto('/');
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
  });
});
