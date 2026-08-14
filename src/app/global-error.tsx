"use client";

import { useEffect } from "react";

/**
 * The last resort: this replaces the root layout, so it fires only when the
 * layout itself throws — before the locale, the theme or the fonts have been
 * resolved.
 *
 * Everything here is therefore self-contained and inline. It cannot use the
 * design tokens, because the stylesheet that defines them is loaded by the
 * layout that just failed, and it cannot know the reader's language, because
 * that comes from the same place — so it says its piece in both, Danish first.
 * Ugly is fine. Blank is not.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global error boundary]", error);
  }, [error]);

  return (
    <html lang="da">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          background: "#f4f8fb",
          color: "#16232e",
          fontFamily: "Helvetica, Arial, sans-serif",
        }}
      >
        <div style={{ maxWidth: "420px", textAlign: "center" }}>
          <h1 style={{ fontSize: "22px", margin: "0 0 10px", color: "#10405f" }}>
            Noget gik galt
          </h1>
          <p style={{ margin: "0 0 4px", fontSize: "15px", lineHeight: 1.5 }}>
            Prøv igen. Sker det igen, så sig til en administrator.
          </p>
          <p style={{ margin: "0 0 22px", fontSize: "14px", lineHeight: 1.5, color: "#4a5c6b" }}>
            Something went wrong. Try again — if it keeps happening, let an administrator know.
          </p>

          <button
            type="button"
            onClick={reset}
            style={{
              minHeight: "44px",
              padding: "0 22px",
              border: 0,
              borderRadius: "999px",
              background: "#a93b4e",
              color: "#ffffff",
              fontFamily: "inherit",
              fontSize: "13px",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Prøv igen · Try again
          </button>

          {error.digest ? (
            <p style={{ marginTop: "22px", fontSize: "12px", color: "#9aaab8", userSelect: "all" }}>
              Reference: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
