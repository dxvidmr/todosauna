import { expect, test } from '@playwright/test';
import { forceAnonMode, waitForSessionReady } from './helpers/participacion';
import { UUID_REGEX } from './helpers/constants';

test.describe('F10.1 smoke - testimonio submit', () => {
  test('submits a testimony successfully and shows generated id', async ({ page }) => {
    await page.goto('/');
    await waitForSessionReady(page);
    await forceAnonMode(page);

    await page.goto('/participa/testimonios/enviar/');
    await waitForSessionReady(page);

    await page.fill('#testimonio-titulo', 'Testimonio E2E');
    await page.fill('#testimonio-texto', 'Este es un testimonio de prueba automatizada.');
    await page.check('#testimonio-consent');
    await page.click('#btn-enviar-testimonio');

    await expect(page.locator('#testimonio-success')).toBeVisible();
    const idText = (await page.locator('#testimonio-success-id').textContent())?.trim() || '';
    expect(idText).toMatch(UUID_REGEX);
  });
});
