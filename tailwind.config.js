/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0A0A0A',
        surface: '#1A1A1A',
        surfaceGlass: 'rgba(26, 26, 26, 0.7)',
        neonGreen: '#00FF88',
        neonMagenta: '#FF2D55',
        neonCyan: '#00D9FF',
        neonPurple: '#A855F7',
      },
      boxShadow: {
        green: '0 0 20px rgba(0, 255, 136, 0.3)',
        magenta: '0 0 20px rgba(255, 45, 85, 0.3)',
        cyan: '0 0 20px rgba(0, 217, 255, 0.3)',
        purple: '0 0 20px rgba(168, 85, 247, 0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}