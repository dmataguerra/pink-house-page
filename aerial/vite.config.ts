import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadDataset } from './server/dataset';

const root = dirname(fileURLToPath(import.meta.url));
function datasetEndpoint(): Plugin {
  return {
    name: 'licensed-dataset-config',
    configureServer(server) {
      server.middlewares.use('/api/dataset', async (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        try { res.end(JSON.stringify({ dataset: await loadDataset(root) })); }
        catch (error) {
          res.statusCode = 412;
          const message = error instanceof Error ? error.message : 'Dataset preflight failed.';
          // Schema diagnostics contain field names only; never serialize input values/URLs.
          res.end(JSON.stringify({ error: message.startsWith('[') ? 'Dataset manifest failed validation. Run npm run preflight.' : message }));
        }
      });
    },
  };
}
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, '');
  if (!process.env.DATASET_MANIFEST && env.DATASET_MANIFEST) process.env.DATASET_MANIFEST = env.DATASET_MANIFEST;
  return {
    root,
    plugins: [react(), datasetEndpoint(), viteStaticCopy({ targets: [
      { src: resolve(root, 'node_modules/cesium/Build/Cesium/Workers').replaceAll('\\', '/'), dest: 'cesium' },
      { src: resolve(root, 'node_modules/cesium/Build/Cesium/ThirdParty').replaceAll('\\', '/'), dest: 'cesium' },
      { src: resolve(root, 'node_modules/cesium/Build/Cesium/Assets').replaceAll('\\', '/'), dest: 'cesium' },
      { src: resolve(root, 'node_modules/cesium/Build/Cesium/Widgets').replaceAll('\\', '/'), dest: 'cesium' },
    ] })],
    define: { CESIUM_BASE_URL: JSON.stringify('/cesium') },
    server: { host: '127.0.0.1', port: 4175, strictPort: true },
    build: { outDir: 'dist' },
  };
});
