import { expect, test, Page } from '@playwright/test';
import { waitForSessionReady } from './helpers/participacion';

async function waitForGlobalSearch(page: Page, query: string): Promise<void> {
  await page.goto(`/search/?q=${encodeURIComponent(query)}`);
  await expect(page.locator('#lunrStatus')).toContainText('documentos indexados.', { timeout: 30000 });
}

async function openLecturaSearch(page: Page): Promise<void> {
  await page.goto('/lectura/');
  await waitForSessionReady(page);
  await page.waitForSelector('#TEI tei-l, #TEI l', { timeout: 30000 });
  await page.locator('.tab-button[data-tab="navegación"]').click();
  await expect(page.locator('#lectura-search-input')).toBeVisible();
}

async function runLecturaSearch(page: Page, query: string): Promise<void> {
  const input = page.locator('#lectura-search-input');
  const status = page.locator('#lectura-search-status');
  const expectedStatus = `resultado(s) para "${query}".`;
  const deadline = Date.now() + 30000;

  while (Date.now() < deadline) {
    await input.fill(query);
    await page.waitForTimeout(250);
    const statusText = await status.textContent();
    if (statusText?.includes(expectedStatus)) return;
  }

  throw new Error(`La búsqueda de lectura no se completó para "${query}".`);
}

test.describe('Lunr exact search', () => {
  test('global search matches exact phrases but not separated terms', async ({ page }) => {
    await waitForGlobalSearch(page, 'Todos a una');
    await expect(page.locator('#lunrResults')).toContainText('resultado(s) para');
    await expect(page.locator('#lunrResults')).toContainText('Todos a una');

    await waitForGlobalSearch(page, 'Todos Fuenteovejuna');
    await expect(page.locator('#lunrResults')).toContainText('No se encontraron resultados');
  });

  test('lectura search matches exact phrases and complete words', async ({ page }) => {
    await openLecturaSearch(page);

    await runLecturaSearch(page, 'honra vuestra');
    await expect(page.locator('#lectura-search-results')).toContainText('advertid que es honra vuestra');

    await runLecturaSearch(page, 'honra honrado');
    await expect(page.locator('#lectura-search-status')).toHaveText('0 resultado(s) para "honra honrado".');
    await expect(page.locator('#lectura-search-results')).toContainText('Sin resultados');

    await runLecturaSearch(page, 'honrado');
    await expect(page.locator('#lectura-search-results')).toContainText('que es un honrado zagal');

    await runLecturaSearch(page, 'honra');
    await expect(page.locator('#lectura-search-results')).not.toContainText('que es un honrado zagal');
  });
});
