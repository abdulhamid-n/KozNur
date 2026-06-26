/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Deep graphite shell — the instrument chassis + dark viewing stage.
        shell: {
          900: '#0E1A24', // deepest stage
          800: '#16242E', // panel chassis
          700: '#1E303B', // raised surface
          600: '#2A3D49', // hairline-on-dark / control face
          500: '#3A4E5A', // muted text on dark
        },
        // Near-white examination surfaces — the readout side.
        exam: {
          0: '#FFFFFF',
          50: '#F6F8F9', // primary surface
          100: '#EDF1F2', // secondary fill
          200: '#DFE6E8', // hairline rule
          300: '#C7D1D4', // strong rule
        },
        // ONE precise instrument accent — clinical cyan-teal.
        instrument: {
          DEFAULT: '#0FB5BA',
          bright: '#0FB5BA',
          deep: '#0F838C',
        },
        // Grade ramp 0->4: green -> lime -> amber -> orange -> clinical red.
        grade: {
          0: '#1F9D74',
          1: '#7FB23A',
          2: '#E0A82E',
          3: '#DB7C26',
          4: '#C0392B',
        },
        // Amber — reserved ONLY for the referable alert. Use with restraint.
        alert: '#E8833A',
        // Ink scale for type on light surfaces.
        ink: {
          DEFAULT: '#0E1A24',
          70: 'rgba(14, 26, 36, 0.70)',
          55: 'rgba(14, 26, 36, 0.55)',
          40: 'rgba(14, 26, 36, 0.40)',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
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
        mono: [
          '"JetBrains Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'monospace',
        ],
      },
      letterSpacing: {
        micro: '0.16em', // uppercase micro-labels
      },
      fontWeight: {
        // Numeric aliases so font-500/600/700 utilities resolve.
        500: '500',
        600: '600',
        700: '700',
      },
      boxShadow: {
        readout:
          '0 1px 2px rgba(14, 26, 36, 0.04), 0 12px 32px rgba(14, 26, 36, 0.10)',
        stage: 'inset 0 0 0 1px rgba(255,255,255,0.04), 0 18px 48px rgba(0,0,0,0.45)',
        control: '0 1px 2px rgba(14, 26, 36, 0.06)',
      },
      keyframes: {
        'settle-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(220%)' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
      },
      animation: {
        'settle-in': 'settle-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in': 'fade-in 0.4s ease-out both',
        scan: 'scan 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-dot': 'pulse-dot 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
