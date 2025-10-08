import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // This base path is now set automatically during the GitHub Actions deployment.
  // The VITE_BASE_URL is generated from your repository's name in the deploy.yml workflow.
  // For local development, it defaults to '/' which is standard for Vite.
  base: process.env.VITE_BASE_URL || '/',
  define: {
    // Vite replaces these expressions with string literals at build time.
    // This makes environment variables from the build environment (e.g., GitHub Actions secrets)
    // available to the client-side code.
    'process.env.API_KEY': JSON.stringify(process.env.VITE_API_KEY),
    'process.env.GOOGLE_CLIENT_ID': JSON.stringify(process.env.VITE_GOOGLE_CLIENT_ID),
  },
});
