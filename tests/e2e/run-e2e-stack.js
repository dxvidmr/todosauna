#!/usr/bin/env node

const { spawn } = require('node:child_process');

function runOnce(command, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      stdio: 'inherit',
      shell: true
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`[e2e-stack] ${label} failed with exit code ${code}`));
    });
  });
}

async function runWithRetry(command, label, retries = 3, delayMs = 5000) {
  let attempt = 0;
  while (attempt < retries) {
    attempt += 1;
    try {
      await runOnce(command, `${label} (attempt ${attempt}/${retries})`);
      return;
    } catch (error) {
      if (attempt >= retries) throw error;
      console.warn(`[e2e-stack] ${label} failed (attempt ${attempt}/${retries}), retrying in ${delayMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

function startLongProcess(command, label, extraEnv = {}) {
  const child = spawn(command, {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...extraEnv }
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    console.error(`[e2e-stack] ${label} exited unexpectedly (code=${code}, signal=${signal || 'none'})`);
    shutdown(code || 1);
  });

  return child;
}

const children = [];
let shuttingDown = false;

function stopChild(child) {
  if (!child || child.killed) return;
  try {
    child.kill('SIGTERM');
  } catch (_error) {
    // Best effort.
  }
}

function shutdown(exitCode) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    stopChild(child);
  }

  setTimeout(() => {
    for (const child of children) {
      if (!child.killed) {
        try {
          child.kill('SIGKILL');
        } catch (_error) {
          // Best effort.
        }
      }
    }
    process.exit(exitCode);
  }, 1200);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

async function main() {
  console.log('[e2e-stack] Starting Supabase local stack...');
  await runOnce('npx supabase start -x vector,logflare', 'supabase start');

  console.log('[e2e-stack] Resetting local database...');
  await runWithRetry('npx supabase db reset', 'supabase db reset', 3, 5000);

  console.log('[e2e-stack] Serving Edge Functions...');
  const functionsServe = startLongProcess(
    'npx supabase functions serve --env-file tests/e2e/.env.functions',
    'supabase functions serve',
    {
      SUPABASE_URL: 'http://127.0.0.1:54321',
      UPLOAD_DEV_BYPASS_RECAPTCHA: process.env.UPLOAD_DEV_BYPASS_RECAPTCHA || 'true',
      UPLOAD_TOKEN_SECRET:
        process.env.UPLOAD_TOKEN_SECRET || 'e2e_upload_token_secret_abcdefghijklmnopqrstuvwxyz123456',
      APPS_SCRIPT_SHARED_SECRET:
        process.env.APPS_SCRIPT_SHARED_SECRET || 'e2e_apps_script_shared_secret_abcdefghijklmnopqrstuvwxyz12',
      APPS_SCRIPT_URL: process.env.APPS_SCRIPT_URL || 'https://apps-script.local.test/exec',
      RECAPTCHA_SECRET: process.env.RECAPTCHA_SECRET || 'e2e_dummy_recaptcha_secret',
      SUPABASE_SERVICE_ROLE_KEY:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
    }
  );
  children.push(functionsServe);

  console.log('[e2e-stack] Serving Jekyll site...');
  const jekyllServe = startLongProcess(
    'bundle exec jekyll serve --host 127.0.0.1 --port 4010 --config _config.yml,tests/e2e/_config.e2e.yml',
    'jekyll serve'
  );
  children.push(jekyllServe);

  await new Promise(() => {});
}

main().catch((error) => {
  console.error('[e2e-stack] Fatal error:', error && error.message ? error.message : error);
  shutdown(1);
});
