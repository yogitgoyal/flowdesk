import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F4F5F7",
        surface: "#FFFFFF",
        "surface-sunken": "#E8EAEE",
        border: "#D8DCE3",
        ink: "#1A1D24",
        "ink-secondary": "#5B6270",
        signal: "#FF5A36",
        "status-live": "#1F9D63",
        warning: "#E0A526",
        danger: "#E0453A",
        // presence colors
        "presence-amber": "#E8A33D",
        "presence-teal": "#2E8B87",
        "presence-magenta": "#C74E79",
        "presence-indigo": "#4A5FD1",
        success: "#3F8F5F",
        // legacy aliases (keep for compatibility)
        amber: "#E8A33D",
        teal: "#2E8B87",
        magenta: "#C74E79",
        indigo: "#4A5FD1",
        // status aliases
        "status-warning": "#E0A526",
        "status-danger": "#E0453A",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        card: "6px",
      },
    },
  },
  plugins: [],
};
export default config;