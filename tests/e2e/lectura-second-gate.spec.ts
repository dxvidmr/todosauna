import { expect, test } from '@playwright/test';
import { waitForSessionReady } from './helpers/participacion';

test.describe('F10.1 smoke - lectura second contribution gate', () => {
  test('allows first contribution and prompts on second when mode is unasked', async ({ page }) => {
    await page.goto('/lectura/');
    await waitForSessionReady(page);

    const resetState = await page.evaluate(async () => {
      const before = window.Participacion.session.getState();
      const result = await window.Participacion.session.resetToUnasked();
      const after = window.Participacion.session.getState();
      const state = after;
      const key = `ta_lectura_contrib_count::${state.browserSessionToken || state.sessionId}`;
      localStorage.removeItem(key);
      return { before, after, result };
    });

    expect(resetState.result.ok).toBe(true);
    expect(resetState.after.sessionId).not.toBe(resetState.before.sessionId);
    expect(resetState.after.browserSessionToken).not.toBe(resetState.before.browserSessionToken);
    expect(resetState.after.modeChoice).toBe('unasked');

    const firstAttempt = await page.evaluate(async () => {
      return await window.Participacion.flow.ensureModeForSecondLecturaContribution();
    });
    expect(firstAttempt).toBe(true);

    await page.evaluate(() => {
      window.Participacion.flow.incrementLecturaParticipationCount();
    });

    const secondAttemptPromise = page.evaluate(async () => {
      return await window.Participacion.flow.ensureModeForSecondLecturaContribution();
    });

    await expect(page.locator('#modal-modo.show')).toBeVisible();
    await expect(page.locator('#modal-modo')).toHaveAttribute('data-context', 'lectura-second-contribution');

    await page.locator('#modal-modo .modo-opcion[data-modo="anonimo"]').click();
    await page.locator('#form-anonimo-datos button[type="submit"]').click();

    await expect(page.locator('#modal-modo')).not.toHaveClass(/show/);
    await expect(secondAttemptPromise).resolves.toBe(true);
  });
});
