"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Stagger offset in ms, applied as a transition-delay. */
  delayMs?: number;
};

/**
 * Small client leaf, the only piece of the landing page that needs the
 * browser: an IntersectionObserver flips one class once a block enters the
 * viewport, and the actual opacity/transform values live in globals.css
 * inside a `prefers-reduced-motion: no-preference` guard. That means a
 * reduced-motion viewer never has an "opacity: 0" state applied at all, no
 * matter when this observer fires, so there is nothing to race and nothing
 * left half-hidden.
 */
export function Reveal({ children, className = "", delayMs = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const classes = ["reveal", visible ? "reveal-visible" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={ref}
      className={classes}
      style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}
