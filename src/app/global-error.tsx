"use client";

/** Last-resort boundary when the root layout itself fails; must render its own <html>. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 22 }}>Journal couldn&apos;t load</h1>
          <p style={{ color: "#71717a" }}>Please try again in a moment.</p>
          <button onClick={reset} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid #e4e4e7", cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
