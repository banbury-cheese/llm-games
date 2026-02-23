import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx,scss}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx,scss}',
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        coral: '#F35757',
        olive: '#A6BE59',
        yellow: '#ECD227',
        lavender: '#AFA3FF',
        orange: '#EC683E',
        peach: '#F2995E',
        sky: '#7FB2FF',
        'warm-gray': '#BFBAB4',
        'bg-cream': '#F5F0EB',
        'bg-dark': '#1E1E1E',
      },
      fontFamily: {
        display: ['var(--font-inter-tight)', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 18px 50px rgba(15, 15, 15, 0.08)',
        card: '0 10px 35px rgba(15, 15, 15, 0.12)',
      },
      borderRadius: {
        '4xl': '1.5rem',
      },
      keyframes: {
        spinPulse: {
          '0%': { transform: 'rotate(0deg) scale(0.96)' },
          '50%': { transform: 'rotate(180deg) scale(1)' },
          '100%': { transform: 'rotate(360deg) scale(0.96)' },
        },
      },
      animation: {
        'spin-pulse': 'spinPulse 1s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
