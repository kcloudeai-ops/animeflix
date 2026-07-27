"use client";

/**
 * Kök layout'un kendisi patlarsa devreye girer. Bu durumda layout
 * render edilmediği için <html> ve <body> etiketlerini kendisi yazmalı;
 * global CSS de yüklenmemiş olabileceğinden stiller satır içi verilir.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="tr">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#0b0b0f",
          color: "#f4f4f5",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "1.5rem",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.5rem", margin: 0 }}>
            Uygulama başlatılamadı
          </h1>
          <p style={{ color: "#a1a1aa", marginTop: "0.5rem" }}>
            Beklenmedik bir hata oluştu.
          </p>
          {error.digest ? (
            <p style={{ color: "#52525b", fontSize: "0.75rem" }}>
              Hata kodu: {error.digest}
            </p>
          ) : null}
          <button
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              padding: "0.65rem 1.5rem",
              borderRadius: "0.25rem",
              border: 0,
              background: "#e50914",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Tekrar dene
          </button>
        </div>
      </body>
    </html>
  );
}
