import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite configuration for Gmail Manager frontend
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,       // Dev server port — Electron points here
    strictPort: true,  // Fail if port is already in use
  },
  build: {
    outDir: 'dist',    // Production build output directory
  },
});
