import { AdminSidebar } from "@/components/admin/AdminSidebar";

/**
 * Ortak yönetim kabuğu: solda sabit gezinme, sağda içerik.
 * Middleware /admin'i zaten role='admin' ile koruyor.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[1600px] pt-16">
      <AdminSidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
