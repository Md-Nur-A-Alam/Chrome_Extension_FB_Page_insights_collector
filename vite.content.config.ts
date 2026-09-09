import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/content/facebook-content.ts'),
      name: 'FacebookContent',
      formats: ['iife'],
      fileName: () => 'content/facebook-content.js'
    },
    rollupOptions: {
      output: {
        extend: true
      }
    }
  }
});
