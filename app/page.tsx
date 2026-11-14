import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth";
import { SignIn } from "@/features/auth/sign-in";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: { expired?: string } }) {
  const session = await currentSession();
  if (session) redirect(session.role === "ADMIN" ? "/admin" : "/portal");
  return <SignIn expired={searchParams.expired === "1"} />;
}
