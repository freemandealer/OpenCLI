import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CliCommand } from './registry.js';
import { executeCommand, prepareCommandArgs } from './execution.js';
import { TimeoutError } from './errors.js';
import { cli, Strategy } from './registry.js';
import { withTimeoutMs } from './runtime.js';
import * as runtime from './runtime.js';
import * as capRouting from './capabilityRouting.js';
import { DEFAULT_BROWSER_WORKSPACE } from './browser-target-state.js';

function writeDefaultBrowserTarget(targetPage: string): void {
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opencli-browser-target-'));
  process.env.OPENCLI_CACHE_DIR = cacheDir;
  const safeWorkspace = DEFAULT_BROWSER_WORKSPACE.replace(/[^a-zA-Z0-9_-]+/g, '_');
  const target = path.join(cacheDir, 'browser-state', `${safeWorkspace}.json`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify({
    defaultPage: targetPage,
    updatedAt: new Date().toISOString(),
  }), 'utf-8');
}

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.OPENCLI_CACHE_DIR;
});

describe('executeCommand — non-browser timeout', () => {
  it('applies timeoutSeconds to non-browser commands', async () => {
    const cmd = cli({
      site: 'test-execution',
      name: 'non-browser-timeout',
      description: 'test non-browser timeout',
      browser: false,
      strategy: Strategy.PUBLIC,
      timeoutSeconds: 0.01,
      func: () => new Promise(() => {}),
    });

    // Sentinel timeout at 200ms — if the inner 10ms timeout fires first,
    // the error will be a TimeoutError with the command label, not 'sentinel'.
    const error = await withTimeoutMs(executeCommand(cmd, {}), 200, 'sentinel timeout')
      .catch((err) => err);

    expect(error).toBeInstanceOf(TimeoutError);
    expect(error).toMatchObject({
      code: 'TIMEOUT',
      message: 'test-execution/non-browser-timeout timed out after 0.01s',
    });
  });

  it('skips timeout when timeoutSeconds is 0', async () => {
    const cmd = cli({
      site: 'test-execution',
      name: 'non-browser-zero-timeout',
      description: 'test zero timeout bypasses wrapping',
      browser: false,
      strategy: Strategy.PUBLIC,
      timeoutSeconds: 0,
      func: () => new Promise(() => {}),
    });

    // With timeout guard skipped, the sentinel fires instead.
    await expect(
      withTimeoutMs(executeCommand(cmd, {}), 50, 'sentinel timeout'),
    ).rejects.toThrow('sentinel timeout');
  });

  it('calls closeWindow on browser command failure', async () => {
    const closeWindow = vi.fn().mockResolvedValue(undefined);
    const mockPage = { closeWindow } as any;

    // Mock shouldUseBrowserSession to return true
    vi.spyOn(capRouting, 'shouldUseBrowserSession').mockReturnValue(true);

    // Mock browserSession to invoke the callback with our mock page
    vi.spyOn(runtime, 'browserSession').mockImplementation(async (_Factory, fn) => {
      return fn(mockPage);
    });

    const cmd = cli({
      site: 'test-execution',
      name: 'browser-close-on-error',
      description: 'test closeWindow on failure',
      browser: true,
      strategy: Strategy.PUBLIC,
      func: async () => { throw new Error('adapter failure'); },
    });

    await expect(executeCommand(cmd, {})).rejects.toThrow('adapter failure');
    expect(closeWindow).toHaveBeenCalledTimes(1);
  });

  it('uses the shared browser workspace and skips closeWindow when keepAlive is enabled', async () => {
    const closeWindow = vi.fn().mockResolvedValue(undefined);
    const mockPage = { closeWindow } as any;

    vi.spyOn(capRouting, 'shouldUseBrowserSession').mockReturnValue(true);
    const browserSessionSpy = vi.spyOn(runtime, 'browserSession').mockImplementation(async (_Factory, fn, opts) => {
      expect(opts).toEqual(expect.objectContaining({ workspace: DEFAULT_BROWSER_WORKSPACE }));
      return fn(mockPage);
    });

    const cmd = cli({
      site: 'test-execution',
      name: 'browser-keep-alive',
      description: 'test keepAlive uses shared workspace',
      browser: true,
      strategy: Strategy.PUBLIC,
      func: async () => [],
    });

    await expect(executeCommand(cmd, {}, false, { keepAlive: true })).resolves.toEqual([]);
    expect(browserSessionSpy).toHaveBeenCalledTimes(1);
    expect(closeWindow).not.toHaveBeenCalled();
  });

  it('reuses the saved default tab when keepAlive is enabled without an explicit target', async () => {
    writeDefaultBrowserTarget('tab-2');
    const setActivePage = vi.fn();
    const closeWindow = vi.fn().mockResolvedValue(undefined);
    const tabs = vi.fn().mockResolvedValue([
      { page: 'tab-1', url: 'https://one.example' },
      { page: 'tab-2', url: 'https://two.example' },
    ]);
    const mockPage = { tabs, setActivePage, closeWindow } as any;

    vi.spyOn(capRouting, 'shouldUseBrowserSession').mockReturnValue(true);
    vi.spyOn(runtime, 'browserSession').mockImplementation(async (_Factory, fn) => fn(mockPage));

    const cmd = cli({
      site: 'test-execution',
      name: 'browser-keep-alive-default-target',
      description: 'test keepAlive reuses saved default target',
      browser: true,
      strategy: Strategy.PUBLIC,
      func: async () => [],
    });

    await expect(executeCommand(cmd, {}, false, { keepAlive: true })).resolves.toEqual([]);
    expect(tabs).toHaveBeenCalledTimes(1);
    expect(setActivePage).toHaveBeenCalledWith('tab-2');
    expect(closeWindow).not.toHaveBeenCalled();
  });

  it('binds the requested target page and treats --tab as implicit keepAlive', async () => {
    const setActivePage = vi.fn();
    const closeWindow = vi.fn().mockResolvedValue(undefined);
    const tabs = vi.fn().mockResolvedValue([
      { page: 'tab-1', url: 'https://one.example' },
      { page: 'tab-2', url: 'https://two.example' },
    ]);
    const mockPage = { tabs, setActivePage, closeWindow } as any;

    vi.spyOn(capRouting, 'shouldUseBrowserSession').mockReturnValue(true);
    const browserSessionSpy = vi.spyOn(runtime, 'browserSession').mockImplementation(async (_Factory, fn, opts) => {
      expect(opts).toEqual(expect.objectContaining({ workspace: DEFAULT_BROWSER_WORKSPACE }));
      return fn(mockPage);
    });

    const cmd = cli({
      site: 'test-execution',
      name: 'browser-target-page',
      description: 'test tab targeting',
      browser: true,
      strategy: Strategy.PUBLIC,
      func: async () => [],
    });

    await expect(executeCommand(cmd, {}, false, { browserTargetPage: 'tab-1' })).resolves.toEqual([]);
    expect(browserSessionSpy).toHaveBeenCalledTimes(1);
    expect(tabs).toHaveBeenCalledTimes(1);
    expect(setActivePage).toHaveBeenCalledWith('tab-1');
    expect(closeWindow).not.toHaveBeenCalled();
  });

  it('suppresses implicit navigation when reusing a targeted tab', async () => {
    const setActivePage = vi.fn();
    const closeWindow = vi.fn().mockResolvedValue(undefined);
    const goto = vi.fn().mockResolvedValue(undefined);
    const tabs = vi.fn().mockResolvedValue([
      { page: 'tab-1', url: 'https://one.example' },
    ]);
    const mockPage = { tabs, setActivePage, closeWindow, goto } as any;

    vi.spyOn(capRouting, 'shouldUseBrowserSession').mockReturnValue(true);
    vi.spyOn(runtime, 'browserSession').mockImplementation(async (_Factory, fn) => fn(mockPage));

    const cmd = cli({
      site: 'test-execution',
      name: 'browser-target-page-no-goto',
      description: 'test keepAlive suppresses navigation',
      browser: true,
      strategy: Strategy.COOKIE,
      domain: 'example.com',
      func: async (page) => {
        await page.goto('https://example.com/somewhere-else');
        return [];
      },
    });

    await expect(executeCommand(cmd, {}, false, { browserTargetPage: 'tab-1' })).resolves.toEqual([]);
    expect(setActivePage).toHaveBeenCalledWith('tab-1');
    expect(goto).not.toHaveBeenCalled();
    expect(closeWindow).not.toHaveBeenCalled();
  });

  it('keeps navigation behavior for keepAlive without a reusable target page', async () => {
    const closeWindow = vi.fn().mockResolvedValue(undefined);
    const goto = vi.fn().mockResolvedValue(undefined);
    const mockPage = { closeWindow, goto } as any;

    vi.spyOn(capRouting, 'shouldUseBrowserSession').mockReturnValue(true);
    vi.spyOn(runtime, 'browserSession').mockImplementation(async (_Factory, fn) => fn(mockPage));

    const cmd = cli({
      site: 'test-execution',
      name: 'browser-keep-alive-first-run',
      description: 'test keepAlive still navigates on first run',
      browser: true,
      strategy: Strategy.COOKIE,
      domain: 'example.com',
      func: async () => [],
    });

    await expect(executeCommand(cmd, {}, false, { keepAlive: true })).resolves.toEqual([]);
    expect(goto).toHaveBeenCalledWith('https://example.com');
    expect(closeWindow).not.toHaveBeenCalled();
  });

  it('keeps the automation window open on browser command failure when keepAlive is enabled', async () => {
    const closeWindow = vi.fn().mockResolvedValue(undefined);
    const mockPage = { closeWindow } as any;

    vi.spyOn(capRouting, 'shouldUseBrowserSession').mockReturnValue(true);
    vi.spyOn(runtime, 'browserSession').mockImplementation(async (_Factory, fn) => fn(mockPage));

    const cmd = cli({
      site: 'test-execution',
      name: 'browser-keep-alive-error',
      description: 'test keepAlive failure behavior',
      browser: true,
      strategy: Strategy.PUBLIC,
      func: async () => { throw new Error('adapter failure'); },
    });

    await expect(executeCommand(cmd, {}, false, { keepAlive: true })).rejects.toThrow('adapter failure');
    expect(closeWindow).not.toHaveBeenCalled();
  });

  it('does not re-run custom validation when args are already prepared', async () => {
    const validateArgs = vi.fn();
    const cmd: CliCommand = {
      site: 'test-execution',
      name: 'prepared-validation',
      description: 'test prepared validation path',
      browser: false,
      strategy: Strategy.PUBLIC,
      args: [],
      validateArgs,
      func: async () => [],
    };

    const kwargs = prepareCommandArgs(cmd, {});
    await executeCommand(cmd, kwargs, false, { prepared: true });

    expect(validateArgs).toHaveBeenCalledTimes(1);
  });
});
