import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// base './' : 어떤 하위 경로(예: /studio/)에 올려도 동작한다
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
  build: { outDir: 'dist', chunkSizeWarningLimit: 1500 },
});
