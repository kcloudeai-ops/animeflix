import { ImageResponse } from "next/og";

// Anasayfa ve OG görseli olmayan sayfalar sosyal medyada
// paylaşıldığında görünen varsayılan kart görseli (1200×630).
export const alt = "Anime Köşesi — Türkçe Altyazılı Anime İzle";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0b0b0f 0%, #1a0508 100%)",
          color: "#fff",
        }}
      >
        <div style={{ display: "flex", fontSize: 92, fontWeight: 800 }}>
          <span style={{ color: "#e50914" }}>Anime</span>
          <span>&nbsp;Köşesi</span>
        </div>
        <div
          style={{
            marginTop: 16,
            fontSize: 34,
            color: "#a1a1aa",
          }}
        >
          Türkçe Altyazılı Anime İzle
        </div>
      </div>
    ),
    size,
  );
}
