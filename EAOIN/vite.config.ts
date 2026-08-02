import { defineConfig } from 'vite';
import path from 'path';

// GitHub Pages serves project sites from a subpath (`/<repo>/`). The deploy
// workflow used to hard-code the old repo path here, which broke the site after
// the repo was renamed to EAOIN-LAUNCHER (blank/white page — assets 404'd).
// Using a RELATIVE base path (`./`) makes every asset resolve correctly no
// matter what the repo is named, so we don't depend on the workflow's BASE_PATH
// env (which we can't edit — the bot lacks `workflows` permission).
const BASE_PATH = './';

export default defineConfig({
  root: '.',
  base: BASE_PATH,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'esnext',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@babylonjs/')) return 'babylon';
          if (
            id.includes('node_modules/react/')
            || id.includes('node_modules/react-dom/')
            || id.includes('node_modules/scheduler/')
          ) return 'react-vendor';
          return undefined;
        },
      },
    }
  },
  server: {
    port: 3000,
    open: true,
    headers: {
      'Content-Security-Policy': "script-src 'self' 'unsafe-eval'; object-src 'self';"
    },
    proxy: {
      '/api': {
        target: 'ws://localhost:8080',
        ws: true,
        changeOrigin: true
      }
    }
  },
  resolve: {
    alias: {
      '@eaoin': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'shared/src'),
      '@client': path.resolve(__dirname, 'client/src'),
    }
  },
  optimizeDeps: {
    include: ['@babylonjs/core', '@babylonjs/loaders', 'react', 'react-dom']
  }
});
