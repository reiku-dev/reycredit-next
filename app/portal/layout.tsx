import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth";
import { SessionProvider } from "@/components/app/session";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await currentSession();
  if (!session) redirect("/");
  if (session.role === "ADMIN") redirect("/admin");
  return <SessionProvider session={{ email: String(session.email), role: "BORROWER" }}>{children}</SessionProvider>;
}
