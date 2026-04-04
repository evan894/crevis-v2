import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        saffron: {
          light: "var(--color-saffron-light)",
          DEFAULT: "var(--color-saffron)",
          dark: "var(--color-saffron-dark)",
        },
        ink: {
          muted: "var(--color-ink-muted)",
          secondary: "var(--color-ink-secondary)",
          DEFAULT: "var(--color-ink)",
        },
        surface: {
          DEFAULT: "var(--color-surface)",
          raised: "var(--color-surface-raised)",
        },
        border: {
          DEFAULT: "var(--color-border)",
          strong: "var(--color-border-strong)",
        },
        success: {
          bg: "var(--color-success-bg)",
          DEFAULT: "var(--color-success)",
        },
        warning: {
          bg: "var(--color-warning-bg)",
          DEFAULT: "var(--color-warning)",
        },
        error: {
          bg: "var(--color-error-bg)",
          DEFAULT: "var(--color-error)",
        },
        info: {
          bg: "var(--color-info-bg)",
          DEFAULT: "var(--color-info)",
        },
        credit: {
          light: "var(--color-credit-light)",
          DEFAULT: "var(--color-credit)",
        },
      },
      spacing: {
        1: "var(--space-1)",
        2: "var(--space-2)",
        3: "var(--space-3)",
        4: "var(--space-4)",
        5: "var(--space-5)",
        6: "var(--space-6)",
        8: "var(--space-8)",
        10: "var(--space-10)",
        12: "var(--space-12)",
        16: "var(--space-16)",
        20: "var(--space-20)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        full: "var(--radius-full)",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
        saffron: "var(--shadow-saffron)",
        credit: "var(--shadow-credit)",
      },
      fontFamily: {
        syne: ["var(--font-syne)", "sans-serif"],
        "dm-sans": ["var(--font-dm-sans)", "sans-serif"],
        "jetbrains-mono": ["var(--font-jetbrains-mono)", "monospace"],
      },
      transitionTimingFunction: {
        "out-custom": "var(--ease-out)",
        "in-out-custom": "var(--ease-in-out)",
        spring: "var(--ease-spring)",
      },
      transitionDuration: {
        fast: "var(--duration-fast)",
        base: "var(--duration-base)",
        slow: "var(--duration-slow)",
        page: "var(--duration-page)",
      },
      fontSize: {
        xs: ["11px", "1.4"],
        sm: ["13px", "1.5"],
        base: ["15px", "1.6"],
        md: ["17px", "1.5"],
        lg: ["20px", "1.4"],
        xl: ["26px", "1.3"],
        "2xl": ["34px", "1.2"],
        "3xl": ["48px", "1.1"],
      },
    },
  },
  plugins: [],
};

export default config;
