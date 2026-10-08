import { constants } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

export interface BrowserSelection {
  executablePath?: string;
  /** A descriptive label that never contains user-supplied paths. */
  label: string;
}

export interface BrowserSelectionOptions {
  platform?: NodeJS.Platform;
  bundledExecutablePath?: string | (() => string);
  isReadableFile?: (candidate: string) => Promise<boolean>;
  homeDirectory?: string;
}

interface BrowserCandidate { executablePath: string; label: string }

async function readableFile(candidate: string): Promise<boolean> {
  try {
    const info = await stat(candidate);
    if (!info.isFile()) return false;
    await access(candidate, constants.R_OK);
    return true;
  } catch { return false; }
}

function installedCandidates(
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
  homeDirectory: string,
): BrowserCandidate[] {
  if (platform === 'win32') {
    const roots = [
      env.ProgramFiles || env.PROGRAMFILES || 'C:\\Program Files',
      env['ProgramFiles(x86)'] || env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)',
      env.LOCALAPPDATA || (env.USERPROFILE ? path.win32.join(env.USERPROFILE, 'AppData', 'Local') : undefined),
    ].filter((root): root is string => Boolean(root));
    const chrome = roots.map((root) => ({ executablePath: path.win32.join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'), label: 'Installed Google Chrome' }));
    const edge = roots.map((root) => ({ executablePath: path.win32.join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe'), label: 'Installed Microsoft Edge' }));
    return [...chrome, ...edge];
  }
  if (platform === 'darwin') {
    const roots = ['/Applications', ...(homeDirectory ? [path.posix.join(homeDirectory, 'Applications')] : [])];
    const chrome = roots.map((root) => ({ executablePath: path.posix.join(root, 'Google Chrome.app', 'Contents', 'MacOS', 'Google Chrome'), label: 'Installed Google Chrome' }));
    const edge = roots.map((root) => ({ executablePath: path.posix.join(root, 'Microsoft Edge.app', 'Contents', 'MacOS', 'Microsoft Edge'), label: 'Installed Microsoft Edge' }));
    return [...chrome, ...edge];
  }
  if (platform === 'linux') {
    return [
      ...['/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/opt/google/chrome/chrome'].map((executablePath) => ({ executablePath, label: 'Installed Google Chrome' })),
      ...['/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium'].map((executablePath) => ({ executablePath, label: 'Installed Chromium' })),
      ...['/usr/bin/microsoft-edge-stable', '/usr/bin/microsoft-edge', '/opt/microsoft/msedge/msedge'].map((executablePath) => ({ executablePath, label: 'Installed Microsoft Edge' })),
    ];
  }
  return [];
}

/**
 * Select an existing Chromium-family browser without downloading or launching
 * anything. An explicit override fails closed instead of silently selecting a
 * different browser. File/platform inputs are injectable for deterministic QA.
 */
export async function selectBrowser(
  env: NodeJS.ProcessEnv = process.env,
  options: BrowserSelectionOptions = {},
): Promise<BrowserSelection> {
  const check = options.isReadableFile || readableFile;
  const available = async (candidate: string) => {
    try { return Boolean(candidate) && await check(candidate); }
    catch { return false; }
  };
  if (env.CHROMIUM_PATH !== undefined) {
    const configured = env.CHROMIUM_PATH.trim();
    if (!configured || !(await available(configured))) {
      throw new Error('CHROMIUM_PATH must point to a readable browser executable file. Correct or unset this override to use automatic browser detection.');
    }
    return { executablePath: configured, label: 'Configured Chromium-family browser' };
  }

  let bundled = '';
  try {
    const configuredBundle = options.bundledExecutablePath;
    bundled = typeof configuredBundle === 'function' ? configuredBundle() : configuredBundle ?? chromium.executablePath();
  } catch { /* An unavailable bundle may use an already installed browser. */ }
  if (await available(bundled)) return { executablePath: bundled, label: 'Playwright bundled Chromium' };

  const platform = options.platform ?? process.platform;
  const homeDirectory = options.homeDirectory ?? env.HOME ?? env.USERPROFILE ?? homedir();
  const seen = new Set<string>();
  for (const candidate of installedCandidates(platform, env, homeDirectory)) {
    if (seen.has(candidate.executablePath)) continue;
    seen.add(candidate.executablePath);
    if (await available(candidate.executablePath)) return candidate;
  }
  throw new Error('No readable Chromium-family browser was found. Install Google Chrome or Microsoft Edge, set CHROMIUM_PATH, or run npm run install:browser.');
}
