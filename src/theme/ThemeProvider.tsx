import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "gdy_theme";

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

function readStoredMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isThemeMode(stored) ? stored : "system";
  } catch {
    return "system"; // localStorage can throw in a locked-down/private context - System is a safe, functional fallback
  }
}

function prefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolve(mode: ThemeMode): ResolvedTheme {
  return mode === "system" ? (prefersDark() ? "dark" : "light") : mode;
}

interface ThemeContextValue {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Single source of truth for the active theme (Light/Dark/System - see
 * DARK_MODE_IMPLEMENTATION_REPORT.md). Mounted once at the app root;
 * components never decide their own theme, they only read `--*` tokens that
 * this provider keeps in sync on `<html data-theme>`. `index.html`'s inline
 * script performs the identical resolution before this ever mounts, so the
 * value read here on first render already matches what's on screen - no
 * flash, no double-render flicker.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode);
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolve(readStoredMode()));

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolved);
  }, [resolved]);

  // Only System needs to keep listening - an explicit Light/Dark choice is
  // static until the user changes it again (section 13: live updates apply
  // "nur wenn Theme-Modus wirklich SYSTEM ist").
  useEffect(() => {
    if (mode !== "system") {
      setResolved(mode);
      return;
    }
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setResolved(query.matches ? "dark" : "light");
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Non-fatal: the choice just won't survive a reload in this context.
    }
    setModeState(next);
  }, []);

  return <ThemeContext.Provider value={{ mode, resolved, setMode }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
