import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  // The base path is now '/', which is the default and correct for platforms like Netlify/Vercel.
  base: '/',
  define: {
    // Vite replaces these expressions with string literals at build time.
    // This makes environment variables from the build environment (e.g., hosting provider's UI)
    // available to the client-side code.
    'process.env.API_KEY': JSON.stringify(process.env.VITE_API_KEY),
    'process.env.GOOGLE_CLIENT_ID': JSON.stringify(process.env.VITE_GOOGLE_CLIENT_ID),
  },
});