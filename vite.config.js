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
        app: resolve(__dirname, 'src/entries/app.tsx'),
        medic8: resolve(__dirname, 'src/entries/medic8.tsx'),
        litig8: resolve(__dirname, 'src/entries/litig8.tsx'),
        rel8d: resolve(__dirname, 'src/entries/rel8d.tsx'),
      },
      output: {
        // Keep already-hashed static names (favicon-*.ico, manifest-*.webmanifest)
        // so root index.html links stay stable and Vite does not double-hash them.
        assetFileNames(assetInfo) {
          const name = assetInfo.names?.[0] || assetInfo.name || 'asset';
          if (/-[A-Za-z0-9_-]{6,}\.(png|ico|webmanifest|svg|webp|jpg|jpeg)$/i.test(name)) {
            return `assets/${name}`;
          }
          return 'assets/[name]-[hash][extname]';
        },
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
