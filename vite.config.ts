import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import process from 'process';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      react(),
    ],
    base: '/',
    define: {
      // Read the VITE_API_KEY from the environment (Vercel settings) and make it available
      // in the app as process.env.API_KEY to align with Gemini guidelines.
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY),
      'process.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(env.VITE_GOOGLE_CLIENT_ID),
    }
  };
});