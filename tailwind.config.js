/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f7f1',
          100: '#dcece0',
          200: '#bad9c3',
          300: '#8dbf9e',
          400: '#5c9f76',
          500: '#3a8158',
          600: '#2a6745',
          700: '#225339',
          800: '#1b422e',
          900: '#14532d',
          950: '#0b2e1a'
        }
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif'
        ]
      }
    }
  },
  plugins: []
};
