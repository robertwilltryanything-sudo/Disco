import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  // This 'define' block makes environment variables available in the client-side code.
  // It replaces any occurrence of `process.env.VAR_NAME` with the value of that variable
  // at build time. This is crucial for the Vercel deployment to work correctly.
  define: {
    'process.env': process.env,
  },
  base: '/',
});