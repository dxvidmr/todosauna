import { expect, test } from '@playwright/test';
import { forceAnonMode, waitForSessionReady } from './helpers/participacion';

test('lectura mounts the shared note panel dock and records a note evaluation', async ({ page }) => {
  await page.goto('/lectura/');
  await expect(page.locator('#ta-modal-root')).toHaveCount(1);
  await waitForSessionReady(page);
  await forceAnonMode(page);

  await page.waitForSelector('#TEI [data-note-groups]');

  await page.locator('#TEI [data-note-groups]').first().click();

  const noteContent = page.locator('#noteContent');
  await expect(noteContent.locator('.note-panel-layout')).toBeVisible();
  await expect(noteContent.locator('.note-eval-dock .btn-mejorable')).toBeVisible();

  await noteContent.locator('.note-eval-dock .btn-mejorable').click();
  await expect(noteContent.locator('.note-eval-dock textarea')).toHaveValue('');
  await noteContent.locator('.note-eval-dock .btn-enviar-comentario').click();
  await expect(noteContent.locator('.note-eval-dock .nota-ya-evaluada')).toBeVisible();
});
