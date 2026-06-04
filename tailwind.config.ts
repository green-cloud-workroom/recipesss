import type { Config } from 'tailwindcss'

// 운영관리앱(fantapet-inventory) tailwind.config.ts 와 동일. DL-021 — 단계 0 끝까지 mirror.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      borderRadius: {
        md: '6px',
        pill: '12px',
        sm: '4px',
      },
      colors: {
        border: 'var(--fp-border)',
        danger: 'var(--fp-danger)',
        muted: 'var(--fp-muted)',
        primary: {
          DEFAULT: 'var(--fp-primary)',
          dark: 'var(--fp-primary-dark)',
        },
        surface: 'var(--fp-surface)',
      },
      fontFamily: {
        sans: ['Noto Sans KR', 'sans-serif'],
      },
      fontSize: {
        body: ['13px', '1.45'],
        caption: ['11px', '1.4'],
        helper: ['12px', '1.45'],
        title: ['15px', '1.35'],
      },
      spacing: {
        compact: '6px',
      },
    },
  },
} satisfies Config
