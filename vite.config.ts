import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import process from 'process';

/**
 * Dev-server middleware to handle /api/gemini locally during `npm run dev`.
 * In production on Vercel, /api/gemini.ts is deployed as a native serverless function.
 */
function geminiDevServerPlugin(): Plugin {
  return {
    name: 'gemini-dev-server',
    configureServer(server) {
      server.middlewares.use('/api/gemini', async (req, res) => {
        try {
          const { default: handler } = await server.ssrLoadModule('/api/gemini.ts');
          await handler(req, res);
        } catch (err: any) {
          console.error('Local dev server error on /api/gemini:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err?.message || 'Internal dev server error' }));
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on the current mode
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      react(),
      geminiDevServerPlugin(),
    ],
    server: {
      host: '0.0.0.0',
      port: 3000,
      strictPort: true,
      hmr: false,
    },
    base: '/',
    define: {
      // Note: Gemini API keys are now handled server-side via /api/gemini
      // and are NEVER bundled into client-side code.
      'process.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(env.VITE_GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || ""),
    }
  };
});