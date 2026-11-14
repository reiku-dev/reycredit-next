"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { rpc, rpcRead } from "@/lib/client/rpc";

/** Query keys in one place so mutations can invalidate precisely. */
export const keys = {
  loans: ["loans"] as const,
  loan: (row: number) => ["loan", row] as const,
  schedule: (row: number) => ["schedule", row] as const,
  score: (email: string) => ["score", email] as const,
  scores: ["scores"] as const,
  report: ["report"] as const,
  collections: ["collections"] as const,
  emailLog: ["emailLog"] as const,
  emailEntry: (id: number) => ["emailEntry", id] as const,
  config: ["config"] as const,
  banks: ["banks"] as const,
  users: ["users"] as const,
  portalInfo: ["portalInfo"] as const,
  portalLoans: ["portalLoans"] as const,
  profile: ["profile"] as const,
  guide: (email: string) => ["guide", email] as const,
};

export function useLoans() {
  return useQuery({ queryKey: keys.loans, queryFn: () => rpc("getAdminBorrowerList") });
}

export function useLoanDetail(row: number | null) {
  return useQuery({
    queryKey: keys.loan(row ?? 0),
    enabled: row != null && row > 0,
    queryFn: async () => {
      const d = await rpc("getAdminBorrowerDetail", row as number);
      if ("error" in d) throw new Error(d.error);
      return d;
    },
  });
}

export function useBillingSchedule(row: number | null) {
  return useQuery({ queryKey: keys.schedule(row ?? 0), enabled: !!row, queryFn: () => rpcRead("getBillingSchedule", row as number) });
}

export function useCreditScore(email: string | null | undefined) {
  return useQuery({ queryKey: keys.score(email ?? ""), enabled: !!email, queryFn: () => rpcRead("getCreditScore", email as string), retry: false });
}

export function useCreditScores() {
  return useQuery({ queryKey: keys.scores, queryFn: () => rpcRead("getCreditScores") });
}

export function useReport() {
  return useQuery({ queryKey: keys.report, queryFn: () => rpcRead("getAdvancedReport") });
}

export function useCollections() {
  return useQuery({ queryKey: keys.collections, queryFn: () => rpcRead("getCollectionHistory") });
}

export function useEmailLog() {
  return useQuery({ queryKey: keys.emailLog, queryFn: () => rpcRead("getEmailLog", 150) });
}

export function useConfig() {
  return useQuery({ queryKey: keys.config, queryFn: () => rpc("getConfig"), staleTime: 5 * 60_000 });
}

export function useBanks() {
  return useQuery({ queryKey: keys.banks, queryFn: () => rpc("getBankList"), staleTime: 60_000 });
}

export function useUsers() {
  return useQuery({ queryKey: keys.users, queryFn: () => rpc("getUsersList") });
}

export function usePortalInfo() {
  return useQuery({ queryKey: keys.portalInfo, queryFn: () => rpc("getPortalInfo"), staleTime: 5 * 60_000 });
}

/** Refresh everything that depends on loan figures after a payment, edit or new loan. */
export function useRefreshLoans() {
  const qc = useQueryClient();
  return (row?: number) => {
    qc.invalidateQueries({ queryKey: keys.loans });
    qc.invalidateQueries({ queryKey: keys.report });
    qc.invalidateQueries({ queryKey: keys.collections });
    qc.invalidateQueries({ queryKey: keys.scores });
    if (row) {
      qc.invalidateQueries({ queryKey: keys.loan(row) });
      qc.invalidateQueries({ queryKey: keys.schedule(row) });
    }
  };
}
