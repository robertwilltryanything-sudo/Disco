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
      // Add the new environment variable for the Simple Sync URL.
      'process.env.VITE_SIMPLE_SYNC_URL': JSON.stringify(env.VITE_SIMPLE_SYNC_URL),
      // Add Supabase environment variables
      'process.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
      'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
    }
  };
});