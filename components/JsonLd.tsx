import { SITE_URL } from "@/lib/supabase/config";
import type { AnimeCharacter, AnimeWithEpisodes, Episode } from "@/lib/types";
import type { Sezon } from "@/lib/queries";


function Script({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify çıktısı güvenlidir; </script> kaçışı ekleniyor.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

/**
 * Anime detay sayfası için TVSeries şeması.
 *  - actor: karakterleri seslendirenleriyle (Person) bağlar.
 *  - containsSeason: aynı serinin diğer sezonlarını (TVSeason) listeler.
 * Bunlar Google'ın diziyi/karakterleri ilişkilendirmesine yardımcı olur.
 */
export function TVSeriesJsonLd({
  anime,
  karakterler = [],
  sezonlar = [],
}: {
  anime: AnimeWithEpisodes;
  karakterler?: AnimeCharacter[];
  sezonlar?: Sezon[];
}) {
  return (
    <Script
      data={{
        "@context": "https://schema.org",
        "@type": "TVSeries",
        name: anime.title,
        // `name` ile aynı olanı tekrar etme
        alternateName: [anime.title_english, anime.title_japanese].filter(
          (t): t is string => !!t && t !== anime.title,
        ),
        url: `${SITE_URL}/anime/${anime.slug}`,
        image: anime.poster_url ?? undefined,
        description: anime.synopsis ?? undefined,
        genre: anime.genres.map((g) => g.name),
        numberOfEpisodes: anime.total_episodes || undefined,
        numberOfSeasons: sezonlar.length > 1 ? sezonlar.length : undefined,
        datePublished: anime.year ? `${anime.year}-01-01` : undefined,
        inLanguage: "ja",
        productionCompany: anime.studios.map((name) => ({
          "@type": "Organization",
          name,
        })),

        // Başrol karakterlerini seslendirenleriyle (Person) bağla
        actor: karakterler
          .filter((k) => k.voiceActor)
          .slice(0, 10)
          .map((k) => ({
            "@type": "Person",
            name: k.voiceActor!.name,
            ...(k.voiceActor!.image_url ? { image: k.voiceActor!.image_url } : {}),
            characterName: k.name,
          })),

        // Ana karakterler (seslendireni olmasa da)
        character: karakterler
          .filter((k) => k.role === "MAIN")
          .slice(0, 10)
          .map((k) => ({
            "@type": "Person",
            name: k.name,
            ...(k.image_url ? { image: k.image_url } : {}),
          })),

        // Serideki diğer sezonlar (TVSeason)
        containsSeason:
          sezonlar.length > 1
            ? sezonlar.map((s) => ({
                "@type": "TVSeason",
                seasonNumber: s.season_number,
                name: s.season_label
                  ? `${s.title} — ${s.season_label}`
                  : s.title,
                url: `${SITE_URL}/anime/${s.slug}`,
                numberOfEpisodes: s.total_episodes || undefined,
                datePublished: s.year ? `${s.year}-01-01` : undefined,
              }))
            : undefined,

        aggregateRating: anime.score
          ? {
              "@type": "AggregateRating",
              ratingValue: anime.score,
              bestRating: 10,
              worstRating: 1,
              ratingCount: Math.max(anime.view_count, 1),
            }
          : undefined,
      }}
    />
  );
}

/** Bölüm izleme sayfası için VideoObject şeması. */
export function VideoObjectJsonLd({
  anime,
  episode,
}: {
  anime: AnimeWithEpisodes;
  episode: Episode;
}) {
  const url = `${SITE_URL}/anime/${anime.slug}/bolum/${episode.number}`;
  // Bölüm başlığı sadece "12. Bölüm" ise sonek eklemeyelim ("12. Bölüm — 12. Bölüm")
  const defaultLabel = `${episode.number}. Bölüm`;
  const hasRealTitle = !!episode.title && episode.title.trim() !== defaultLabel;

  return (
    <Script
      data={{
        "@context": "https://schema.org",
        "@type": "VideoObject",
        name: `${anime.title} ${defaultLabel}${
          hasRealTitle ? ` — ${episode.title}` : ""
        }`,
        description:
          episode.synopsis ??
          anime.synopsis?.slice(0, 200) ??
          `${anime.title} ${episode.number}. bölüm.`,
        thumbnailUrl: [episode.thumbnail_url ?? anime.poster_url].filter(Boolean),
        uploadDate: episode.air_date ?? anime.created_at,
        duration: episode.duration_sec
          ? `PT${Math.floor(episode.duration_sec / 60)}M${episode.duration_sec % 60}S`
          : undefined,
        contentUrl: episode.video_url ?? undefined,
        embedUrl: url,
        interactionStatistic: {
          "@type": "InteractionCounter",
          interactionType: { "@type": "WatchAction" },
          userInteractionCount: episode.view_count,
        },
        partOfSeries: { "@type": "TVSeries", name: anime.title },
        partOfSeason: { "@type": "TVSeason", seasonNumber: 1 },
        episodeNumber: episode.number,
      }}
    />
  );
}

/**
 * Site geneli kimlik — yalnızca anasayfada bir kez.
 *  - WebSite + SearchAction: Google sonuçlarında site içi arama kutusu
 *    (sitelinks searchbox) çıkarabilir.
 *  - Organization: marka adı, logo ve sosyal hesaplar.
 */
export function SiteJsonLd() {
  return (
    <>
      <Script
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "AnimeFlix",
          url: SITE_URL,
          inLanguage: "tr-TR",
          potentialAction: {
            "@type": "SearchAction",
            target: {
              "@type": "EntryPoint",
              urlTemplate: `${SITE_URL}/ara?q={search_term_string}`,
            },
            "query-input": "required name=search_term_string",
          },
        }}
      />
      <Script
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "AnimeFlix",
          url: SITE_URL,
          logo: `${SITE_URL}/icon`,
        }}
      />
    </>
  );
}

/**
 * Anime fragmanı için VideoObject — detay sayfasında.
 * Google video zengin sonucu (thumbnail + oynat) çıkarabilir.
 * Yalnızca resmi YouTube fragmanı olan animelerde eklenir.
 */
export function TrailerJsonLd({
  anime,
  youtubeId,
}: {
  anime: AnimeWithEpisodes;
  youtubeId: string;
}) {
  return (
    <Script
      data={{
        "@context": "https://schema.org",
        "@type": "VideoObject",
        name: `${anime.title} — Fragman`,
        description:
          anime.synopsis?.slice(0, 200) ??
          `${anime.title} anime fragmanı.`,
        thumbnailUrl: [`https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`],
        uploadDate: anime.created_at,
        embedUrl: `https://www.youtube.com/embed/${youtubeId}`,
        // Fragman YouTube'da barındığından contentUrl da onun izleme adresi
        contentUrl: `https://www.youtube.com/watch?v=${youtubeId}`,
      }}
    />
  );
}

/**
 * Sıralı anime listesi için ItemList — koleksiyon sayfalarında.
 * "En İyi Aksiyon Animeleri" gibi listelerin Google'da carousel/liste
 * zengin sonucu olarak görünmesine yardımcı olur.
 */
export function ItemListJsonLd({
  name,
  animeler,
}: {
  name: string;
  animeler: { slug: string; title: string }[];
}) {
  return (
    <Script
      data={{
        "@context": "https://schema.org",
        "@type": "ItemList",
        name,
        numberOfItems: animeler.length,
        itemListElement: animeler.map((a, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `${SITE_URL}/anime/${a.slug}`,
          name: a.title,
        })),
      }}
    />
  );
}

/** Blog yazısı için Article şeması. */
export function ArticleJsonLd({
  title,
  description,
  slug,
  coverUrl,
  publishedAt,
  updatedAt,
}: {
  title: string;
  description: string;
  slug: string;
  coverUrl: string | null;
  publishedAt: string | null;
  updatedAt: string;
}) {
  return (
    <Script
      data={{
        "@context": "https://schema.org",
        "@type": "Article",
        headline: title,
        description,
        image: coverUrl ?? `${SITE_URL}/opengraph-image`,
        datePublished: publishedAt ?? undefined,
        dateModified: updatedAt,
        inLanguage: "tr-TR",
        mainEntityOfPage: `${SITE_URL}/blog/${slug}`,
        author: { "@type": "Organization", name: "AnimeFlix" },
        publisher: {
          "@type": "Organization",
          name: "AnimeFlix",
          logo: { "@type": "ImageObject", url: `${SITE_URL}/icon` },
        },
      }}
    />
  );
}

/** Kırıntı navigasyonu — Google sonuçlarında yol gösterir. */
export function BreadcrumbJsonLd({
  items,
}: {
  items: { name: string; path: string }[];
}) {
  return (
    <Script
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((it, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: it.name,
          item: `${SITE_URL}${it.path}`,
        })),
      }}
    />
  );
}
