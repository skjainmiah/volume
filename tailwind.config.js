/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0A0E27',
        surface: '#141B34',
        'surface-light': '#1C2541',
        primary: '#3B82F6',
        'primary-dark': '#2563EB',
        success: '#10B981',
        danger: '#EF4444',
        warning: '#F59E0B',
        'text-primary': '#F8FAFC',
        'text-secondary': '#94A3B8',
        'text-muted': '#64748B',
      },
    },
  },
  plugins: [],
}
