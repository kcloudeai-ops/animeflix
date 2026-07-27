import { ImageResponse } from "next/og";

// iOS ana ekrana eklendiğinde kullanılan ikon.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b0b0f",
          color: "#e50914",
          fontSize: 96,
          fontWeight: 800,
        }}
      >
        A
      </div>
    ),
    size,
  );
}
