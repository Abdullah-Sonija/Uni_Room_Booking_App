/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  theme: {
    extend: {
      colors: {
        navy:   '#0f1f3d',
        gold:   '#f5a623',
        jade:   '#2db87e',
        coral:  '#e85d4a',
        slate2: '#f0f2f5',
      },
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
        body:    ['Inter', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        card:  '0 1px 3px 0 rgba(15,31,61,0.06), 0 1px 2px -1px rgba(15,31,61,0.04)',
        hover: '0 4px 12px 0 rgba(15,31,61,0.12)',
        glow:  '0 0 12px 0 rgba(245,166,35,0.4)',
      },
      keyframes: {
        'fade-up': {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.35s ease-out both',
        'fade-in': 'fade-in 0.25s ease-out both',
      },
    },
  },
  plugins: [],
};
