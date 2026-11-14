/** Display helpers shared by every screen. */

const PESO = new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PESO_WHOLE = new Intl.NumberFormat("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export function numOf(v: unknown): number {
  return parseFloat(String(v == null ? 0 : v).replace(/[^0-9.\-]/g, "")) || 0;
}

export function money(n: unknown): string {
  return "₱" + PESO.format(Number(n) || 0);
}

/** ₱12,345 for chart labels and tight spaces. */
export function moneyShort(n: unknown): string {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1_000_000) return "₱" + (v / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (Math.abs(v) >= 10_000) return "₱" + (v / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return "₱" + PESO_WHOLE.format(v);
}

export function plural(n: number, one: string, many = one + "s"): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Repayment progress against what has actually been charged, which includes late penalties.
 * Measuring against the original total payable reads 100% as soon as the principal is covered,
 * even with penalties still outstanding.
 */
export function progressOf(paid: number, balance: number): number {
  const charged = Number(paid || 0) + Number(balance || 0);
  return charged > 0 ? Math.min(100, Math.round((Number(paid || 0) / charged) * 100)) : 0;
}

export function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** yyyy-mm-dd -> MM/dd/yyyy, the format the server stores and expects. */
export function isoToUS(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}

export function initials(name: string): string {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return ((parts[0][0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : parts[0][1] || "")).toUpperCase();
}

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

/** Maps the engine's status label (it carries an emoji prefix) to a readable label and tone. */
export function statusMeta(status: string | undefined | null): { tone: StatusTone; label: string } {
  const u = String(status || "").toUpperCase();
  if (u.includes("FULLY PAID")) return { tone: "success", label: "Fully paid" };
  if (u.includes("DELINQUENT")) return { tone: "danger", label: "Delinquent" };
  if (u.includes("PAST TERM")) return { tone: "danger", label: "Past term" };
  if (u.includes("OVERDUE")) return { tone: "danger", label: "Overdue" };
  if (u.includes("LACKING")) return { tone: "warning", label: "Partial payment" };
  if (u.includes("PARTIAL")) return { tone: "warning", label: "Partial" };
  if (u.includes("DUE SOON")) return { tone: "warning", label: "Due soon" };
  if (u.includes("UPDATED")) return { tone: "success", label: "Up to date" };
  if (u.includes("PAID")) return { tone: "success", label: "Paid" };
  if (u.includes("FOR PAYMENT")) return { tone: "info", label: "For payment" };
  if (u.includes("IN PROGRESS")) return { tone: "neutral", label: "Not yet billed" };
  if (u.includes("PENDING")) return { tone: "neutral", label: "Pending" };
  return { tone: "neutral", label: String(status || "Unknown").replace(/[^\x20-\x7E]/g, "").trim() || "Unknown" };
}

export function isClosed(status: string | undefined | null): boolean {
  return String(status || "").toUpperCase().includes("FULLY PAID");
}

export function isLate(status: string | undefined | null): boolean {
  const s = String(status || "").toUpperCase();
  return s.includes("OVERDUE") || s.includes("LACKING") || s.includes("DELINQUENT");
}
