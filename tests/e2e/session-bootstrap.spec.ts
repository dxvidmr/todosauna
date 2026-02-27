import { expect, test } from '@playwright/test';
import { waitForSessionReady } from './helpers/participacion';
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
});
