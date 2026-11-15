/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        eparnio: {
          bg: '#F6F7FB',
          violet: '#7C3AED',
          avatar: '#8B3DFF',
          blue: '#1D7DFA',
          green: '#22C55E'
        }
      },
      fontFamily: {
        sans: ['Inter', 'Plus Jakarta Sans', 'system-ui', '-apple-system', 'sans-serif']
      },
      boxShadow: {
        card: '0 4px 20px -2px rgba(15, 23, 42, 0.05)'
      }
    }
  },
  plugins: []
};
