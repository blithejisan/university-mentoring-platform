"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#0f172a",
          color: "#e2e8f0",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <main style={{ maxWidth: 480, padding: 24, textAlign: "center" }}>
          <h1>This page couldn&apos;t load</h1>
          <p style={{ color: "#cbd5e1" }}>
            The application encountered a temporary problem. Please try again.
          </p>
          {error.digest && (
            <p style={{ color: "#94a3b8", fontSize: 12 }}>Reference: {error.digest}</p>
          )}
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 12,
              border: 0,
              borderRadius: 6,
              padding: "10px 16px",
              background: "#047857",
              color: "white",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
