import type { ReactElement } from "react";
import { useTheme, type ThemeMode } from "./ThemeProvider";
import "./ThemeSwitch.css";

const OPTIONS: { mode: ThemeMode; label: string; icon: ReactElement }[] = [
  {
    mode: "light",
    label: "Hell",
    icon: (
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="4.5" />
        <path d="M12 2.5v2.5M12 19v2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M2.5 12H5M19 12h2.5M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8" />
      </svg>
    ),
  },
  {
    mode: "dark",
    label: "Dunkel",
    icon: (
      <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
        <path d="M20.6 15.1a8.8 8.8 0 0 1-10-13.6A9.6 9.6 0 1 0 20.6 15.1Z" />
      </svg>
    ),
  },
  {
    mode: "system",
    label: "System",
    icon: (
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4.5" width="18" height="12" rx="2" />
        <path d="M8.5 20h7M12 16.5V20" />
      </svg>
    ),
  },
];

/**
 * Compact 3-way theme control (spec section 11/12) - not a binary toggle,
 * so System stays a first-class, always-visible choice rather than something
 * only reachable by clearing local storage. Kept small and icon-led per
 * "UI soll kompakt bleiben".
 */
export function ThemeSwitch() {
  const { mode, setMode } = useTheme();
  return (
    <div className="theme-switch" role="radiogroup" aria-label="Design-Modus">
      {OPTIONS.map((option) => (
        <button
          key={option.mode}
          type="button"
          role="radio"
          aria-checked={mode === option.mode}
          aria-label={option.label}
          title={option.label}
          className={`theme-switch__option ${mode === option.mode ? "theme-switch__option--active" : ""}`}
          onClick={() => setMode(option.mode)}
        >
          {option.icon}
        </button>
      ))}
    </div>
  );
}
