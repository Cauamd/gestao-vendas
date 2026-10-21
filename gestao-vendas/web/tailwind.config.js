module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      colors: {
        ink: '#351222',
        paper: '#FFF7FA',
        brand: { DEFAULT: '#E91E63', dark: '#B51B55', soft: '#FCE4EC' },
        rose: { 50: '#FFF7FA', 100: '#FBE5ED', 200: '#F7C6D8', 300: '#F187B1', 400: '#EF5A90', 500: '#E9387B', 600: '#E91E63', 700: '#AD1F5B' },
        amber: { soft: '#F8EBCB', deep: '#8A5A00' },
      },
    },
  },
  plugins: [],
};
