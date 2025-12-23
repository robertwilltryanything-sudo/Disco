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
        '2xl': '0.5rem',    // 8px
        'xl': '0.375rem',   // 6px
        'lg': '0.25rem',    // 4px
        'md': '0.125rem',   // 2px
        'sm': '0.0625rem',  // 1px
        'DEFAULT': '0.125rem',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}