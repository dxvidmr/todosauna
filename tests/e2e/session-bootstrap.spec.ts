import { expect, test } from '@playwright/test';
import { forceAnonMode, waitForSessionReady } from './helpers/participacion';
import { UUID_REGEX } from './helpers/constants';

test.describe('F10.1 smoke - session bootstrap', () => {
  test('reuses browser session token between / and /lectura/', async ({ page, context }) => {
    await page.goto('/');
    await waitForSessionReady(page);

    const firstState = await page.evaluate(() => window.Participacion.session.getState());
    expect(firstState.sessionId).toMatch(UUID_REGEX);
    expect(firstState.browserSessionToken).toMatch(UUID_REGEX);

    const firstCookie = (await context.cookies()).find((cookie) => cookie.name === 'ta_browser_session_token');
    expect(firstCookie?.value).toMatch(UUID_REGEX);

    await page.goto('/lectura/');
    await waitForSessionReady(page);

    const secondState = await page.evaluate(() => window.Participacion.session.getState());
    expect(secondState.sessionId).toBe(firstState.sessionId);
    expect(secondState.browserSessionToken).toBe(firstState.browserSessionToken);

    const secondCookie = (await context.cookies()).find((cookie) => cookie.name === 'ta_browser_session_token');
    expect(secondCookie?.value).toBe(firstCookie?.value);
  });

  test('rotates session id and browser token on resetToUnasked()', async ({ page, context }) => {
    await page.goto('/lectura/');
    await waitForSessionReady(page);
    await forceAnonMode(page);

    const beforeState = await page.evaluate(() => window.Participacion.session.getState());
    expect(beforeState.sessionId).toMatch(UUID_REGEX);
    expect(beforeState.browserSessionToken).toMatch(UUID_REGEX);

    const beforeCookie = (await context.cookies()).find((cookie) => cookie.name === 'ta_browser_session_token');
    expect(beforeCookie?.value).toBe(beforeState.browserSessionToken);

    const resetState = await page.evaluate(async () => {
      const before = window.Participacion.session.getState();
      const result = await window.Participacion.session.resetToUnasked();
      const after = window.Participacion.session.getState();
      return { before, after, result };
    });

    expect(resetState.result.ok).toBe(true);
    expect(resetState.after.sessionId).toMatch(UUID_REGEX);
    expect(resetState.after.browserSessionToken).toMatch(UUID_REGEX);
    expect(resetState.after.sessionId).not.toBe(resetState.before.sessionId);
    expect(resetState.after.browserSessionToken).not.toBe(resetState.before.browserSessionToken);
    expect(resetState.after.modeChoice).toBe('unasked');
    expect(resetState.after.modoParticipacion).toBe('anonimo');

    const afterCookie = (await context.cookies()).find((cookie) => cookie.name === 'ta_browser_session_token');
    expect(afterCookie?.value).toBe(resetState.after.browserSessionToken);
    expect(afterCookie?.value).not.toBe(beforeCookie?.value);
  });
});
