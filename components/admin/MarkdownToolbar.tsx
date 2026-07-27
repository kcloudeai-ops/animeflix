"use client";

import {
  Bold,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
} from "lucide-react";
import type { RefObject } from "react";

interface Props {
  /** Düzenlenen içerik textarea'sı */
  areaRef: RefObject<HTMLTextAreaElement | null>;
  /** Değişikliği yukarı bildir */
  onChange: (yeni: string) => void;
}

/**
 * Markdown biçimlendirme araç çubuğu. Seçili metni sarar (kalın, italik…)
 * ya da imleç konumuna blok ekler (başlık, liste). Tıklayınca uygulanır.
 */
export function MarkdownToolbar({ areaRef, onChange }: Props) {
  /** Seçimi verilen ön/son ekle sarar (kalın, italik, link…). */
  const sar = (on: string, son = on, yerTutucu = "metin") => {
    const el = areaRef.current;
    if (!el) return;
    const { selectionStart: b, selectionEnd: e, value } = el;
    const secili = value.slice(b, e) || yerTutucu;
    const yeni = value.slice(0, b) + on + secili + son + value.slice(e);
    onChange(yeni);

    // İmleci sarılan metnin içine/sonuna al
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = b + on.length;
      el.selectionEnd = b + on.length + secili.length;
    });
  };

  /** Satır başına önek ekler (## başlık, - liste, > alıntı). */
  const onEk = (onek: string) => {
    const el = areaRef.current;
    if (!el) return;
    const { selectionStart: b, value } = el;
    // Bulunduğu satırın başını bul
    const satirBasi = value.lastIndexOf("\n", b - 1) + 1;
    const yeni = value.slice(0, satirBasi) + onek + value.slice(satirBasi);
    onChange(yeni);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = b + onek.length;
    });
  };

  const dugmeler = [
    { ikon: Bold, ad: "Kalın", is: () => sar("**") },
    { ikon: Italic, ad: "İtalik", is: () => sar("*") },
    { ikon: Heading2, ad: "Başlık 2", is: () => onEk("## ") },
    { ikon: Heading3, ad: "Başlık 3", is: () => onEk("### ") },
    { ikon: List, ad: "Madde listesi", is: () => onEk("- ") },
    { ikon: ListOrdered, ad: "Numaralı liste", is: () => onEk("1. ") },
    { ikon: Quote, ad: "Alıntı", is: () => onEk("> ") },
    {
      ikon: Link2,
      ad: "Bağlantı",
      is: () => sar("[", "](https://)", "bağlantı metni"),
    },
    {
      ikon: ImageIcon,
      ad: "Görsel",
      is: () => sar("![", "](https://)", "görsel açıklaması"),
    },
  ];

  return (
    <div className="flex flex-wrap gap-1 rounded-t-lg border border-b-0 border-ink-line bg-ink-soft/80 p-1.5">
      {dugmeler.map(({ ikon: Ikon, ad, is }) => (
        <button
          key={ad}
          type="button"
          onClick={is}
          title={ad}
          aria-label={ad}
          className="grid size-8 place-items-center rounded text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Ikon size={16} />
        </button>
      ))}

      {/* Anime bağlantısı — blog için en değerli iç link */}
      <button
        type="button"
        onClick={() =>
          sar("[", "](/anime/SLUG)", "anime adı")
        }
        title="Anime bağlantısı ekle"
        className="ml-auto rounded bg-brand/20 px-2.5 text-xs font-medium text-brand transition-colors hover:bg-brand/30"
      >
        + Anime linki
      </button>
    </div>
  );
}
