import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const tone = (name: string) => ({
  DEFAULT: `hsl(var(--${name}))`,
  soft: `hsl(var(--${name}-soft))`,
  border: `hsl(var(--${name}-border))`,
});

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1rem", screens: { "2xl": "1240px" } },
    extend: {
      fontFamily: {
        display: ['"Fraunces"', "Georgia", "serif"],
        sans: ['"Inter"', "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        canvas: "hsl(var(--canvas))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))", soft: "hsl(var(--primary-soft))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        success: tone("success"),
        info: tone("info"),
        warning: tone("warning"),
        danger: tone("danger"),
      },
      borderRadius: { xl: "calc(var(--radius) + 4px)", lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" },
      boxShadow: {
        card: "0 1px 2px hsl(var(--shadow) / 0.05), 0 4px 16px -4px hsl(var(--shadow) / 0.08)",
        lift: "0 2px 4px hsl(var(--shadow) / 0.06), 0 12px 32px -8px hsl(var(--shadow) / 0.16)",
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        "fade-up": { "0%": { opacity: "0", transform: "translateY(8px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        "pop": { "0%": { transform: "scale(0.6)", opacity: "0" }, "60%": { transform: "scale(1.15)", opacity: "1" }, "100%": { transform: "scale(1)" } },
        "draw": { from: { strokeDashoffset: "24" }, to: { strokeDashoffset: "0" } },
        "shimmer": { "100%": { transform: "translateX(100%)" } },
        "pulse-dot": { "0%,100%": { opacity: "0.3" }, "50%": { opacity: "1" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-up": "fade-up 0.35s cubic-bezier(.2,.7,.2,1) both",
        pop: "pop 0.35s cubic-bezier(.2,.7,.2,1) both",
        draw: "draw 0.35s 0.1s ease-out both",
        "pulse-dot": "pulse-dot 1.2s ease-in-out infinite",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
