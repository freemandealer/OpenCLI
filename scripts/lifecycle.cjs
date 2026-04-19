#!/usr/bin/env node

const { existsSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const rootDir = resolve(__dirname, '..');
const task = process.argv[2];

function runCommand(binary, args, opts = {}) {
  const result = spawnSync(binary, args, {
    cwd: rootDir,
    env: process.env,
    stdio: 'inherit',
    ...opts,
  });

  if (result.error) {
    throw result.error;
  }

  return result.status ?? 0;
}

function runNodeScript(relPath, { ignoreFailure = false } = {}) {
  try {
    const status = runCommand(process.execPath, [join(rootDir, relPath)]);
    if (!ignoreFailure && status !== 0) process.exit(status);
  } catch (err) {
    if (!ignoreFailure) throw err;
    if (process.env.OPENCLI_VERBOSE) {
      console.warn(`[opencli] lifecycle script failed: ${relPath}: ${err.message}`);
    }
  }
}

async function runPreuninstall() {
  const port = process.env.OPENCLI_DAEMON_PORT || '19825';
  try {
    await fetch(`http://127.0.0.1:${port}/shutdown`, {
      method: 'POST',
      headers: { 'X-OpenCLI': '1' },
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Best effort only.
  }
}

function runPrepare() {
  if (!existsSync(join(rootDir, 'src'))) {
    return;
  }

  const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  try {
    runCommand(npmBin, ['run', 'build']);
  } catch (err) {
    if (process.env.OPENCLI_VERBOSE) {
      console.warn(`[opencli] prepare failed: ${err.message}`);
    }
  }
}

async function main() {
  switch (task) {
    case 'postinstall':
      runNodeScript('scripts/postinstall.js', { ignoreFailure: true });
      runNodeScript('scripts/fetch-adapters.js', { ignoreFailure: true });
      return;
    case 'prepare':
      runPrepare();
      return;
    case 'preuninstall':
      await runPreuninstall();
      return;
    default:
      console.error(`[opencli] unknown lifecycle task: ${task || '(missing)'}`);
      process.exitCode = 1;
  }
}

main();
