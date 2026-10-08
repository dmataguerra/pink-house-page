import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { selectBrowser } from '../server/browser';

function availability(files: string[], seen: string[] = []) {
  return async (candidate: string) => { seen.push(candidate); return files.includes(candidate); };
}

test('explicit browser override takes priority and emits a path-free label', async () => {
  const result = await selectBrowser({ CHROMIUM_PATH: 'C:\\private-user\\browser.exe' }, {
    platform: 'win32', bundledExecutablePath: 'C:\\bundle\\chrome.exe',
    isReadableFile: availability(['C:\\private-user\\browser.exe', 'C:\\bundle\\chrome.exe']),
  });
  assert.equal(result.executablePath, 'C:\\private-user\\browser.exe');
  assert.equal(result.label, 'Configured Chromium-family browser');
  assert.equal(result.label.includes('private-user'), false);
});

test('unreadable or empty explicit overrides fail without falling back', async () => {
  for (const configured of ['C:\\sensitive\\missing-browser.exe', '', '   ']) {
    const seen: string[] = [];
    await assert.rejects(() => selectBrowser({ CHROMIUM_PATH: configured }, {
      platform: 'win32', bundledExecutablePath: 'C:\\available\\chrome.exe',
      isReadableFile: availability(['C:\\available\\chrome.exe'], seen),
    }), (error: Error) => {
      assert.match(error.message, /CHROMIUM_PATH must point/);
      assert.equal(error.message.includes('sensitive'), false);
      return true;
    });
    assert.equal(seen.includes('C:\\available\\chrome.exe'), false);
  }
});

test('available Playwright bundle precedes installed browsers', async () => {
  const seen: string[] = [];
  const result = await selectBrowser({}, {
    platform: 'win32', bundledExecutablePath: () => 'C:\\bundle\\chrome.exe',
    isReadableFile: availability(['C:\\bundle\\chrome.exe'], seen),
  });
  assert.deepEqual(result, { executablePath: 'C:\\bundle\\chrome.exe', label: 'Playwright bundled Chromium' });
  assert.deepEqual(seen, ['C:\\bundle\\chrome.exe']);
});

test('Windows selection uses configured program and local application directories', async () => {
  const env = { ProgramFiles: 'D:\\Programs', 'ProgramFiles(x86)': 'D:\\Programs86', LOCALAPPDATA: 'D:\\Profile\\Local' };
  const candidates = [
    [path.win32.join(env.ProgramFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'), 'Installed Google Chrome'],
    [path.win32.join(env['ProgramFiles(x86)'], 'Microsoft', 'Edge', 'Application', 'msedge.exe'), 'Installed Microsoft Edge'],
    [path.win32.join(env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'), 'Installed Google Chrome'],
  ] as const;
  for (const [executablePath, label] of candidates) {
    assert.deepEqual(await selectBrowser(env, { platform: 'win32', bundledExecutablePath: '', isReadableFile: availability([executablePath]) }), { executablePath, label });
  }
});

test('Windows user-profile fallback and uppercase environment aliases are supported', async () => {
  const env = { PROGRAMFILES: 'E:\\Apps', USERPROFILE: 'E:\\User' };
  const executablePath = path.win32.join(env.USERPROFILE, 'AppData', 'Local', 'Microsoft', 'Edge', 'Application', 'msedge.exe');
  assert.equal((await selectBrowser(env, { platform: 'win32', bundledExecutablePath: '', isReadableFile: availability([executablePath]) })).executablePath, executablePath);
});

test('macOS checks system and user application locations', async () => {
  const executablePath = '/Users/tester/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
  assert.deepEqual(await selectBrowser({}, {
    platform: 'darwin', homeDirectory: '/Users/tester', bundledExecutablePath: '', isReadableFile: availability([executablePath]),
  }), { executablePath, label: 'Installed Microsoft Edge' });
});

test('Linux can select an existing Chromium installation', async () => {
  const executablePath = '/usr/bin/chromium';
  assert.deepEqual(await selectBrowser({}, {
    platform: 'linux', bundledExecutablePath: '', isReadableFile: availability([executablePath]),
  }), { executablePath, label: 'Installed Chromium' });
});

test('missing browser or unreadable candidates produce actionable path-free failures', async () => {
  for (const isReadableFile of [availability([]), async () => { throw new Error('Do not expose /private/secret/path'); }]) {
    await assert.rejects(() => selectBrowser({}, {
      platform: 'linux', bundledExecutablePath: '/private/secret/browser', isReadableFile,
    }), (error: Error) => {
      assert.match(error.message, /npm run install:browser/);
      assert.equal(error.message.includes('secret'), false);
      return true;
    });
  }
});
