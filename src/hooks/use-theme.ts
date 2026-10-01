import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";

const KEY = "company-os-theme";

const systemPrefersDark = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;

function apply(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && systemPrefersDark());
  document.documentElement.classList.toggle("dark", dark);
}

/**
 * Light / dark / system, remembered across visits. "system" follows the OS setting live.
 * Runs client-side only; the app's authenticated routes are client-rendered.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("system");

  useEffect(() => {
    const stored = localStorage.getItem(KEY) as Theme | null;
    const initial: Theme = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    setThemeState(initial);
    apply(initial);
  }, []);

  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    localStorage.setItem(KEY, next);
    apply(next);
  }, []);

  const isDark = theme === "dark" || (theme === "system" && systemPrefersDark());
  return { theme, setTheme, isDark };
}
