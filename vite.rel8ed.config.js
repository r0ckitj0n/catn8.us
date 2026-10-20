import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Isolated Rel8ed bundle for surgical live deploy.
export default defineConfig({
  base: '/dist/',
  plugins: [react()],
  build: {
    outDir: 'dist_rel8ed_build',
    emptyOutDir: true,
    manifest: true,
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        rel8ed: resolve(__dirname, 'src/entries/rel8ed.tsx'),
      },
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
