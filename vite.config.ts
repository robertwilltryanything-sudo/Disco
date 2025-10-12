import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
// FIX: Import process to provide correct types for process.cwd()
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
      // FIX: Use API_KEY to align with Gemini API guidelines.
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      'process.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(env.VITE_GOOGLE_CLIENT_ID),
    }
  };
});