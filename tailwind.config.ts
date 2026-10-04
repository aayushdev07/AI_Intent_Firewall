import type { Config } from "tailwindcss";

/**
 * IntentGuard palette: warm paper neutrals with a deep forest-green brand colour.
 * Token names are kept from the first console theme so every component re-themes from here:
 * ink = page / surfaces, steel = lines, fog = text, signal = brand.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#F6F2EA", 2: "#FFFDF9", 3: "#F0EAE0" },
        side: { DEFAULT: "#ECE5D8", hover: "#E3DACB", active: "#DCD1BF" },
        steel: { DEFAULT: "#E8E0D2", line: "#E0D6C6", soft: "#CFC2AE" },
        fog: { DEFAULT: "#1E1A16", dim: "#5A5148", mute: "#8A8074" },
        signal: { DEFAULT: "#1E4D3B", dim: "#173D2F", tint: "#E2ECE5" },
        clay: { DEFAULT: "#B9542D", tint: "#F6E3D8" },
        allow: { DEFAULT: "#2E7A4E", bg: "#E5F1E8" },
        warn: { DEFAULT: "#A8650F", bg: "#FAEFD9" },
        block: { DEFAULT: "#B3261E", bg: "#F8E3E0" },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
        display: ['"Fraunces"', "Georgia", "serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      borderRadius: { xl: "14px", lg: "10px", md: "7px", sm: "4px" },
      boxShadow: {
        card: "0 1px 0 rgba(30,26,22,0.04), 0 1px 2px rgba(30,26,22,0.06)",
        pop: "0 12px 32px -8px rgba(30,26,22,0.22), 0 2px 6px rgba(30,26,22,0.08)",
      },
    },
  },
  plugins: [],
};
export default config;
