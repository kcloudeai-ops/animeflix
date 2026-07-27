import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <p className="text-7xl font-extrabold text-brand">404</p>
        <h1 className="mt-3 text-2xl font-bold">Aradığınız sayfa bulunamadı</h1>
        <p className="mt-2 text-zinc-400">
          Bağlantı taşınmış ya da hiç var olmamış olabilir.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded bg-white px-6 py-2.5 font-semibold text-black transition-colors hover:bg-zinc-200"
        >
          Anasayfaya dön
        </Link>
      </div>
    </div>
  );
}
