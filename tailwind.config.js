/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./index.tsx",
    "./App.tsx",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./views/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      borderRadius: {
        'xl': '0.5rem',   // 8px - previously 12px
        'lg': '0.375rem', // 6px - previously 8px
        'md': '0.25rem',  // 4px - previously 6px
        'DEFAULT': '0.125rem', // 2px - previously 4px
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}