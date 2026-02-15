import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import process from 'process';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on the current mode
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      react(),
    ],
    base: '/',
    define: {
      // Priority: check explicitly loaded VITE_API_KEY, fallback to system process.env if available
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY || process.env.VITE_API_KEY || ""),
      'process.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(env.VITE_GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || ""),
    }
  };
});