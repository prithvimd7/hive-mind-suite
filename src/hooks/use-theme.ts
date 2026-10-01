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
  const [state, setState] = useState<{ theme: Theme; isDark: boolean }>({
    theme: "system",
    isDark: false,
  });
  const { theme, isDark } = state;

  useEffect(() => {
    const stored = localStorage.getItem(KEY) as Theme | null;
    const initial: Theme = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    const nextIsDark = initial === "dark" || (initial === "system" && systemPrefersDark());
    setState({ theme: initial, isDark: nextIsDark });
    apply(initial);
  }, []);

  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      apply("system");
      setState((current) => ({ ...current, isDark: mq.matches }));
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    localStorage.setItem(KEY, next);
    apply(next);
    setState({
      theme: next,
      isDark: next === "dark" || (next === "system" && systemPrefersDark()),
    });
  }, []);

  return { theme, setTheme, isDark };
}
