"use client";

import { useEffect, useRef } from "react";
import styles from "./WinnerAnnouncement.module.css";

/** Palette tokens the pieces are drawn in, read at runtime so dark mode follows. */
const COLOUR_TOKENS = ["--c-blue", "--c-maroon", "--c-type-step", "--c-type-bike", "--c-chip-bg"];
const FALLBACK_COLOURS = ["#1789ce", "#a93b4e", "#9adda5", "#ffbbd0", "#f5c542"];

const PIECES_PER_CORNER = 90;
const GRAVITY = 0.28;
const DRAG = 0.985;

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  width: number;
  height: number;
  colour: string;
  /** Frames to wait before launching, so each corner fires in a short volley. */
  delay: number;
}

/**
 * A burst of confetti from both bottom corners, angled up and in towards the
 * middle. Drawn on one canvas and gone once the last piece has fallen off the
 * bottom. Nothing at all for people who have asked for reduced motion.
 */
export function Confetti() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ratio = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    element.width = width * ratio;
    element.height = height * ratio;
    context.scale(ratio, ratio);

    const style = getComputedStyle(document.documentElement);
    const colours = COLOUR_TOKENS.map(
      (token, i) => style.getPropertyValue(token).trim() || FALLBACK_COLOURS[i],
    ).concat("#f5c542");

    // Scaled to the viewport so a phone's burst reaches its middle and a
    // desktop's does not stop a third of the way across.
    const speed = Math.max(14, Math.min(26, Math.sqrt(width * width + height * height) / 55));

    const pieces: Piece[] = [];
    for (const side of [-1, 1]) {
      for (let i = 0; i < PIECES_PER_CORNER; i++) {
        // Up and inwards: 50-80 degrees above the horizontal.
        const angle = ((50 + Math.random() * 30) * Math.PI) / 180;
        const launch = speed * (0.55 + Math.random() * 0.6);
        pieces.push({
          x: side < 0 ? 0 : width,
          y: height,
          vx: -side * Math.cos(angle) * launch,
          vy: -Math.sin(angle) * launch,
          angle: Math.random() * Math.PI,
          spin: (Math.random() - 0.5) * 0.3,
          width: 6 + Math.random() * 6,
          height: 4 + Math.random() * 4,
          colour: colours[Math.floor(Math.random() * colours.length)],
          delay: Math.floor(Math.random() * 18),
        });
      }
    }

    let frame = 0;
    const tick = () => {
      context.clearRect(0, 0, width, height);
      let alive = false;

      for (const piece of pieces) {
        if (piece.delay > 0) {
          piece.delay--;
          alive = true;
          continue;
        }
        piece.vx *= DRAG;
        piece.vy = piece.vy * DRAG + GRAVITY;
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.angle += piece.spin;
        if (piece.y > height + 20) continue;
        alive = true;

        context.save();
        context.translate(piece.x, piece.y);
        context.rotate(piece.angle);
        // Squashing one axis with the spin reads as a piece of paper tumbling.
        context.scale(1, Math.cos(piece.angle * 2));
        context.fillStyle = piece.colour;
        context.fillRect(-piece.width / 2, -piece.height / 2, piece.width, piece.height);
        context.restore();
      }

      if (alive) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, []);

  return <canvas ref={canvas} className={styles.confetti} aria-hidden="true" />;
}
