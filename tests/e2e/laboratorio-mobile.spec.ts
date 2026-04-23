import { expect, test, Page } from '@playwright/test';
import { forceAnonMode, waitForSessionReady } from './helpers/participacion';

type ViewportCase = {
  height: number;
  name: string;
  width: number;
};

const narrowViewports: ViewportCase[] = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet-portrait', width: 768, height: 1024 }
];

async function startLaboratorioSecuencial(page: Page): Promise<void> {
  await page.goto('/participa/laboratorio/');
  await waitForSessionReady(page);
  await page.waitForFunction(() => !!(window as any).editorSocial);
  await forceAnonMode(page);
  await page.evaluate(async () => {
    const editor = (window as any).editorSocial;
    await editor.iniciarModoSecuencial();
  });
  await page.waitForSelector('#tei-pasaje');
}

async function ensureJugablePasaje(page: Page, minNotes: number): Promise<void> {
  await page.evaluate(async ({ minNotes }) => {
    const editor = (window as any).editorSocial;

    for (let i = editor.pasajeActualIndex; i < editor.pasajes.length; i += 1) {
      if (i !== editor.pasajeActualIndex) {
        await editor.cargarPasaje(i);
      }

      const container = document.querySelector('.pasaje-container');
      const hasScroll = container instanceof HTMLElement
        ? container.scrollHeight > container.clientHeight
        : false;
      const hasNotes = Array.isArray(editor.notasPasaje) && editor.notasPasaje.length >= minNotes;

      if (hasScroll && hasNotes) {
        return;
      }
    }

    throw new Error(`No se encontró un pasaje con al menos ${minNotes} notas y scroll propio.`);
  }, { minNotes });

  await page.waitForSelector('.pasaje-container [data-note-groups]');
}

for (const viewport of narrowViewports) {
  test(`narrow laboratorio keeps passage scrollable and uses a closeable note sheet on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await startLaboratorioSecuencial(page);
    await ensureJugablePasaje(page, 1);

    await expect(page.locator('#btn-notas-sheet-toggle')).toBeVisible();
    await expect(page.locator('.laboratorio-wrapper')).toHaveAttribute('data-lab-notes-open', 'false');

    const canScrollPassage = await page.locator('.pasaje-container').evaluate((element) => {
      if (!(element instanceof HTMLElement)) return false;
      element.scrollTop = 160;
      return element.scrollTop > 0;
    });

    expect(canScrollPassage).toBe(true);
    expect(await page.evaluate(() => window.getComputedStyle(document.body).overflow)).toBe('hidden');

    await page.locator('#btn-notas-sheet-toggle').click();
    await expect(page.locator('.laboratorio-wrapper')).toHaveAttribute('data-lab-notes-open', 'true');
    await expect(page.locator('#btn-notas-cerrar')).toBeVisible();

    await page.locator('#btn-notas-cerrar').click();
    await expect(page.locator('.laboratorio-wrapper')).toHaveAttribute('data-lab-notes-open', 'false');
  });
}

test('highlight tap opens the note sheet and a useful vote advances to the next pending note', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startLaboratorioSecuencial(page);
  await ensureJugablePasaje(page, 2);

  await page.locator('.pasaje-container [data-note-groups]').first().click();
  await expect(page.locator('.laboratorio-wrapper')).toHaveAttribute('data-lab-notes-open', 'true');
  await expect(page.locator('.note-eval-dock .btn-util')).toBeVisible();

  const initialIndexText = await page.locator('#nota-actual-index').textContent();
  const initialIndex = Number(initialIndexText || '0');

  await page.locator('.note-eval-dock .btn-util').click();
  await expect(page.locator('#notas-evaluadas')).toHaveText('1');
  await page.waitForFunction((previousIndex) => {
    return Number(document.getElementById('nota-actual-index')?.textContent || '0') !== previousIndex;
  }, initialIndex);
  await expect(page.locator('.laboratorio-wrapper')).toHaveAttribute('data-lab-notes-open', 'true');
});

test('touch text selection exposes the anchored suggestion CTA and opens the suggestion modal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startLaboratorioSecuencial(page);
  await ensureJugablePasaje(page, 1);

  await page.evaluate(() => {
    const container = document.querySelector('.pasaje-container');
    if (!(container instanceof HTMLElement)) {
      throw new Error('No se encontró el contenedor del pasaje.');
    }

    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const text = node.textContent || '';
          const parent = node.parentElement;

          if (!parent) return NodeFilter.FILTER_REJECT;
          if (text.trim().length < 12) return NodeFilter.FILTER_REJECT;
          if (!parent.closest('tei-l, tei-p, tei-stage, tei-seg')) return NodeFilter.FILTER_REJECT;
          if (parent.closest('.note-wrapper, .sugerencia-tooltip, .sugerencia-modal')) {
            return NodeFilter.FILTER_REJECT;
          }

          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const textNode = walker.nextNode();
    if (!textNode) {
      throw new Error('No se encontró un fragmento seleccionable para sugerir una nota.');
    }

    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, Math.min(12, textNode.textContent?.length || 12));

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
    textNode.parentElement?.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true,
      pointerType: 'touch'
    }));
  });

  await expect(page.locator('.sugerencia-tooltip.is-anchored')).toBeVisible();
  await page.locator('.sugerencia-tooltip.is-anchored .btn-sugerir-nota').click();
  await expect(page.locator('.sugerencia-modal.show')).toBeVisible();
  await expect(page.locator('#sugerencia-texto')).not.toHaveText('');
});
