"use client";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Mail, Paperclip, Search } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, ErrorState, PageHeader, SectionCard } from "@/components/app/primitives";
import { useEmailLog } from "@/lib/client/queries";
import { rpcRead } from "@/lib/client/rpc";

const TYPE_LABEL: Record<string, string> = {
  receipt: "Receipt", statement: "Statement", reminder: "Reminder", welcome: "Welcome", new_loan: "New loan",
  reset_pin: "PIN reset", announcement: "Announcement", late_fee_notice: "Late fee notice", due_today: "Due today",
};
const label = (t: string) => TYPE_LABEL[t] || t.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

export function EmailLog() {
  const { data, isLoading, error, refetch } = useEmailLog();
  const [query, setQuery] = React.useState("");
  const [type, setType] = React.useState("all");
  const [open, setOpen] = React.useState<number | null>(null);
  const entries = data?.entries ?? [];
  const types = Array.from(new Set(entries.map((e) => e.type).filter(Boolean)));
  const shown = entries.filter((e) => {
    if (type !== "all" && e.type !== type) return false;
    const q = query.trim().toLowerCase();
    return !q || [e.borrowerName, e.to, e.subject].some((v) => String(v || "").toLowerCase().includes(q));
  });

  return (
    <>
      <PageHeader title="Email log" description="Every email the system has sent, newest first. Open one to see exactly what the borrower received." />
      <SectionCard flush>
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email or subject" className="pl-9" aria-label="Search emails" />
          </div>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="sm:w-48" aria-label="Filter by type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {types.map((t) => (
                <SelectItem key={t} value={t}>
                  {label(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-11" />
            ))}
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : shown.length === 0 ? (
          <EmptyState icon={Mail} title="No emails found" text={entries.length ? "Try a different search." : "Emails you send will be listed here."} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sent</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((e) => (
                <TableRow key={e.id} className="cursor-pointer" onClick={() => setOpen(e.id)} tabIndex={0} onKeyDown={(k) => k.key === "Enter" && setOpen(e.id)}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {e.date}
                    <span className="block text-xs">{e.time}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{e.borrowerName || "—"}</span>
                    <span className="block max-w-[14rem] truncate text-xs text-muted-foreground">{e.to}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="neutral">{label(e.type)}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[22rem] truncate">
                    {e.subject}
                    {e.attachments ? <Paperclip className="ml-1.5 inline size-3.5 text-muted-foreground" /> : null}
                  </TableCell>
                  <TableCell>{e.status === "sent" ? <Badge variant="success" dot>Sent</Badge> : <Badge variant="danger" dot>Failed</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
      <EmailDialog id={open} onClose={() => setOpen(null)} />
    </>
  );
}

function EmailDialog({ id, onClose }: { id: number | null; onClose: () => void }) {
  const q = useQuery({ queryKey: ["emailEntry", id], enabled: id != null, queryFn: () => rpcRead("getEmailLogEntry", id as number) });
  const e = q.data?.entry;
  return (
    <Dialog open={id != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg" className="h-[88dvh]">
        <DialogHeader>
          <DialogTitle className="pr-6">{e?.subject || "Email"}</DialogTitle>
          <DialogDescription>{e ? `To ${e.to}${e.cc ? ` (cc ${e.cc})` : ""} · ${e.date} ${e.time}` : "Loading…"}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3 bg-muted/30">
          {q.isLoading ? (
            <Skeleton className="h-96" />
          ) : q.error ? (
            <Alert variant="danger">{(q.error as Error).message}</Alert>
          ) : e ? (
            <>
              {e.status !== "sent" ? <Alert variant="danger">This email failed to send{e.error ? `: ${e.error}` : "."}</Alert> : null}
              {e.attachments ? <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground"><Paperclip className="size-3.5" /> {e.attachments}</p> : null}
              {e.bodySkipped ? (
                <Alert variant="info">The body of PIN emails is never stored.</Alert>
              ) : e.bodyStored ? (
                <iframe title="Email body" sandbox="" srcDoc={e.html} className="h-[60dvh] w-full rounded-lg border bg-white" />
              ) : (
                <Alert variant="info">The body wasn't saved for this email (it was sent before bodies were kept).</Alert>
              )}
            </>
          ) : null}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
