import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // MIRONOVICH editorial palette
        graphite: "#0E0E11",
        cream: "#F2EFE8",
        signal: "#D92D2D",
        maroon: "#481014",
        stone: "#94918C",
      },
      borderRadius: { sm: "4px", md: "8px", lg: "14px" },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        // Editorial display face for oversized headlines/statements only — Inter stays
        // for everything else (body, buttons, forms, nav, small captions).
        display: ["var(--font-display)", "var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
