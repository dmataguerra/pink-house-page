import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';

const aerialRoot = fileURLToPath(new URL('../', import.meta.url));
const repositoryRoot = path.resolve(aerialRoot, '..');
const require = createRequire(path.join(aerialRoot, 'package.json'));

export interface DoctorOptions {
  json?: boolean;
  save?: boolean;
  strictData?: boolean;
}

export interface SetupReport {
  version: 1;
  checkedAt: string;
  softwareReady: boolean;
  software: {
    node: { available: true; version: string; compatible: boolean };
    dependencies: { available: boolean; installed: Record<string, boolean>; missing: string[] };
    ffmpeg: { available: boolean; h264EncoderAvailable: boolean; reason?: string };
    ffprobe: { available: boolean; reason?: string };
    browser: { available: boolean; label: string; reason?: string };
  };
  propertyData: {
    state: 'unconfigured' | 'unavailable' | 'invalid' | 'manifest-authorized';
    manifestReady: boolean;
    liveGeometryVerified: false;
    targetIdentityVerified: false;
    reason: string;
  };
  captureReady: false;
}

/** Detect initialized templates without treating their false example rights as revoked rights. */
function isExampleManifest(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  const license = record.license && typeof record.license === 'object'
    ? record.license as Record<string, unknown>
    : {};
  return [record.name, record.provider, record.attribution, license.reference]
    .some((item) => typeof item === 'string' && /REPLACE|placeholder/i.test(item));
}

/**
 * Inspect executable availability and operator-supplied manifest authorization.
 * This does not request or render geographic assets, or verify this property's
 * geometry, photographic textures, actual coverage or identity.
 */
export async function inspectSetup(): Promise<SetupReport> {
  loadDotenv({ path: path.join(aerialRoot, '.env.local'), quiet: true });
  loadDotenv({ path: path.join(aerialRoot, '.env'), quiet: true });

  const major = Number(/^v(\d+)/.exec(process.version)?.[1]);
  const report: SetupReport = {
    version: 1,
    checkedAt: new Date().toISOString(),
    softwareReady: false,
    software: {
      node: { available: true, version: process.version, compatible: major >= 22 },
      dependencies: { available: false, installed: {}, missing: [] },
      ffmpeg: { available: false, h264EncoderAvailable: false },
      ffprobe: { available: false },
      browser: { available: false, label: 'No browser selected' },
    },
    propertyData: {
      state: 'unconfigured',
      manifestReady: false,
      liveGeometryVerified: false,
      targetIdentityVerified: false,
      reason: 'No property dataset is configured. Supply an independently licensed textured 3D survey and video-rights evidence.',
    },
    captureReady: false,
  };

  const packageJson = JSON.parse(await readFile(path.join(aerialRoot, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const dependencyNames = Object.keys({ ...packageJson.dependencies, ...packageJson.devDependencies }).sort();
  for (const name of dependencyNames) {
    try {
      try { require.resolve(`${name}/package.json`); }
      catch { require.resolve(name); }
      report.software.dependencies.installed[name] = true;
    }
    catch { report.software.dependencies.installed[name] = false; report.software.dependencies.missing.push(name); }
  }
  report.software.dependencies.available = report.software.dependencies.missing.length === 0;

  // Import the QA helpers only after resolving their runtime dependencies. A
  // missing installation can therefore still receive a structured diagnosis.
  const qaDependencies = ['sharp', 'ffmpeg-static', 'ffprobe-static'];
  let redact: ((error: unknown) => string) | undefined;
  if (qaDependencies.every((name) => report.software.dependencies.installed[name])) {
    try {
      const qa = await import('./qa');
      redact = qa.redact;
      const binaries = qa.binaryPaths();
      const checks = await Promise.allSettled([
        qa.runProcess(binaries.ffmpeg, ['-hide_banner', '-version'], { timeoutMs: 30_000 }),
        qa.runProcess(binaries.ffprobe, ['-version'], { timeoutMs: 30_000 }),
        qa.runProcess(binaries.ffmpeg, ['-hide_banner', '-encoders'], { timeoutMs: 30_000 }),
      ]);
      report.software.ffmpeg.available = checks[0].status === 'fulfilled';
      report.software.ffprobe.available = checks[1].status === 'fulfilled';
      report.software.ffmpeg.h264EncoderAvailable = checks[2].status === 'fulfilled' && /\blibx264\b/.test(checks[2].value.stdout);
      // Never serialize raw child-process diagnostics, which may contain paths
      // or credentials. Availability flags provide the relevant diagnosis.
    } catch {
      // Import or executable configuration failures receive the generic
      // actionable descriptions below, without exposing private diagnostics.
    }
  }
  if (!report.software.ffmpeg.available) report.software.ffmpeg.reason = 'FFmpeg could not be executed. Install its binary or configure FFMPEG_PATH.';
  else if (!report.software.ffmpeg.h264EncoderAvailable) report.software.ffmpeg.reason = 'The FFmpeg build does not provide the required libx264 H.264 encoder.';
  if (!report.software.ffprobe.available) report.software.ffprobe.reason = 'FFprobe could not be executed. Install its binary or configure FFPROBE_PATH.';

  if (report.software.dependencies.installed.playwright) {
    try {
      const { selectBrowser } = await import('../server/browser');
      const browser = await selectBrowser();
      const label = redact ? redact(browser.label) : browser.label;
      report.software.browser = {
        available: true,
        label: /https?:|[\\/]|key=|token=/i.test(label) ? 'Selected Chromium browser' : label,
      };
    } catch (error) {
      const safe = redact ? redact(error) : '';
      report.software.browser.reason = /CHROMIUM_PATH/i.test(safe)
        ? 'The configured browser override is unavailable. Correct or unset CHROMIUM_PATH to use automatic detection.'
        : 'No usable Chromium browser was found. Install the bundled browser or configure CHROMIUM_PATH.';
    }
  } else {
    report.software.browser.reason = 'Playwright is not installed. Install the project dependencies before checking browsers.';
  }

  const configuredManifest = process.env.DATASET_MANIFEST?.trim();
  if (configuredManifest) {
    const manifestPath = path.resolve(aerialRoot, configuredManifest);
    let accessible = false;
    try { await access(manifestPath); accessible = true; }
    catch { /* A configured but missing file is distinct from an invalid manifest. */ }
    if (!accessible) {
      report.propertyData.state = 'unavailable';
      report.propertyData.reason = 'The configured property manifest is unavailable. Supply the actual survey manifest and license evidence.';
    } else {
      let raw: unknown;
      let jsonValid = false;
      try { raw = JSON.parse(await readFile(manifestPath, 'utf8')); jsonValid = true; }
      catch { /* Preserve a generic diagnosis rather than exposing file contents. */ }
      if (!jsonValid) {
        report.propertyData.state = 'invalid';
        report.propertyData.reason = 'The configured property manifest is not valid JSON.';
      } else if (isExampleManifest(raw)) {
        report.propertyData.state = 'unavailable';
        report.propertyData.reason = 'Only the setup template is configured. Its example fields grant no data or video rights; an actual licensed property survey is still required.';
      } else if (!report.software.dependencies.installed.zod) {
        report.propertyData.state = 'invalid';
        report.propertyData.reason = 'Manifest authorization could not be checked because its validation dependency is missing.';
      } else {
        try {
          const { loadDataset } = await import('../server/dataset');
          await loadDataset(aerialRoot, configuredManifest);
          report.propertyData.state = 'manifest-authorized';
          report.propertyData.manifestReady = true;
          report.propertyData.reason = 'The manifest and operator-supplied license evidence passed configuration checks. Live coverage, geometry, textures and correct house identity remain unverified.';
        } catch (error) {
          const safe = redact ? redact(error) : '';
          report.propertyData.state = 'invalid';
          report.propertyData.reason = /Google-derived/i.test(safe)
            ? 'The configured source is Google-derived and cannot be used for this standalone property export.'
            : /coverage|bounds/i.test(safe)
              ? 'The manifest does not declare sufficient valid coverage for the camera and neighborhood envelope.'
              : /evidence/i.test(safe)
                ? 'Actual video-export and distribution license evidence is missing or incomplete.'
                : 'The configured manifest did not pass survey, texture, coverage and video-rights validation. Review its actual values and evidence.';
        }
      }
    }
  }

  report.softwareReady = report.software.node.compatible && report.software.dependencies.available &&
    report.software.ffmpeg.available && report.software.ffmpeg.h264EncoderAvailable &&
    report.software.ffprobe.available && report.software.browser.available;
  return report;
}

export async function doctor(options: DoctorOptions = {}): Promise<number> {
  const report = await inspectSetup();
  if (options.save) {
    const verificationRoot = path.join(repositoryRoot, 'output', 'verification');
    await mkdir(verificationRoot, { recursive: true });
    await writeFile(path.join(verificationRoot, 'setup-status.json'), `${JSON.stringify(report, null, 2)}\n`);
  }
  if (options.json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`Software: ${report.softwareReady ? 'ready' : 'needs setup'}.`);
    console.log(`Node ${report.software.node.version}: ${report.software.node.compatible ? 'supported' : 'Node 22 or later is required'}.`);
    console.log(`Dependencies: ${report.software.dependencies.available ? 'installed' : `missing ${report.software.dependencies.missing.join(', ')}`}.`);
    console.log(`FFmpeg: ${report.software.ffmpeg.available ? 'available' : 'unavailable'}; H.264: ${report.software.ffmpeg.h264EncoderAvailable ? 'available' : 'unavailable'}; FFprobe: ${report.software.ffprobe.available ? 'available' : 'unavailable'}.`);
    console.log(`Browser: ${report.software.browser.available ? report.software.browser.label : 'unavailable'}.`);
    console.log(`Property data: ${report.propertyData.state}. ${report.propertyData.reason}`);
    console.log('Capture remains subject to live scene and target verification. This setup check does not produce or validate a property MP4.');
    if (options.save) console.log('Saved setup diagnostics to output/verification/setup-status.json.');
  }
  if (!report.softwareReady) return 1;
  if (options.strictData && !report.propertyData.manifestReady) return 2;
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  doctor({ json: args.includes('--json'), save: args.includes('--save'), strictData: args.includes('--strict-data') })
    .then((code) => { process.exitCode = code; })
    .catch(() => { console.error('Setup inspection could not finish. Reinstall project dependencies and check local configuration permissions.'); process.exitCode = 1; });
}
