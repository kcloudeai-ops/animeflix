import { ImageResponse } from "next/og";

// Tarayıcı sekmesi ve arama sonuçlarındaki favicon.
// Statik dosya yerine üretiyoruz — marka rengiyle tutarlı kalsın.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#e50914",
          color: "#fff",
          fontSize: 22,
          fontWeight: 800,
          borderRadius: 6,
        }}
      >
        A
      </div>
    ),
    size,
  );
}
