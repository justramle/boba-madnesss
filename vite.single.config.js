// Single-file build: one JS chunk, then scripts/inline.mjs folds it and the CSS into the HTML.
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist-single',
    target: 'es2020',
    modulePreload: false,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
