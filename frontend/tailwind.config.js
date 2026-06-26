/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // KoʻzNur brand palette (ARCHITECTURE §5/§7)
        navy: {
          DEFAULT: '#0B3D66',
          50: '#eef4fa',
          100: '#d4e3f1',
          700: '#0d4574',
          800: '#0B3D66',
          900: '#082c4a',
        },
        teal: {
          DEFAULT: '#0F838C',
          50: '#e7f5f6',
          100: '#c5e7e9',
          600: '#0F838C',
          700: '#0c6b72',
        },
        // Warm accent — used ONLY for the "referable" alert
        accent: {
          DEFAULT: '#E8833A',
          50: '#fdf2e9',
          100: '#fbe1cb',
          200: '#f6c79c',
          600: '#E8833A',
          700: '#c96a26',
        },
        // Calm green for the "no referral needed" state
        calm: {
          DEFAULT: '#1F9D6B',
          50: '#e9f7f1',
          100: '#cdeede',
          600: '#1F9D6B',
          700: '#177a53',
        },
        ink: '#1b2a3a',
        mist: '#f4f7fb',
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 1px 2px rgba(11, 61, 102, 0.06), 0 8px 24px rgba(11, 61, 102, 0.08)',
        soft: '0 1px 3px rgba(11, 61, 102, 0.08)',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.4s ease-out both',
        shimmer: 'shimmer 1.4s linear infinite',
      },
    },
  },
  plugins: [],
}
