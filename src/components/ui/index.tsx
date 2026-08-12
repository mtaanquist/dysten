import type { CSSProperties, ReactNode } from "react";
import { initials } from "@/lib/format";
import styles from "./ui.module.css";

/**
 * Shared presentational primitives. No hooks, so these render on the server
 * and stay out of the client bundle.
 */

export function Avatar({
  name,
  size = "md",
  tone = "soft",
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  tone?: "soft" | "solid";
}) {
  return (
    <span
      className={`${styles.avatar} ${styles[`avatar_${size}`]} ${styles[`avatar_${tone}`]}`}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export function Pill({
  children,
  tone = "light",
}: {
  children: ReactNode;
  tone?: "light" | "soft" | "maroon" | "solid";
}) {
  return <span className={`${styles.pill} ${styles[`pill_${tone}`]}`}>{children}</span>;
}

/** The uppercase micro-label that titles a section or a stat. */
export function SectionLabel({ children, tone }: { children: ReactNode; tone?: "faint" }) {
  return <div className={`${styles.sectionLabel} ${tone === "faint" ? styles.sectionLabelFaint : ""}`}>{children}</div>;
}

export function Panel({
  children,
  className = "",
  padding = "default",
}: {
  children: ReactNode;
  className?: string;
  padding?: "default" | "tight";
}) {
  return (
    <section className={`${styles.panel} ${padding === "tight" ? styles.panelTight : ""} ${className}`}>
      {children}
    </section>
  );
}

export function PanelTitle({ children, size = "lg" }: { children: ReactNode; size?: "lg" | "sm" }) {
  return <h2 className={size === "lg" ? styles.panelTitle : styles.panelTitleSm}>{children}</h2>;
}

/**
 * The decorative organic shapes behind the page. Purely ornamental, hidden
 * from assistive technology, and non-interactive.
 */
export function Blobs() {
  return (
    <div className={styles.blobs} aria-hidden="true">
      <span className={styles.blobA} />
      <span className={styles.blobB} />
    </div>
  );
}

/** A horizontal progress bar. `fraction` is clamped to 0–1 by the caller. */
export function ProgressBar({
  fraction,
  tone = "onDark",
  height = 9,
}: {
  fraction: number;
  tone?: "onDark" | "onLight";
  height?: number;
}) {
  const style = { "--progress-height": `${height}px` } as CSSProperties;
  return (
    <div className={`${styles.progressTrack} ${styles[`progress_${tone}`]}`} style={style}>
      <div className={styles.progressFill} style={{ width: `${Math.round(fraction * 100)}%` }} />
    </div>
  );
}

export { styles as uiStyles };
