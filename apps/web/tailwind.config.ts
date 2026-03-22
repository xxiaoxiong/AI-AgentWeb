import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: '#1f2937',
        panel: '#111827',
        accent: '#22c55e',
      },
    },
  },
  plugins: [],
};

export default config;
