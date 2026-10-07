import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 前台（大新店森林匹克球）為紫色、後台（匹克精靈）為綠色，數值在 globals.css 依 html[data-area] 切換
        brand: Object.fromEntries(
          [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((n) => [n, `rgb(var(--brand-${n}) / <alpha-value>)`]),
        ),
        // 前台品牌色，數值集中在 globals.css 的 --hp-* token
        hp: {
          purple: 'rgb(var(--hp-purple) / <alpha-value>)',
          deep: 'rgb(var(--hp-deep) / <alpha-value>)',
          lilac: 'rgb(var(--hp-lilac) / <alpha-value>)',
          cream: 'rgb(var(--hp-cream) / <alpha-value>)',
          ink: 'rgb(var(--hp-ink) / <alpha-value>)',
          logo: 'rgb(var(--hp-logo-bg) / <alpha-value>)',
        },
        ball: { 300: '#e9f98a', 400: '#dff26a', 500: '#d0e94a', 600: '#b6cf2f' },
        ink: {
          50: '#f6f7f9', 100: '#eceef2', 200: '#d5d9e2', 300: '#b0b8c7',
          400: '#8591a6', 500: '#66738b', 600: '#505b70', 700: '#414a5b',
          800: '#38404e', 900: '#0e1726', 950: '#070c15',
        },
      },
      fontFamily: {
        display: ['var(--font-hp-display)', 'var(--font-app)', 'sans-serif'],
        sans: [
          'var(--font-app)', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI',
          'PingFang TC', 'Noto Sans TC', 'Microsoft JhengHei', 'Helvetica Neue',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 1px 2px rgba(14,23,38,.06), 0 8px 24px -12px rgba(14,23,38,.18)',
        pop: '0 8px 32px -8px rgba(14,23,38,.28)',
        bar: '0 -8px 28px -18px rgba(14,23,38,.45)',
      },
      borderRadius: { xl: '0.875rem', '2xl': '1.125rem', '3xl': '1.5rem' },
      keyframes: {
        'slide-up': { from: { transform: 'translateY(12px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        pulse2: { '0%,100%': { opacity: '1' }, '50%': { opacity: '.45' } },
      },
      animation: {
        'slide-up': 'slide-up .22s cubic-bezier(.22,1,.36,1)',
        'fade-in': 'fade-in .18s ease-out',
        pulse2: 'pulse2 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
export default config
