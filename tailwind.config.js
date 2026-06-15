/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          950: '#020617',
          900: '#0a0f1a',
          800: '#111827',
          700: '#1f2937',
        },
        red: {
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },
      },
    },
  },
  plugins: [],
}
