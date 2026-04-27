import { expect, test } from '@playwright/test';
import { forceAnonMode, waitForSessionReady } from './helpers/participacion';

test('home evaluation card uses the shared evaluation dock and shows the overlay after voting', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#ta-modal-root')).toHaveCount(1);
  await waitForSessionReady(page);
  await forceAnonMode(page);

  const card = page.locator('[data-home-eval-card]');
  await expect(card).toBeVisible();
  await expect(card.locator('[data-home-eval-controls] .btn-util')).toBeVisible();

  await card.locator('[data-home-eval-controls] .btn-util').click();

  await expect(card.locator('[data-home-eval-controls] .nota-ya-evaluada')).toBeVisible();
  await expect(card.locator('[data-home-eval-overlay]')).toBeVisible();
});
