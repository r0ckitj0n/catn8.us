import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Isolated Litig8 bundle for surgical live deploy. Does not replace the
// live Celebr8/Tabul8/Medic8/Accumul8 app entry.
export default defineConfig({
  base: '/dist/',
  plugins: [react()],
  build: {
    outDir: 'dist_litig8_build',
    emptyOutDir: true,
    manifest: true,
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        litig8: resolve(__dirname, 'src/entries/litig8.tsx'),
      },
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
