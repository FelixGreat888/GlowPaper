import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(process.cwd(), 'index.html'),
        v1: path.resolve(process.cwd(), 'v1.html'),
        v2: path.resolve(process.cwd(), 'v2.html'),
        admin: path.resolve(process.cwd(), 'admin.html'),
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:4173',
      '/healthz': 'http://127.0.0.1:4173',
    },
  },
});
