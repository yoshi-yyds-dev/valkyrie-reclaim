/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        void: {
          darkest: "#030408",
          DEFAULT: "#070913",
          panel: "#0d1224",
          surface: "#11131d",
          border: "#161f38",
        },
        cyber: {
          cyan: "#00f3ff",
          "cyan-dim": "#00dce6",
          violet: "#a855f7",
          crimson: "#ff0055",
          amber: "#f59e0b",
        },
        text: {
          primary: "#e2f1ff",
          dim: "#5d729a",
        }
      },
      fontFamily: {
        mono: ["JetBrains Mono", "monospace"],
        sans: ["Space Grotesk", "Segoe UI", "sans-serif"],
      }
    },
  },
  plugins: [],
}
