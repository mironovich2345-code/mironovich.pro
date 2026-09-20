import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#161826",
        surface: "#232532",
        panel: "#1b1e2d",
        ink: "#e9e9ed",
        accent: {
          DEFAULT: "#9184d9",
          100: "#f5f4ff",
          200: "#e7e5fe",
          300: "#d2cefd",
          400: "#b5abfc",
          500: "#968ae0",
          600: "#796cbf",
          700: "#5d5294",
          800: "#423a6a",
          900: "#2b2741",
        },
        neutral: {
          100: "#f3f5fe",
          200: "#e4e7f5",
          300: "#cfd3e5",
          400: "#b2b6ca",
          500: "#9397ab",
          600: "#75798c",
          700: "#595d6c",
          800: "#3f424d",
          900: "#292b31",
        },
      },
      borderRadius: { sm: "4px", md: "8px", lg: "14px" },
      fontFamily: { sans: ["var(--font-inter)", "system-ui", "sans-serif"] },
      keyframes: {
        pulseDot: { "0%,100%": { opacity: "0.3" }, "50%": { opacity: "1" } },
        drift: { "0%": { transform: "translateX(-12%)" }, "100%": { transform: "translateX(112%)" } },
      },
      animation: { pulseDot: "pulseDot 3s ease-in-out infinite", drift: "drift 11s linear infinite" },
    },
  },
  plugins: [],
};

export default config;
