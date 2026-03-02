import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { E2E_APPS_SCRIPT_SHARED_SECRET, UUID_REGEX } from './helpers/constants';
import { extractMultipartFields } from './helpers/multipart';
import { decodeTokenPayload, signPayload } from './helpers/token';
import { forceAnonMode, waitForSessionReady } from './helpers/participacion';

type UploadTokenPayload = {
  session_id?: string;
  staging_id?: string;
  jti?: string;
};

async function installAppsScriptMock(page: Page) {
  let uploadCounter = 0;

  await page.route('**/apps-script.local.test/**', async (route) => {
    try {
      const request = route.request();
      const method = request.method().toUpperCase();

      if (method === 'OPTIONS') {
        await route.fulfill({
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'content-type',
            'Access-Control-Allow-Methods': 'POST, OPTIONS'
          }
        });
        return;
      }

      const contentType = String(request.headers()['content-type'] || '');
      const body = request.postDataBuffer() || Buffer.from('');
      const fields = extractMultipartFields(contentType, body);

      const action = String(fields.action || '').trim().toLowerCase();
      if (action !== 'upload') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: false,
            error: {
              code: 'invalid_action',
              message: 'Only upload action is allowed in e2e mock'
            }
          })
        });
        return;
      }

      const uploadToken = String(fields.upload_token || '').trim();
      const stagingId = String(fields.staging_id || '').trim();
      const tokenPayload = decodeTokenPayload<UploadTokenPayload>(uploadToken);
      const sessionId = String(tokenPayload.session_id || '').trim();
      const tokenStagingId = String(tokenPayload.staging_id || '').trim();
      const jti = String(tokenPayload.jti || '').trim();

      uploadCounter += 1;
      const driveFileId = `drive-e2e-${uploadCounter}`;
      const mime = 'application/pdf';
      const size = 12345;
      const fileName = `archivo-e2e-${uploadCounter}.pdf`;

      const receipt = signPayload(
        {
          iss: 'todos-a-una-apps-script',
          type: 'upload_receipt',
          session_id: sessionId,
          staging_id: stagingId || tokenStagingId,
          jti: jti,
          drive_file_id: driveFileId,
          name: fileName,
          mime: mime,
          size: size,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600
        },
        E2E_APPS_SCRIPT_SHARED_SECRET
      );

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          ok: true,
          drive_file_id: driveFileId,
          name: fileName,
          mime: mime,
          size: size,
          receipt: receipt
        })
      });
    } catch (error) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        headers: {
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          ok: false,
          error: {
            code: 'e2e_mock_error',
            message: error instanceof Error ? error.message : String(error)
          }
        })
      });
    }
  });
}

test.describe('F10.1 smoke - contribucion staged', () => {
  test('uploads + finalizes + submits staged contribution', async ({ page }) => {
    await installAppsScriptMock(page);

    await page.goto('/');
    await waitForSessionReady(page);
    await forceAnonMode(page);

    await page.goto('/participa/documentos/enviar/');
    await waitForSessionReady(page);

    await page.fill('#contribucion-titulo', 'Documento E2E');
    await page.check('#contribucion-rights-cc');
    await page.check('#contribucion-consent');
    await page.click('#btn-contribucion-next');

    await expect(page.locator('#contribucion-step-2')).toBeVisible();

    const fixturePath = path.resolve('tests/e2e/fixtures/sample.pdf');
    await page.setInputFiles('#contribucion-archivos-locales', fixturePath);
    await page.click('#btn-contribucion-subir');

    await expect(page.locator('#contribucion-step2-status')).toContainText('Archivos subidos y validados', {
      timeout: 20000
    });
    await expect(page.locator('#contribucion-archivos-subidos-lista li')).toHaveCount(1);

    await page.click('#btn-enviar-contribucion');

    await expect(page.locator('#contribucion-success')).toBeVisible();
    const idText = (await page.locator('#contribucion-success-id').textContent())?.trim() || '';
    expect(idText).toMatch(UUID_REGEX);
  });

  test('clears staged upload state after session rotation', async ({ page }) => {
    await installAppsScriptMock(page);

    await page.goto('/');
    await waitForSessionReady(page);
    await forceAnonMode(page);

    await page.goto('/participa/documentos/enviar/');
    await waitForSessionReady(page);

    await page.fill('#contribucion-titulo', 'Documento E2E');
    await page.check('#contribucion-rights-cc');
    await page.check('#contribucion-consent');
    await page.click('#btn-contribucion-next');

    await expect(page.locator('#contribucion-step-2')).toBeVisible();

    const fixturePath = path.resolve('tests/e2e/fixtures/sample.pdf');
    await page.setInputFiles('#contribucion-archivos-locales', fixturePath);
    await page.click('#btn-contribucion-subir');

    await expect(page.locator('#contribucion-step2-status')).toContainText('Archivos subidos y validados', {
      timeout: 20000
    });
    await expect(page.locator('#contribucion-archivos-subidos-lista li')).toHaveCount(1);
    await expect(page.locator('#contribucion-staging-id')).not.toHaveValue('');

    const resetState = await page.evaluate(async () => {
      const before = window.Participacion.session.getState();
      const result = await window.Participacion.session.resetToUnasked();
      const after = window.Participacion.session.getState();
      return { before, after, result };
    });

    expect(resetState.result.ok).toBe(true);
    expect(resetState.after.sessionId).not.toBe(resetState.before.sessionId);
    expect(resetState.after.browserSessionToken).not.toBe(resetState.before.browserSessionToken);
    expect(resetState.after.modeChoice).toBe('unasked');

    await expect(page.locator('#participa-mode-gate-documento')).toBeVisible();
    await expect(page.locator('#contribucion-step2-status')).toContainText('Debes volver a subir los archivos');
    await expect(page.locator('#contribucion-archivos-subidos-lista li')).toHaveCount(1);
    await expect(page.locator('#contribucion-archivos-subidos-lista li')).toContainText('no hay archivos subidos');
    await expect(page.locator('#contribucion-staging-id')).toHaveValue('');
    await expect(page.locator('#btn-enviar-contribucion')).toBeDisabled();
  });
});
