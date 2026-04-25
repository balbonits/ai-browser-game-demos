import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync, copyFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// LICENSE and LICENSE-ASSETS live at the repo root (GitHub convention) but
// must also be served at the site root so per-game footer links work
// (`<a href="../../LICENSE">` from `/games/<slug>/`). This plugin serves
// them from the dev server and copies them into `dist/` at build time, so
// the repo root stays the single source of truth.
const ROOT_FILES = ['LICENSE', 'LICENSE-ASSETS'];

function rootLicenseFiles(): Plugin {
  return {
    name: 'root-license-files',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();
        const name = req.url.replace(/^\//, '').split('?')[0];
        if (ROOT_FILES.includes(name)) {
          const path = resolve(__dirname, name);
          if (existsSync(path)) {
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.end(readFileSync(path));
            return;
          }
        }
        next();
      });
    },
    closeBundle() {
      for (const name of ROOT_FILES) {
        const src = resolve(__dirname, name);
        const dst = resolve(__dirname, 'dist', name);
        if (existsSync(src)) copyFileSync(src, dst);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), rootLicenseFiles()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
