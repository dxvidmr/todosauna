import { expect, test } from '@playwright/test';
import { forceAnonMode, waitForSessionReady } from './helpers/participacion';
import { UUID_REGEX } from './helpers/constants';

test.describe('F10.1 smoke - session bootstrap', () => {
  test('does not create supabase session during passive navigation', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(async () => {
      await window.Participacion.session.init();
    });

    const firstState = await page.evaluate(() => window.Participacion.session.getState());
    expect(firstState.sessionId).toBeNull();
    expect(firstState.browserSessionToken).toMatch(UUID_REGEX);

    await page.goto('/lectura/');
    await page.evaluate(async () => {
      await window.Participacion.session.init();
    });

    const secondState = await page.evaluate(() => window.Participacion.session.getState());
    expect(secondState.sessionId).toBeNull();
    expect(secondState.sessionId).toBe(firstState.sessionId);
    expect(secondState.browserSessionToken).toBe(firstState.browserSessionToken);
  });

  test('creates session only when a real write requires it', async ({ page }) => {
    await page.goto('/lectura/');
    await page.evaluate(async () => {
      await window.Participacion.session.init();
    });

    const beforeBootstrap = await page.evaluate(() => window.Participacion.session.getState());
    expect(beforeBootstrap.sessionId).toBeNull();
    expect(beforeBootstrap.browserSessionToken).toMatch(UUID_REGEX);

    const afterBootstrap = await page.evaluate(async () => {
      const ensured = await window.Participacion.session.ensureSessionForWrite();
      const state = window.Participacion.session.getState();
      return { ensured, state };
    });

    expect(afterBootstrap.ensured?.ok).toBe(true);
    expect(afterBootstrap.state.sessionId).toMatch(UUID_REGEX);
    expect(afterBootstrap.state.browserSessionToken).toBe(beforeBootstrap.browserSessionToken);
  });

  test('syncs session/mode across open tabs and resets after closing all tabs', async ({ page, context }) => {
    await page.goto('/lectura/');
    await waitForSessionReady(page);
    await forceAnonMode(page);

    const stateA = await page.evaluate(() => window.Participacion.session.getState());
    expect(stateA.sessionId).toMatch(UUID_REGEX);
    expect(stateA.modeChoice).toBe('anonimo');

    const pageB = await context.newPage();
    await pageB.goto('/lectura/');
    const stateB = await pageB.evaluate(async () => {
      await window.Participacion.session.init();
      return window.Participacion.session.getState();
    });

    expect(stateB.sessionId).toBe(stateA.sessionId);
    expect(stateB.browserSessionToken).toBe(stateA.browserSessionToken);
    expect(stateB.modeChoice).toBe('anonimo');

    await page.close();
    await pageB.close();

    const pageC = await context.newPage();
    await pageC.goto('/lectura/');
    const stateC = await pageC.evaluate(async () => {
      await window.Participacion.session.init();
      return window.Participacion.session.getState();
    });

    expect(stateC.sessionId).toBeNull();
    expect(stateC.modeChoice).toBe('unasked');
    await pageC.close();
  });

  test('resetToUnasked rotates browser token and clears active session id', async ({ page }) => {
    await page.goto('/lectura/');
    await waitForSessionReady(page);
    await forceAnonMode(page);

    const beforeState = await page.evaluate(() => window.Participacion.session.getState());
    expect(beforeState.sessionId).toMatch(UUID_REGEX);
    expect(beforeState.browserSessionToken).toMatch(UUID_REGEX);

    const resetState = await page.evaluate(async () => {
      const before = window.Participacion.session.getState();
      const result = await window.Participacion.session.resetToUnasked();
      const after = window.Participacion.session.getState();
      return { before, after, result };
    });

    expect(resetState.result.ok).toBe(true);
    expect(resetState.after.sessionId).toBeNull();
    expect(resetState.after.browserSessionToken).toMatch(UUID_REGEX);
    expect(resetState.after.browserSessionToken).not.toBe(resetState.before.browserSessionToken);
    expect(resetState.after.modeChoice).toBe('unasked');
    expect(resetState.after.modoParticipacion).toBe('anonimo');
  });
});
