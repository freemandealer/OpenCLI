import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { IPage } from './types.js';

export const DEFAULT_BROWSER_WORKSPACE = 'browser:default';

export interface BrowserTargetState {
  defaultPage?: string;
  updatedAt: string;
}

type BrowserTabSummary = {
  page?: string;
};

function getBrowserCacheDir(): string {
  return process.env.OPENCLI_CACHE_DIR || path.join(os.homedir(), '.opencli', 'cache');
}

function getBrowserTargetStatePath(scope: string = DEFAULT_BROWSER_WORKSPACE): string {
  const safeWorkspace = scope.replace(/[^a-zA-Z0-9_-]+/g, '_');
  return path.join(getBrowserCacheDir(), 'browser-state', `${safeWorkspace}.json`);
}

export function loadBrowserTargetState(scope: string = DEFAULT_BROWSER_WORKSPACE): BrowserTargetState | null {
  try {
    const raw = fs.readFileSync(getBrowserTargetStatePath(scope), 'utf-8');
    const parsed = JSON.parse(raw) as BrowserTargetState | null;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function saveBrowserTargetState(defaultPage?: string, scope: string = DEFAULT_BROWSER_WORKSPACE): void {
  const target = getBrowserTargetStatePath(scope);
  if (!defaultPage) {
    fs.rmSync(target, { force: true });
    return;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify({ defaultPage, updatedAt: new Date().toISOString() }), 'utf-8');
}

function hasBrowserTabTarget(tabs: unknown[], targetPage: string): boolean {
  return tabs.some((tab) => {
    return typeof tab === 'object'
      && tab !== null
      && 'page' in tab
      && typeof (tab as BrowserTabSummary).page === 'string'
      && (tab as BrowserTabSummary).page === targetPage;
  });
}

export async function resolveBrowserTargetInSession(
  page: IPage,
  targetPage: string,
  opts: { scope?: string; source: 'explicit' | 'saved' },
): Promise<string | undefined> {
  const candidate = targetPage.trim();
  if (!candidate) return undefined;

  let tabs: unknown[];
  try {
    tabs = await page.tabs();
  } catch (err) {
    if (opts.source === 'saved') {
      saveBrowserTargetState(undefined, opts.scope);
      return undefined;
    }
    throw new Error(
      `Target tab ${candidate} could not be validated in the current browser session. ` +
      'The Browser Bridge workspace may have restarted; re-run "opencli browser tab list" and choose a current target.',
      { cause: err },
    );
  }

  if (Array.isArray(tabs) && hasBrowserTabTarget(tabs, candidate)) {
    return candidate;
  }

  if (opts.source === 'saved') {
    saveBrowserTargetState(undefined, opts.scope);
    return undefined;
  }

  throw new Error(
    `Target tab ${candidate} is not part of the current browser session. ` +
    'The Browser Bridge workspace may have restarted; re-run "opencli browser tab list" and choose a current target.',
  );
}

export async function resolveStoredBrowserTarget(
  page: IPage,
  scope: string = DEFAULT_BROWSER_WORKSPACE,
): Promise<string | undefined> {
  const defaultPage = loadBrowserTargetState(scope)?.defaultPage?.trim();
  if (!defaultPage) return undefined;
  return resolveBrowserTargetInSession(page, defaultPage, { scope, source: 'saved' });
}
