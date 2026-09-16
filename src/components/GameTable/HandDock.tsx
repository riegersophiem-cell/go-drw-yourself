import type { ReactNode } from "react";
import "./HandDock.css";

export interface HandDockProps {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}

/**
 * The private-hand container: light, translucent, backdrop-blurred — never
 * a dark opaque block (brief section 49/50). Shared by REMOTE_MOBILE_FULL
 * and PLAYER_HAND_ONLY; TABLE_DEVICE never renders one.
 */
export function HandDock({ children, className = "", "aria-label": ariaLabel }: HandDockProps) {
  return <section className={`hand-dock ${className}`} aria-label={ariaLabel}>{children}</section>;
}
