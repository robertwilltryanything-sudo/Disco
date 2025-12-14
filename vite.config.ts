import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
// FIX: Import 'process' to provide TypeScript with correct type definitions for 'process.cwd()'.
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
      // Read the VITE_API_KEY from the environment (Vercel settings) and make it available
      // in the app as process.env.API_KEY to align with Gemini guidelines.
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY),
      // Add Supabase environment variables
      'process.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
      'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
      // FIX: Expose VITE_GOOGLE_CLIENT_ID to client-side code so Google Drive sync can be configured.
      'process.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(env.VITE_GOOGLE_CLIENT_ID),
    }
  };
});