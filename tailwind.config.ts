import type { Config } from 'tailwindcss';

// Light mint system: pale project-workspace surfaces, dark pine text/navigation,
// and one contrast-safe green action color. Legacy token names remain aliases so
// existing components inherit the new palette without carrying old lavender/indigo.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#16735b',
        'on-primary': '#ffffff',
        'primary-soft': '#ddf3ea',
        periwinkle: '#7bd4b5',
        canvas: '#f7fcf9',
        surface: '#ffffff',
        'surface-tint': '#f1faf6',
        lavender: '#e7f7f0',
        'mint-soft': '#e7f7f0',
        'mint-wash': '#f1fbf6',
        'mint-accent': '#7bd4b5',
        'mint-border': '#b9e2d3',
        night: '#0e3d32',
        'night-raised': '#185246',
        ink: '#14382f',
        'ink-secondary': '#4c6d63',
        'on-dark': '#f2fff9',
        fog: '#bedbd2',
        slate: '#66897f',
        ok: '#16735b',
        warn: '#8a6200',
        danger: '#b33a50',
        'danger-soft': '#fdecef',
      },
      borderRadius: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '32px',
        pill: '40px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      spacing: {
        section: '80px',
        'section-lg': '128px',
      },
      maxWidth: {
        content: '1160px',
      },
    },
  },
  plugins: [],
};

export default config;
