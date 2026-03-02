import { expect, test, Page } from '@playwright/test';
import { forceAnonMode, waitForSessionReady } from './helpers/participacion';

type TeiMetrics = {
  fontSize: number;
  lineHeight: number;
  display: string;
};

async function getLecturaMetrics(page: Page): Promise<TeiMetrics> {
  await page.goto('/lectura/');
  await waitForSessionReady(page);
  await page.waitForSelector('.text-column');

  return page.evaluate(() => {
    const textColumn = document.querySelector('.text-column');
    const display = document.getElementById('font-size-display');

    if (!(textColumn instanceof HTMLElement) || !(display instanceof HTMLElement)) {
      throw new Error('No se encontraron los controles de lectura');
    }

    const styles = window.getComputedStyle(textColumn);
    return {
      fontSize: parseFloat(styles.fontSize),
      lineHeight: parseFloat(styles.lineHeight),
      display: display.textContent?.trim() || ''
    };
  });
}

async function startLaboratorioSecuencial(page: Page): Promise<void> {
  await page.goto('/participa/laboratorio/');
  await waitForSessionReady(page);
  await page.waitForFunction(() => !!window.editorSocial);
  await forceAnonMode(page);
  await page.evaluate(async () => {
    await window.editorSocial.iniciarModoSecuencial();
  });
  await page.waitForSelector('#tei-pasaje');
  await page.waitForFunction(() => {
    const tei = document.getElementById('tei-pasaje');
    return !!tei && !!tei.style.getPropertyValue('--tei-text-zoom-percent');
  });
}

async function getLaboratorioMetrics(page: Page): Promise<TeiMetrics> {
  await startLaboratorioSecuencial(page);

  return page.evaluate(() => {
    const tei = document.getElementById('tei-pasaje');
    const display = document.getElementById('lab-font-size-display');

    if (!(tei instanceof HTMLElement) || !(display instanceof HTMLElement)) {
      throw new Error('No se encontraron los controles de laboratorio');
    }

    const styles = window.getComputedStyle(tei);
    return {
      fontSize: parseFloat(styles.fontSize),
      lineHeight: parseFloat(styles.lineHeight),
      display: display.textContent?.trim() || ''
    };
  });
}

test.describe('TEI shared typography', () => {
  test('lectura and laboratorio share the same base font-size and line-height', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });

    const lecturaMetrics = await getLecturaMetrics(page);
    const laboratorioMetrics = await getLaboratorioMetrics(page);

    expect(lecturaMetrics.display).toBe('100%');
    expect(laboratorioMetrics.display).toBe('100%');
    expect(lecturaMetrics.fontSize).toBeCloseTo(laboratorioMetrics.fontSize, 1);
    expect(lecturaMetrics.lineHeight).toBeCloseTo(laboratorioMetrics.lineHeight, 1);
    expect(lecturaMetrics.lineHeight / lecturaMetrics.fontSize).toBeCloseTo(1.6, 1);
    expect(laboratorioMetrics.lineHeight / laboratorioMetrics.fontSize).toBeCloseTo(1.6, 1);
  });

  test('first zoom step is shared in lectura and laboratorio', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });

    await page.goto('/lectura/');
    await waitForSessionReady(page);
    await page.evaluate(() => {
      document.getElementById('increase-font')?.click();
    });
    await expect(page.locator('#font-size-display')).toHaveText('105%');

    await startLaboratorioSecuencial(page);
    await page.evaluate(() => {
      document.getElementById('lab-font-increase')?.click();
    });
    await expect(page.locator('#lab-font-size-display')).toHaveText('105%');
  });

  test('lectura no applies a smaller mobile-only base than laboratorio', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const lecturaMetrics = await getLecturaMetrics(page);
    const laboratorioMetrics = await getLaboratorioMetrics(page);

    expect(lecturaMetrics.display).toBe('100%');
    expect(laboratorioMetrics.display).toBe('100%');
    expect(lecturaMetrics.fontSize).toBeCloseTo(laboratorioMetrics.fontSize, 1);
    expect(lecturaMetrics.lineHeight).toBeCloseTo(laboratorioMetrics.lineHeight, 1);
  });
});
