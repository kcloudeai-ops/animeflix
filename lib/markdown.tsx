import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Bağımlılıksız, güvenli Markdown render.
 *
 * XSS'e kapalı: ham HTML render EDİLMEZ, metin React tarafından
 * otomatik kaçışlanır. Yalnızca sınırlı bir alt küme desteklenir —
 * blog yazıları için yeterli: başlıklar, paragraf, kalın/italik,
 * link, liste, alıntı. Harici markdown paketi eklemeye gerek yok.
 */

/** Satır içi biçimlendirme: **kalın**, *italik*, `kod`, [metin](url) */
function inline(text: string, key: string): ReactNode[] {
  const parcalar: ReactNode[] = [];
  // Sıra önemli: link, kalın, italik, kod
  const regex =
    /(\[([^\]]+)\]\(([^)\s]+)\))|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)/g;

  let son = 0;
  let m: RegExpExecArray | null;
  let i = 0;

  while ((m = regex.exec(text)) !== null) {
    if (m.index > son) parcalar.push(text.slice(son, m.index));

    if (m[1]) {
      // [metin](url) — yalnızca güvenli protokoller
      const url = m[3];
      const guvenli = /^(https?:\/\/|\/)/.test(url);
      const ic = url.startsWith("/");
      if (!guvenli) parcalar.push(m[2]);
      else if (ic)
        parcalar.push(
          <Link key={`${key}-${i}`} href={url} className="text-brand hover:underline">
            {m[2]}
          </Link>,
        );
      else
        parcalar.push(
          <a
            key={`${key}-${i}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand hover:underline"
          >
            {m[2]}
          </a>,
        );
    } else if (m[4]) {
      parcalar.push(<strong key={`${key}-${i}`}>{m[5]}</strong>);
    } else if (m[6]) {
      parcalar.push(<em key={`${key}-${i}`}>{m[7]}</em>);
    } else if (m[8]) {
      parcalar.push(
        <code
          key={`${key}-${i}`}
          className="rounded bg-ink px-1.5 py-0.5 text-sm text-brand"
        >
          {m[9]}
        </code>,
      );
    }

    son = regex.lastIndex;
    i++;
  }
  if (son < text.length) parcalar.push(text.slice(son));
  return parcalar;
}

/** Markdown metnini blok blok React elemanlarına çevirir. */
export function Markdown({ text }: { text: string }) {
  const satirlar = text.replace(/\r\n/g, "\n").split("\n");
  const bloklar: ReactNode[] = [];
  let liste: string[] | null = null;
  let i = 0;

  const listeyiKapat = () => {
    if (liste) {
      const geciciliste = liste;
      bloklar.push(
        <ul key={`ul-${i}`} className="my-4 ml-5 list-disc space-y-1.5 text-zinc-300">
          {geciciliste.map((li, j) => (
            <li key={j}>{inline(li, `li-${i}-${j}`)}</li>
          ))}
        </ul>,
      );
      liste = null;
    }
  };

  for (const ham of satirlar) {
    const satir = ham.trimEnd();
    i++;

    if (/^###\s+/.test(satir)) {
      listeyiKapat();
      bloklar.push(
        <h3 key={i} className="mt-8 text-xl font-bold text-zinc-100">
          {inline(satir.replace(/^###\s+/, ""), `h3-${i}`)}
        </h3>,
      );
    } else if (/^##\s+/.test(satir)) {
      listeyiKapat();
      bloklar.push(
        <h2 key={i} className="mt-10 text-2xl font-bold text-zinc-100">
          {inline(satir.replace(/^##\s+/, ""), `h2-${i}`)}
        </h2>,
      );
    } else if (/^>\s+/.test(satir)) {
      listeyiKapat();
      bloklar.push(
        <blockquote
          key={i}
          className="my-4 border-l-4 border-brand pl-4 italic text-zinc-400"
        >
          {inline(satir.replace(/^>\s+/, ""), `bq-${i}`)}
        </blockquote>,
      );
    } else if (/^[-*]\s+/.test(satir)) {
      if (!liste) liste = [];
      liste.push(satir.replace(/^[-*]\s+/, ""));
    } else if (satir.trim() === "") {
      listeyiKapat();
    } else {
      listeyiKapat();
      bloklar.push(
        <p key={i} className="my-4 leading-relaxed text-zinc-300">
          {inline(satir, `p-${i}`)}
        </p>,
      );
    }
  }
  listeyiKapat();

  return <>{bloklar}</>;
}
