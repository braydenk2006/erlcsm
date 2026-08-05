"use client";

/**
 * Custom global error boundary. Next.js's built-in `/_global-error` page fails to
 * prerender under React 19 when the build runs with a non-production `NODE_ENV`
 * (dev/test React bundle) — it throws `Cannot read properties of null (reading
 * 'useContext')`. Providing a self-contained boundary (no providers, fonts, or
 * context) makes the production build deterministic regardless of ambient
 * NODE_ENV. It intentionally renders its own <html>/<body> because a global error
 * replaces the root layout.
 */
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
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#05060A",
          color: "#E8ECF6",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <main style={{ maxWidth: 460, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: "#9AA4BF", marginBottom: 20 }}>
            An unexpected error occurred. You can try again, and if the problem persists, contact
            your administrator.
          </p>
          {error.digest ? (
            <p style={{ color: "#6C7488", fontSize: 12, marginBottom: 20 }}>
              Reference: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: "10px 20px",
              borderRadius: 999,
              border: "none",
              cursor: "pointer",
              color: "#fff",
              fontWeight: 600,
              background: "linear-gradient(135deg, #3B6CFF, #8B5CF6)",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
