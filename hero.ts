import { heroui } from "@heroui/react";

export default heroui({
  defaultTheme: "dark",
  themes: {
    dark: {
      colors: {
        background: "#09090B",
        foreground: "#FAFAFA",
        content1: "#121215",
        content2: "#1A1A1F",
        content3: "#232329",
        content4: "#2E2E36",
        default: {
          50: "#18181B",
          100: "#232329",
          200: "#2E2E36",
          300: "#3F3F46",
          400: "#71717A",
          500: "#A1A1AA",
          600: "#D4D4D8",
          700: "#E4E4E7",
          800: "#F4F4F5",
          900: "#FAFAFA",
          DEFAULT: "#2E2E36",
          foreground: "#D4D4D8",
        },
        primary: {
          50: "#04140D",
          100: "#052E1C",
          200: "#064E31",
          300: "#0A7247",
          400: "#0F9A5F",
          500: "#10B981",
          600: "#34D399",
          700: "#6EE7B7",
          800: "#A7F3D0",
          900: "#D1FAE5",
          DEFAULT: "#10B981",
          foreground: "#04140D",
        },
        secondary: {
          DEFAULT: "#818CF8",
          foreground: "#0B0B1E",
        },
        success: { DEFAULT: "#10B981", foreground: "#04140D" },
        warning: { DEFAULT: "#F5A524", foreground: "#1F1303" },
        danger: { DEFAULT: "#F31260", foreground: "#FFFFFF" },
        focus: "#10B981",
      },
    },
  },
});
