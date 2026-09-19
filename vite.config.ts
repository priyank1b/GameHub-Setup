import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { DriveService } from './electron/services/DriveService';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'dev-api-drives',
      configureServer(server) {
        server.middlewares.use('/api/drives', async (_req, res) => {
          try {
            const driveService = new DriveService();
            const drives = await driveService.getAvailableDrives();
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(drives));
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      },
    },
  ],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ['**/release/**', '**/dist-electron/**', '**/.git/**'],
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
