import type { ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  /**
   * Stagger offset in ms. Kept only for call-site compatibility (hero.tsx,
   * migration.tsx, etc. already pass it) -- Reveal no longer animates
   * anything (see the component doc below), so there's nothing left to
   * delay. Accepting and ignoring it here means those callers don't need
   * to change just because this component got simpler.
   */
  delayMs?: number;
};

/**
 * Plain wrapper -- deliberately with no IntersectionObserver, no `visible`
 * state, and no opacity/transform mechanism. The previous version rendered
 * its content at `opacity: 0` until a client-side IntersectionObserver
 * flipped a `visible` class; if JS ever failed to load or run, for any
 * visitor, for any reason, that `opacity: 0` was never undone and real
 * landing-page content stayed silently invisible forever. This version has
 * no hidden state to fail into: content is visible from the very first
 * byte of HTML, unconditionally.
 */
export function Reveal({ children, className = "", delayMs }: RevealProps) {
  void delayMs;
  return <div className={className}>{children}</div>;
}
