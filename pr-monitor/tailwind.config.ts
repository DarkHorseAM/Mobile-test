import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        paper: "var(--paper)",
        panel: "var(--panel)",
        accent: "var(--accent)",
        "accent-hover": "var(--accent-hover)",
        muted: "var(--muted)",
        "muted-foreground": "var(--muted)",
        rule: "var(--rule)",
        border: "var(--rule)",
      },
      fontFamily: {
        sans: ['"Lab Grotesque"', "system-ui", "sans-serif"],
        mono: ['"PT Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
        display: ['"LateNights"', '"Lab Grotesque"', "serif"],
      },
      letterSpacing: {
        label: "0.08em",
      },
    },
  },
  plugins: [],
};

export default config;
