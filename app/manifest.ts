import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Anime Köşesi — Türkçe Altyazılı Anime İzle",
    short_name: "Anime Köşesi",
    description:
      "Binlerce anime serisi ve filmi HD kalitede, Türkçe altyazılı izleyin.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0b0f",
    theme_color: "#e50914",
    lang: "tr",
    categories: ["entertainment"],
    icons: [
      { src: "/icon", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
