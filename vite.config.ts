import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Custom plugin to remove the development-only import map from index.html before building.
    // This is a more robust solution than using `sed` in the CI/CD pipeline.
    {
      name: 'remove-import-map-plugin',
      transformIndexHtml: {
        order: 'pre',
        handler(html) {
          // The 's' flag allows '.' to match newline characters, ensuring the entire multi-line script block is removed.
          return html.replace(/<script type="importmap">.*?<\/script>/s, '');
        },
      },
    },
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