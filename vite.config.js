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
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
});
