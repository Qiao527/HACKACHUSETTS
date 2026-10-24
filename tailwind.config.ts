import type { Config } from 'tailwindcss';

// Palette and tokens derived from DESIGN.md (style reference only; no brand
// names, logos or assets). Two surface worlds: a dark "night" frame and a
// light "canvas" product surface, one saturated indigo action colour.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#5266eb',
        'on-primary': '#ffffff',
        periwinkle: '#9cb4e8',
        canvas: '#fbfcfd',
        surface: '#ffffff',
        'surface-tint': '#fbfbff',
        lavender: '#edecfb',
        night: '#171721',
        'night-raised': '#1e1e2a',
        ink: '#28253b',
        'ink-secondary': '#554e7b',
        'on-dark': '#ededf3',
        fog: '#c3c3cc',
        slate: '#70707d',
        // semantic (used sparingly, never as the only signal)
        ok: '#2f8f5b',
        warn: '#9a6a00',
        danger: '#b4324a',
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
        // Inter is the open-source stand-in DESIGN.md recommends for arcadia.
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
