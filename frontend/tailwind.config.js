/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: { DEFAULT: "#0b0f14", panel: "#11161d", border: "#1f2731" },
        accent: { DEFAULT: "#3ecf8e", warn: "#f5a623", crit: "#ef4444" },
      },
    },
  },
  plugins: [],
};
