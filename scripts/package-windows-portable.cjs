#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');
const artifactsDir = path.join(rootDir, 'artifacts');
const tempDir = path.join(artifactsDir, 'tmp');
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const version = packageJson.version;
const bundleName = `opencli-windows-portable-v${version}`;
const stageDir = path.join(tempDir, bundleName);
const zipPath = path.join(artifactsDir, `${bundleName}.zip`);

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function runCommand(binary, args, options = {}) {
  const result = spawnSync(binary, args, {
    cwd: rootDir,
    env: process.env,
    stdio: 'inherit',
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if ((result.status ?? 0) !== 0) {
    throw new Error(`${binary} ${args.join(' ')} failed with exit code ${result.status}`);
  }
}

function copyEntry(relPath) {
  const src = path.join(rootDir, relPath);
  const dest = path.join(stageDir, relPath);
  if (!fs.existsSync(src)) {
    throw new Error(`Missing required path: ${relPath}`);
  }
  fs.cpSync(src, dest, { recursive: true });
}

function walkFiles(dirPath, onFile) {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, onFile);
      continue;
    }
    onFile(fullPath);
  }
}

function ensureBuildOutput() {
  const entryFile = path.join(rootDir, 'dist', 'src', 'main.js');
  if (fs.existsSync(entryFile)) {
    return;
  }
  const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  runCommand(npmBin, ['run', 'build']);
}

function writeLaunchers() {
  const cmd = [
    '@echo off',
    'setlocal',
    'set SCRIPT_DIR=%~dp0',
    'node "%SCRIPT_DIR%dist\\src\\main.js" %*',
  ].join('\r\n') + '\r\n';

  const ps1 = [
    '$ErrorActionPreference = "Stop"',
    '$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path',
    'node (Join-Path $scriptDir "dist\\src\\main.js") @args',
  ].join('\r\n') + '\r\n';

  fs.writeFileSync(path.join(stageDir, 'opencli.cmd'), cmd, 'utf8');
  fs.writeFileSync(path.join(stageDir, 'opencli.ps1'), ps1, 'utf8');
}

function installProductionDependencies() {
  const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  runCommand(npmBin, ['ci', '--omit=dev', '--ignore-scripts'], { cwd: stageDir });
}

function pruneFiles(dirPath, removePatterns) {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  walkFiles(dirPath, (filePath) => {
    if (removePatterns.some((pattern) => pattern.test(filePath))) {
      fs.rmSync(filePath, { force: true });
    }
  });
}

function pruneRuntimeFiles() {
  pruneFiles(path.join(stageDir, 'dist'), [
    /\.d\.ts$/,
    /\.test\.js$/,
    /\.test\.d\.ts$/,
    /\.map$/,
    /tsconfig\.tsbuildinfo$/,
  ]);

  pruneFiles(path.join(stageDir, 'clis'), [
    /\.d\.ts$/,
    /\.test\.js$/,
    /\.test\.d\.ts$/,
    /\.map$/,
  ]);
}

function createZipArchive() {
  fs.rmSync(zipPath, { force: true });
  runCommand('zip', ['-qr', zipPath, bundleName], { cwd: tempDir });
}

function main() {
  ensureBuildOutput();
  fs.rmSync(stageDir, { recursive: true, force: true });
  ensureDir(stageDir);
  ensureDir(artifactsDir);
  ensureDir(tempDir);

  copyEntry('dist');
  copyEntry('clis');
  copyEntry('scripts');
  copyEntry('cli-manifest.json');
  copyEntry('package.json');
  copyEntry('package-lock.json');
  copyEntry('README.md');
  copyEntry('LICENSE');
  copyEntry('windows-install.md');

  writeLaunchers();
  installProductionDependencies();
  pruneRuntimeFiles();
  createZipArchive();

  console.log('');
  console.log(`Portable directory: ${stageDir}`);
  console.log(`ZIP package: ${zipPath}`);
}

main();
