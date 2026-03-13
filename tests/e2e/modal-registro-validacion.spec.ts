import { expect, test } from '@playwright/test';

async function openRegistroModal(page: import('@playwright/test').Page) {
  await page.goto('/');

  await page.evaluate(async () => {
    await window.Participacion.session.init();
    window.Participacion.modal.open({
      context: 'participa-form-access',
      reason: 'e2e-registro-validacion'
    });
  });

  await page.click('.modo-opcion[data-modo="colaborador"]');
  await page.click('.modo-opcion[data-tipo="registro"]');
}

test.describe('F10.1 smoke - validacion registro colaborador', () => {
  test('muestra error visible cuando los emails no coinciden', async ({ page }) => {
    await openRegistroModal(page);

    await page.fill('#form-colaborador-registro-datos input[name="email"]', 'a@example.com');
    await page.fill('#form-colaborador-registro-datos input[name="confirm_email"]', 'b@example.com');
    await page.check('#registro-privacy-consent');
    await page.click('#form-colaborador-registro-datos button[type="submit"]');
    await expect(page.locator('#form-colaborador-registro-status')).toBeVisible();
    await expect(page.locator('#form-colaborador-registro-status')).toContainText('emails no coinciden');
    await expect(page.locator('#form-colaborador-registro-datos')).toBeVisible();
  });

  test('bloquea el registro si no se acepta privacidad', async ({ page }) => {
    await openRegistroModal(page);

    await page.fill('#form-colaborador-registro-datos input[name="email"]', 'a@example.com');
    await page.fill('#form-colaborador-registro-datos input[name="confirm_email"]', 'a@example.com');
    await page.click('#form-colaborador-registro-datos button[type="submit"]');

    const validationMessage = await page.$eval(
      '#form-colaborador-registro-datos input[name="privacy_consent"]',
      (el) => (el as HTMLInputElement).validationMessage
    );

    expect(validationMessage.trim().length).toBeGreaterThan(0);
    await expect(page.locator('#form-colaborador-registro-status')).toBeVisible();
  });

  test('bloquea el registro con año fuera de rango', async ({ page }) => {
    await openRegistroModal(page);

    await page.fill('#form-colaborador-registro-datos input[name="email"]', 'a@example.com');
    await page.fill('#form-colaborador-registro-datos input[name="confirm_email"]', 'a@example.com');
    await page.check('#registro-privacy-consent');

    await page.locator('details.modal-optional-group').first().locator('summary').click();
    await page.fill('#form-colaborador-registro-datos input[name="anio_nacimiento"]', '1800');
    await page.click('#form-colaborador-registro-datos button[type="submit"]');

    const validationMessage = await page.$eval(
      '#form-colaborador-registro-datos input[name="anio_nacimiento"]',
      (el) => (el as HTMLInputElement).validationMessage
    );

    expect(validationMessage.trim().length).toBeGreaterThan(0);
    await expect(page.locator('#form-colaborador-registro-status')).toBeVisible();
  });

  test('bloquea ciudad escrita sin selección GeoNames', async ({ page }) => {
    await openRegistroModal(page);

    await page.fill('#form-colaborador-registro-datos input[name="email"]', 'a@example.com');
    await page.fill('#form-colaborador-registro-datos input[name="confirm_email"]', 'a@example.com');
    await page.check('#registro-privacy-consent');

    await page.locator('details.modal-optional-group').first().locator('summary').click();
    await page.fill('#registro-city-input', 'Madrid');
    await page.click('#form-colaborador-registro-datos button[type="submit"]');

    const validationMessage = await page.$eval(
      '#registro-city-input',
      (el) => (el as HTMLInputElement).validationMessage
    );

    expect(validationMessage.trim().length).toBeGreaterThan(0);
    await expect(page.locator('#form-colaborador-registro-status')).toBeVisible();
  });
});
