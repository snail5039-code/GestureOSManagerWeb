// src/components/theme/ThemeProvider.jsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { THEMES } from "./themeTokens";

const ThemeCtx = createContext(null);

function safeTheme(v) {
  return THEMES.includes(v) ? v : "dark";
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => safeTheme(localStorage.getItem("theme")));

  useEffect(() => {
    localStorage.setItem("theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    }),
    [theme]
  );

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
