import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#1f6f43',
          dark: '#164d2e',
          light: '#dff5e7',
        }
      }
    }
  },
  plugins: [],
};
export default config;
