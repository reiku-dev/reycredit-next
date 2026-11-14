"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { setUnauthorizedHandler } from "@/lib/client/rpc";

export interface SessionInfo {
  email: string;
  role: "ADMIN" | "BORROWER";
}

const SessionContext = React.createContext<SessionInfo | null>(null);

export function SessionProvider({ session, children }: { session: SessionInfo; children: React.ReactNode }) {
  const router = useRouter();
  const qc = useQueryClient();

  React.useEffect(() => {
    setUnauthorizedHandler(() => {
      qc.clear();
      router.replace("/?expired=1");
    });
    return () => setUnauthorizedHandler(null);
  }, [qc, router]);

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionInfo {
  const s = React.useContext(SessionContext);
  if (!s) throw new Error("useSession must be used inside <SessionProvider>");
  return s;
}

export function useSignOut() {
  const router = useRouter();
  const qc = useQueryClient();
  return React.useCallback(async () => {
    try {
      await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
    } catch {
      /* the cookie is cleared server-side; navigating away is enough */
    }
    qc.clear();
    router.replace("/");
    router.refresh();
  }, [qc, router]);
}
