import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Isolated Medic8 bundle for surgical live deploy. Does not replace the
// live Celebr8/Tabul8 app entry.
export default defineConfig({
  base: '/dist/',
  plugins: [react()],
  build: {
    outDir: 'dist_medic8_build',
    emptyOutDir: true,
    manifest: true,
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        medic8: resolve(__dirname, 'src/entries/medic8.tsx'),
      },
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
