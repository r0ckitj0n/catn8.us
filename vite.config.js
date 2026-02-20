import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '/' : '/dist/',
  plugins: [react()],
  server: {
    host: 'localhost',
    port: 5178,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8888',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'react-vendor';
          }
          if (id.includes('node_modules')) {
            return 'vendor';
          }
          if (id.includes('/src/components/mystery/') || id.includes('/src/hooks/mystery')) {
            return 'mystery';
          }
          if (id.includes('/src/components/modals/')) {
            return 'modals';
          }
          return undefined;
        },
      },
    },
  },
}));
