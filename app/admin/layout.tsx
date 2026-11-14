import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth";
import { SessionProvider } from "@/components/app/session";
import { AdminShell } from "@/components/app/admin-shell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await currentSession();
  if (!session) redirect("/");
  if (session.role !== "ADMIN") redirect("/portal");
  return (
    <SessionProvider session={{ email: String(session.email), role: "ADMIN" }}>
      <AdminShell>{children}</AdminShell>
    </SessionProvider>
  );
}
