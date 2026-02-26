import { Page } from '@playwright/test';

export async function waitForSessionReady(page: Page): Promise<void> {
  await page.waitForFunction(async () => {
    if (!window.Participacion || !window.Participacion.session) return false;
    await window.Participacion.session.init();
    const state = window.Participacion.session.getState();
    return !!(state && state.sessionId && state.browserSessionToken);
  });
}

export async function forceAnonMode(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await window.Participacion.session.init();
    await window.Participacion.session.setAnonimo();
  });
}
