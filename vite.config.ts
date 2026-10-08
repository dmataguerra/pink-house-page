import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  base: '/pink-house-page/',
  plugins: [react(), tailwindcss()],
  server: { watch: { ignored: ['**/aerial/**', '**/output/**'] } },
});

