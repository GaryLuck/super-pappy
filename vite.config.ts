import { defineConfig } from 'vite';

// Relative base so the build works from any sub-path (e.g. GitHub Pages /super-pappy/).
export default defineConfig({
  base: './',
  build: {
    // three.js alone is ~500 kB minified.
    chunkSizeWarningLimit: 800,
  },
});
