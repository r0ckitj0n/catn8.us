import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Isolated Rel8d bundle for surgical live deploy.
export default defineConfig({
  base: '/dist/',
  plugins: [react()],
  build: {
    outDir: 'dist_rel8d_build',
    emptyOutDir: true,
    manifest: true,
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        rel8d: resolve(__dirname, 'src/entries/rel8d.tsx'),
      },
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
