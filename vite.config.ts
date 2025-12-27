
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, __dirname, '');
    
    // Captura valores com fallback
    const googleClientId = process.env.GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_ID || "";
    const pixelId = process.env.VITE_PIXEL_ID || env.VITE_PIXEL_ID || "";
    const apiBaseUrl = process.env.VITE_API_BASE_URL || env.VITE_API_BASE_URL || "";
    const apiKey = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY || env.API_KEY || "";

    // Force absolute root and output paths to prevent deployment ambiguity
    // Fix: use __dirname instead of process.cwd() to avoid TS type errors in environments missing Node definitions
    const root = __dirname;

    return {
      root: root,
      base: '/',
      server: {
        port: 5173,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: 'http://127.0.0.1:3000',
            changeOrigin: true,
            secure: false
          }
        }
      },
      build: {
        outDir: path.resolve(root, 'dist'),
        assetsDir: 'assets',
        emptyOutDir: true,
        sourcemap: false,
        minify: 'terser',
        terserOptions: {
            compress: {
                drop_console: true,
                drop_debugger: true
            }
        }
      },
      plugins: [react()],
      define: {
        'process.env.GOOGLE_CLIENT_ID': JSON.stringify(googleClientId),
        'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(googleClientId),
        
        'process.env.VITE_API_BASE_URL': JSON.stringify(apiBaseUrl),
        'import.meta.env.VITE_API_BASE_URL': JSON.stringify(apiBaseUrl),
        
        'process.env.VITE_PIXEL_ID': JSON.stringify(pixelId),
        'import.meta.env.VITE_PIXEL_ID': JSON.stringify(pixelId),

        'process.env.API_KEY': JSON.stringify(apiKey),
      },
      resolve: {
        alias: {
          '@': root,
        }
      }
    };
});
