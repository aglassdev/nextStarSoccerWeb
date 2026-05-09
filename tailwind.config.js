/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Muted/pastel accent palette — site-wide.
        // Bold Tailwind hues are remapped to their dustier counterparts so
        // every existing `text-blue-400`, `bg-emerald-500/15`, `border-red-500/30`
        // usage automatically renders with the softer theme.
        primary: {
          DEFAULT: '#7B92C4',
          dark: '#5C73A6',
          light: '#9CACD2',
        },
        secondary: {
          DEFAULT: '#7DB39A',
          dark: '#5C9079',
          light: '#9DC9B4',
        },

        blue: {
          50:  '#EEF2F8',
          100: '#DCE5F0',
          200: '#C4D2E5',
          300: '#B5C7DC',
          400: '#9CB3CD',
          500: '#7B92C4',
          600: '#5C73A6',
          700: '#475A85',
          800: '#384768',
          900: '#2A364E',
        },
        sky: {
          300: '#B5D2D9',
          400: '#9CC2C8',
          500: '#7BAEB8',
          600: '#5C8E98',
        },
        cyan: {
          300: '#B5D2D9',
          400: '#9CC2C8',
          500: '#7BAEB8',
          600: '#5C8E98',
        },
        emerald: {
          300: '#B7D5C4',
          400: '#9DC4AE',
          500: '#7DB39A',
          600: '#5C9079',
          700: '#467560',
        },
        green: {
          300: '#B7D5C4',
          400: '#9DC4AE',
          500: '#7DB39A',
          600: '#5C9079',
          700: '#467560',
        },
        teal: {
          300: '#B5D5CF',
          400: '#9CC4BC',
          500: '#7BAFA5',
          600: '#5C9189',
        },
        red: {
          300: '#E5C0C0',
          400: '#D9A5A5',
          500: '#C28686',
          600: '#A36868',
          700: '#824F4F',
        },
        rose: {
          300: '#E5C0C5',
          400: '#D9A5AE',
          500: '#C28691',
          600: '#A36874',
        },
        orange: {
          300: '#E8C8AB',
          400: '#D9B189',
          500: '#C29565',
          600: '#A37A4D',
        },
        amber: {
          300: '#E8DAB0',
          400: '#D9C18E',
          500: '#C2A66A',
          600: '#A38A4F',
        },
        yellow: {
          300: '#E8DAB0',
          400: '#D9C18E',
          500: '#C2A66A',
          600: '#A38A4F',
        },
        purple: {
          300: '#D2C7E0',
          400: '#C4B5D9',
          500: '#A899C0',
          600: '#8978A2',
          700: '#6E5F84',
        },
        violet: {
          300: '#D2C7E0',
          400: '#C4B5D9',
          500: '#A899C0',
          600: '#8978A2',
        },
        indigo: {
          300: '#C4C7E0',
          400: '#A8AED9',
          500: '#8C92C0',
          600: '#6F75A2',
        },
        pink: {
          300: '#E5C7D6',
          400: '#D9AFC4',
          500: '#C28DA8',
          600: '#A37089',
        },
        gray: {
          750: '#2D3748',
        },
      },
      fontFamily: {
        sans: ['LT Wave', 'Inter', 'system-ui', 'sans-serif'],
        'lt-wave': ['LT Wave', 'sans-serif'],
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.8s ease-in-out',
      },
    },
  },
  plugins: [
    function ({ addUtilities }) {
      addUtilities({
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
        },
      });
    },
  ],
}
