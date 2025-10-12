import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
// FIX: Import `cwd` from the Node.js process module to resolve TypeScript type errors.
import { cwd } from 'node:process';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // The third parameter `''` loads all env variables without the `VITE_` prefix requirement.
  const env = loadEnv(mode, cwd(), '');

  return {
    plugins: [
      react(),
    ],
    base: '/',
    // Define `process.env` variables to be replaced at build time.
    // This makes them available in the client-side code.
    define: {
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY || ''),
      'process.env.GOOGLE_CLIENT_ID': JSON.stringify(env.VITE_GOOGLE_CLIENT_ID || ''),
    },
  };
});