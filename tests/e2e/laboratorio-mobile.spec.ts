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

const MOBILE_SHELL = '[data-lab-shell="mobile"][data-shell-visible="true"]';
const DESKTOP_SHELL = '[data-lab-shell="desktop"]';

async function startLaboratorioSecuencial(page: Page): Promise<void> {
  await page.goto('/participa/laboratorio/sesion/?modo=secuencial');
  await expect(page.locator('#ta-modal-root')).toHaveCount(1);
  await waitForSessionReady(page);
  await page.waitForFunction(() => !!(window as any).editorSocial);
  await forceAnonMode(page);
  await page.waitForSelector('#tei-pasaje');
}

async function ensureJugablePasaje(page: Page, minNotes: number): Promise<void> {
  await page.evaluate(async ({ minNotes }) => {
    const editor = (window as any).editorSocial;

    for (let i = editor.pasajeActualIndex; i < editor.pasajes.length; i += 1) {
      if (i !== editor.pasajeActualIndex) {
        await editor.cargarPasaje(i);
      }

      const container = editor.getPasajeContainer?.();
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

  await page.waitForSelector(`${MOBILE_SHELL} [data-note-groups]`);
}

test('starting laboratorio with an active session does not force the participation modal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/participa/laboratorio/');
  await expect(page.locator('#ta-modal-root')).toHaveCount(1);
  await waitForSessionReady(page);
  await forceAnonMode(page);

  await page.locator('[data-lab-start-mode][data-modo="secuencial"]').click();

  await page.waitForURL('**/participa/laboratorio/sesion/?modo=secuencial');
  await page.waitForSelector('#tei-pasaje');
  await expect(page.locator('.laboratorio-wrapper')).toHaveAttribute('data-laboratorio-view', 'mode');
  await expect(page.locator('#modal-modo.show')).toHaveCount(0);
});

for (const viewport of narrowViewports) {
  test(`mobile shell stays independent and keeps passage scrollable on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await startLaboratorioSecuencial(page);
    await ensureJugablePasaje(page, 1);

    const mobileShell = page.locator(MOBILE_SHELL);
    const desktopShell = page.locator(DESKTOP_SHELL);

    await expect(page.locator('.laboratorio-wrapper')).toHaveAttribute('data-lab-layout', 'narrow');
    await expect(mobileShell).toBeVisible();
    await expect(desktopShell).toBeHidden();

    const title = mobileShell.locator('.laboratorio-mobile-header h1');
    const controlsCard = mobileShell.locator('.laboratorio-mobile-controls-card');
    const controlsRow = mobileShell.locator('.laboratorio-mobile-controls-row');
    const nextButton = mobileShell.locator('[data-lab-next-passage]');
    const modeBadge = mobileShell.locator('[data-lab-mode-badge]');
    const changeMode = mobileShell.locator('[data-lab-change-mode]');
    const progressCopy = mobileShell.locator('.laboratorio-mobile-progress-copy');
    const menuToggle = page.locator('.nav-wrapper[data-navbar-variant="compact"] .navbar-toggler');

    const titleBox = await title.boundingBox();
    const controlsCardBox = await controlsCard.boundingBox();
    const controlsRowBox = await controlsRow.boundingBox();
    const nextButtonBox = await nextButton.boundingBox();
    const modeBadgeBox = await modeBadge.boundingBox();
    const changeModeBox = await changeMode.boundingBox();
    const progressCopyBox = await progressCopy.boundingBox();
    const menuToggleBox = await menuToggle.boundingBox();
    const iconMetrics = await page.evaluate(() => {
      const rootStyle = window.getComputedStyle(document.documentElement);
      const rootFontSize = parseFloat(window.getComputedStyle(document.documentElement).fontSize || '16');

      const toPx = (value: string): number => {
        const trimmed = String(value || '').trim();
        if (!trimmed) return 0;
        if (trimmed.endsWith('rem')) return parseFloat(trimmed) * rootFontSize;
        if (trimmed.endsWith('px')) return parseFloat(trimmed);
        return parseFloat(trimmed) || 0;
      };

      return {
        lineThickness: toPx(rootStyle.getPropertyValue('--compact-navbar-icon-line-thickness')),
        lineOffset: toPx(rootStyle.getPropertyValue('--compact-navbar-icon-line-offset'))
      };
    });

    expect(titleBox).not.toBeNull();
    expect(controlsCardBox).not.toBeNull();
    expect(controlsRowBox).not.toBeNull();
    expect(nextButtonBox).not.toBeNull();
    expect(modeBadgeBox).not.toBeNull();
    expect(changeModeBox).not.toBeNull();
    expect(progressCopyBox).not.toBeNull();
    expect(menuToggleBox).not.toBeNull();

    expect(titleBox!.y).toBeLessThan(controlsCardBox!.y);
    expect(
      Math.abs(
        titleBox!.y - (
          menuToggleBox!.y +
          ((menuToggleBox!.height - iconMetrics.lineThickness) / 2) -
          iconMetrics.lineOffset
        )
      )
    ).toBeLessThan(4);
    expect(Math.abs(nextButtonBox!.y - modeBadgeBox!.y)).toBeLessThan(16);
    expect(Math.abs(changeModeBox!.y - modeBadgeBox!.y)).toBeLessThan(16);
    expect(progressCopyBox!.y).toBeGreaterThan(controlsRowBox!.y + controlsRowBox!.height - 4);

    const footer = mobileShell.locator('.laboratorio-mobile-footer');
    await expect(footer).toBeVisible();

    const footerBox = await footer.boundingBox();
    expect(footerBox).not.toBeNull();
    expect(Math.abs(viewport.height - (footerBox!.y + footerBox!.height))).toBeLessThan(22);

    const titleBeforeScroll = await mobileShell.locator('.lab-pasaje-titulo').boundingBox();
    const canScrollPassage = await page.evaluate(() => {
      const container = (window as any).editorSocial?.getPasajeContainer?.();
      if (!(container instanceof HTMLElement)) return false;
      container.scrollTop = 220;
      return container.scrollTop > 0;
    });
    expect(canScrollPassage).toBe(true);
    expect(await page.evaluate(() => window.getComputedStyle(document.body).overflow)).toBe('hidden');

    const titleAfterScroll = await mobileShell.locator('.lab-pasaje-titulo').boundingBox();
    expect(titleBeforeScroll).not.toBeNull();
    expect(titleAfterScroll).not.toBeNull();
    expect(titleAfterScroll!.y).toBeLessThan(titleBeforeScroll!.y - 40);

    const passageBoxBeforeOpen = await mobileShell.locator('[data-lab-pasaje-container]').boundingBox();
    await mobileShell.locator('[data-lab-notes-toggle]').click();
    await expect(page.locator('.laboratorio-wrapper')).toHaveAttribute('data-lab-notes-open', 'true');
    await expect(mobileShell.locator('[data-lab-notes-close]')).toBeVisible();

    const passageBoxAfterOpen = await mobileShell.locator('[data-lab-pasaje-container]').boundingBox();
    expect(passageBoxBeforeOpen).not.toBeNull();
    expect(passageBoxAfterOpen).not.toBeNull();
    expect(Math.abs(passageBoxAfterOpen!.y - passageBoxBeforeOpen!.y)).toBeLessThan(2);

    await mobileShell.locator('[data-lab-notes-close]').click();
    await expect(page.locator('.laboratorio-wrapper')).toHaveAttribute('data-lab-notes-open', 'false');
  });
}

test('highlight tap opens the mobile note sheet and a useful vote advances to the next pending note', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startLaboratorioSecuencial(page);
  await ensureJugablePasaje(page, 2);

  const mobileShell = page.locator(MOBILE_SHELL);
  await mobileShell.locator('[data-note-groups]').first().click();
  await expect(page.locator('.laboratorio-wrapper')).toHaveAttribute('data-lab-notes-open', 'true');
  await expect(mobileShell.locator('.note-eval-dock .btn-util')).toBeVisible();

  const noteIndexLocator = mobileShell.locator('.laboratorio-mobile-note-sheet [data-lab-note-index]');
  const initialIndex = Number((await noteIndexLocator.textContent()) || '0');

  await mobileShell.locator('.note-eval-dock .btn-util').click();
  await expect(mobileShell.locator('[data-lab-notes-evaluated-resumen]')).toHaveText('1');
  await page.waitForFunction((previousIndex) => {
    const noteIndex = document.querySelector('[data-lab-shell="mobile"] .laboratorio-mobile-note-sheet [data-lab-note-index]');
    return Number(noteIndex?.textContent || '0') !== previousIndex;
  }, initialIndex);
  await expect(page.locator('.laboratorio-wrapper')).toHaveAttribute('data-lab-notes-open', 'true');
});

test('dragging the mobile sheet handle downward closes the note sheet', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startLaboratorioSecuencial(page);
  await ensureJugablePasaje(page, 1);

  const mobileShell = page.locator(MOBILE_SHELL);
  await mobileShell.locator('[data-lab-notes-toggle]').click();
  await expect(page.locator('.laboratorio-wrapper')).toHaveAttribute('data-lab-notes-open', 'true');

  const handle = mobileShell.locator('[data-lab-note-drag-handle]');
  const handleBox = await handle.boundingBox();
  expect(handleBox).not.toBeNull();

  await page.mouse.move(handleBox!.x + (handleBox!.width / 2), handleBox!.y + (handleBox!.height / 2));
  await page.mouse.down();
  await page.mouse.move(
    handleBox!.x + (handleBox!.width / 2),
    handleBox!.y + (handleBox!.height / 2) + 170,
    { steps: 8 }
  );
  await page.mouse.up();

  await expect(page.locator('.laboratorio-wrapper')).toHaveAttribute('data-lab-notes-open', 'false');
});

test('touch text selection replaces the collapsed note footer with the anchored suggestion CTA', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startLaboratorioSecuencial(page);
  await ensureJugablePasaje(page, 1);

  const mobileShell = page.locator(MOBILE_SHELL);
  await expect(mobileShell.locator('.laboratorio-mobile-footer')).toBeVisible();

  await page.evaluate(() => {
    const container = (window as any).editorSocial?.getPasajeContainer?.();
    if (!(container instanceof HTMLElement)) {
      throw new Error('No se encontró el contenedor activo del pasaje.');
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

  await expect(page.locator('.laboratorio-wrapper')).toHaveAttribute('data-lab-suggestion-active', 'true');
  await expect(page.locator('.sugerencia-tooltip.is-anchored')).toBeVisible();
  await expect(mobileShell.locator('.laboratorio-mobile-footer')).toBeHidden();

  const ctaBox = await page.locator('.sugerencia-tooltip.is-anchored .btn-sugerir-nota').boundingBox();
  expect(ctaBox).not.toBeNull();
  expect(ctaBox!.width).toBeGreaterThan(300);
  expect(Math.abs(844 - (ctaBox!.y + ctaBox!.height))).toBeLessThan(24);

  await page.locator('.sugerencia-tooltip.is-anchored .btn-sugerir-nota').click();
  const modal = page.locator('.sugerencia-modal.show');
  await expect(modal).toBeVisible();
  await expect(page.locator('#ta-modal-root .sugerencia-modal')).toBeVisible();
  await expect(modal.locator('.modal-header')).toBeVisible();
  await expect(modal.locator('.modal-shell-close .fa-xmark')).toBeVisible();
  await expect(modal.locator('#sugerencia-texto')).not.toHaveText('');

  const cancelBox = await modal.locator('.btn-cancelar-sugerencia').boundingBox();
  const submitBox = await modal.locator('.btn-enviar-sugerencia').boundingBox();
  expect(cancelBox).not.toBeNull();
  expect(submitBox).not.toBeNull();
  expect(Math.abs(cancelBox!.y - submitBox!.y)).toBeLessThan(8);

  await modal.locator('.modal-shell-close').click();
  await expect(modal).toBeHidden();
  await expect(mobileShell.locator('.laboratorio-mobile-footer')).toBeVisible();
});
