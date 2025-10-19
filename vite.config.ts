// FIX: Add a triple-slash directive to include Node.js types. This resolves the
// TypeScript error for `process.cwd()` by providing the correct type definitions
// for the `process` global, which is available in the Node.js environment where
// this config file is executed.
/// <reference types="node" />

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

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
      // Add Supabase environment variables
      'process.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
      'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
    }
  };
});
