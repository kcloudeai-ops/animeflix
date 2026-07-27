import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  isSupabaseConfigured,
} from "@/lib/supabase/config";

/**
 * Giriş yapmış olmayı gerektiren yollar.
 *
 * `/api/admin` ayrıca listelenmeli: `/api/admin/...` yolları `/admin` ile
 * BAŞLAMAZ, dolayısıyla sadece "/admin" yazmak API uçlarını korumasız
 * bırakıyordu (catalog ve search kimlik doğrulamasız 200 dönüyordu).
 */
const AUTH_REQUIRED = ["/admin", "/api/admin", "/profil", "/listem"];
/** Ek olarak `role = 'admin'` gerektiren yollar. */
const ADMIN_ONLY = ["/admin", "/api/admin"];

const startsWithAny = (path: string, prefixes: string[]) =>
  prefixes.some((p) => path === p || path.startsWith(`${p}/`));

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ----------------------------------------------------------
  // DEMO MOD: Supabase env'leri yoksa auth'u atla.
  // Üretimde env her zaman dolu olacağı için bu dal çalışmaz;
  // yine de kazara açık kalmasın diye production'da kapatılır.
  // ----------------------------------------------------------
  if (!isSupabaseConfigured) {
    if (
      process.env.NODE_ENV === "production" &&
      startsWithAny(pathname, AUTH_REQUIRED)
    ) {
      return pathname.startsWith("/api/")
        ? NextResponse.json({ error: "Yapılandırma eksik" }, { status: 503 })
        : NextResponse.redirect(new URL("/giris", request.url));
    }
    return NextResponse.next();
  }

  // `supabaseResponse`, Supabase'in tazelediği oturum cookie'lerini taşır.
  // Erken dönüşlerde bile bu cookie'leri korumak zorundayız.
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // ÖNEMLİ: getUser() çağrısı ile createServerClient arasına kod koymayın.
  // Bu çağrı token'ı tazeler; atlanırsa kullanıcılar rastgele çıkış yapar.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const needsAuth = startsWithAny(pathname, AUTH_REQUIRED);
  const needsAdmin = startsWithAny(pathname, ADMIN_ONLY);
  // API uçları yönlendirilmemeli: fetch çağrısı HTML giriş sayfasını
  // alıp JSON ayrıştırmaya çalışır ve anlaşılmaz hata verir.
  const isApi = pathname.startsWith("/api/");

  // 1) Korumalı yol + oturum yok
  if (needsAuth && !user) {
    if (isApi) {
      return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
    }
    const loginUrl = new URL("/giris", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 2) Rol kontrolü
  if (needsAdmin && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      if (isApi) {
        return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });
      }
      // Var olmayan sayfa gibi davran: /admin'in varlığını sızdırma.
      return NextResponse.rewrite(new URL("/404", request.url));
    }
  }

  // 3) Zaten girişliyken /giris'e gitmeye çalışma
  if (user && (pathname === "/giris" || pathname === "/kayit")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Şunlar HARİÇ tüm yollarda çalış:
     *  - _next/static, _next/image  (build çıktıları)
     *  - favicon ve statik görseller
     * Oturum tazeleme tüm sayfalarda gerektiği için geniş tutuluyor.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
