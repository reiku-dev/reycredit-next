"use client";
import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, Mail, Send } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, SectionCard } from "@/components/app/primitives";
import { money, plural, todayISO } from "@/lib/client/format";
import { rpc, rpcRead } from "@/lib/client/rpc";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const AUDIENCES = [
  { value: "active", label: "Borrowers who still owe", hint: "Everyone with a balance." },
  { value: "overdue", label: "Borrowers who are overdue", hint: "Only those with an amount past due." },
  { value: "everyone", label: "Everyone on file", hint: "Including fully paid borrowers." },
];

function PreviewDialog({ html, subject, onClose }: { html: string; subject: string; onClose: () => void }) {
  return (
    <Dialog open={!!html} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg" className="h-[88dvh]">
        <DialogHeader>
          <DialogTitle className="pr-6">{subject}</DialogTitle>
          <DialogDescription>Preview using a sample borrower. Names and loans are filled in per recipient.</DialogDescription>
        </DialogHeader>
        <DialogBody className="bg-muted/30">
          <iframe title="Email preview" sandbox="" srcDoc={html} className="h-[68dvh] w-full rounded-lg border bg-white" />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

export function Announcements() {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <GeneralAnnouncement />
      <LateFeeNotice />
    </div>
  );
}

function GeneralAnnouncement() {
  const [audience, setAudience] = React.useState("active");
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [button, setButton] = React.useState(true);
  const [testTo, setTestTo] = React.useState("");
  const [preview, setPreview] = React.useState<{ html: string; subject: string } | null>(null);
  const [confirm, setConfirm] = React.useState(false);
  const aud = useQuery({ queryKey: ["audience", audience], queryFn: () => rpcRead("getAnnouncementAudience", audience) });
  const payload = { audience, subject, message, button };

  const prev = useMutation({
    mutationFn: async () => rpcRead("previewAnnouncement", payload) as Promise<{ html: string; subject: string }>,
    onSuccess: (r) => setPreview({ html: r.html, subject: r.subject }),
    onError: (e: Error) => toast.error(e.message),
  });
  const test = useMutation({
    mutationFn: async () => {
      if (!testTo.trim()) throw new Error("Enter the email to send the test to.");
      const r = await rpc("sendAnnouncement", { ...payload, testTo: testTo.trim() });
      if (!r.success) throw new Error((r as { msg?: string }).msg || "Couldn't send.");
    },
    onSuccess: () => toast.success("Test email sent"),
    onError: (e: Error) => toast.error("Test not sent", { description: e.message }),
  });
  const send = useMutation({
    mutationFn: async () => rpcRead("sendAnnouncement", payload) as Promise<{ sent?: number; skipped?: number; failed?: number; remaining?: number }>,
    onSuccess: (r) => {
      toast.success("Announcement sent", { description: `${r.sent ?? 0} sent${r.skipped ? `, ${r.skipped} already had it` : ""}${r.failed ? `, ${r.failed} failed` : ""}${r.remaining ? `. ${r.remaining} left: send again to continue.` : "."}` });
      setConfirm(false);
    },
    onError: (e: Error) => { toast.error("Couldn't send", { description: e.message }); setConfirm(false); },
  });

  return (
    <SectionCard title="Announcement" description="Send one message to many borrowers at once. Sending again skips anyone who already got it.">
      <div className="space-y-4">
        <Field label="Send to">
          <Select value={audience} onValueChange={setAudience}>
            <SelectTrigger aria-label="Audience"><SelectValue /></SelectTrigger>
            <SelectContent>{AUDIENCES.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
          </Select>
          <p className="mt-1.5 text-xs text-muted-foreground">{AUDIENCES.find((a) => a.value === audience)?.hint} {aud.data ? <b className="text-foreground">{plural(aud.data.borrowers, "recipient")}</b> : null}</p>
        </Field>
        <Field label="Subject" htmlFor="an-sub"><Input id="an-sub" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} /></Field>
        <Field label="Message" htmlFor="an-msg">
          <textarea id="an-msg" value={message} onChange={(e) => setMessage(e.target.value)} rows={6} maxLength={5000} className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </Field>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={button} onCheckedChange={(c) => setButton(c === true)} /> Include a “Open my account” button</label>
        <div className="flex flex-wrap items-end gap-2 border-t pt-4">
          <Field label="Send a test to" htmlFor="an-test" className="min-w-0 flex-1">
            <Input id="an-test" type="email" placeholder="you@email.com" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
          </Field>
          <Button variant="outline" onClick={() => test.mutate()} loading={test.isPending}><Mail /> Test</Button>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => prev.mutate()} loading={prev.isPending}><Eye /> Preview</Button>
          <Button onClick={() => { if (!subject.trim() || !message.trim()) return void toast.error("Write a subject and a message first."); setConfirm(true); }}><Send /> Send to {aud.data ? plural(aud.data.borrowers, "borrower") : "borrowers"}</Button>
        </div>
      </div>
      <PreviewDialog html={preview?.html ?? ""} subject={preview?.subject ?? ""} onClose={() => setPreview(null)} />
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send this announcement?</AlertDialogTitle>
            <AlertDialogDescription>It will be emailed to {aud.data ? plural(aud.data.borrowers, "borrower") : "the selected borrowers"} right now. Emails can't be recalled.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not yet</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); send.mutate(); }}>{send.isPending ? "Sending…" : "Send now"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SectionCard>
  );
}

function LateFeeNotice() {
  const info = useQuery({ queryKey: ["lateFeeInfo"], queryFn: () => rpcRead("getLateFeeNoticeInfo") });
  const [amount, setAmount] = React.useState("");
  const [date, setDate] = React.useState(todayISO());
  const [apply, setApply] = React.useState(true);
  const [testTo, setTestTo] = React.useState("");
  const [preview, setPreview] = React.useState<{ html: string; subject: string } | null>(null);
  const [confirm, setConfirm] = React.useState(false);
  React.useEffect(() => { if (info.data && !amount && info.data.defaultAmount) setAmount(String(info.data.defaultAmount)); }, [info.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const payload = { amount: Number(amount), effectiveDate: date, applyToLoans: apply };

  const prev = useMutation({
    mutationFn: async () => rpcRead("previewLateFeeNotice", payload) as Promise<{ html: string; subject: string }>,
    onSuccess: (r) => setPreview({ html: r.html, subject: r.subject }),
    onError: (e: Error) => toast.error(e.message),
  });
  const test = useMutation({
    mutationFn: async () => {
      if (!testTo.trim()) throw new Error("Enter the email to send the test to.");
      const r = await rpc("sendLateFeeNotice", { ...payload, applyToLoans: false, testTo: testTo.trim() });
      if (!r.success) throw new Error((r as { msg?: string }).msg || "Couldn't send.");
    },
    onSuccess: () => toast.success("Test email sent"),
    onError: (e: Error) => toast.error("Test not sent", { description: e.message }),
  });
  const send = useMutation({
    mutationFn: async () => rpcRead("sendLateFeeNotice", payload) as Promise<{ sent?: number; failed?: number; appliedToLoans?: number | null }>,
    onSuccess: (r) => {
      toast.success("Late fee notice sent", { description: `${r.sent ?? 0} sent${r.appliedToLoans ? `. Fee switched on for ${plural(r.appliedToLoans, "loan")}.` : "."}` });
      setConfirm(false);
    },
    onError: (e: Error) => { toast.error("Couldn't send", { description: e.message }); setConfirm(false); },
  });

  return (
    <SectionCard title="Late payment fee notice" description="Announce a flat late fee and optionally switch it on for every active loan from the start date.">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Late fee (₱)" htmlFor="lf-amt"><Input id="lf-amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Field label="Starts on" htmlFor="lf-date"><Input id="lf-date" type="date" min={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        <label className="flex items-start gap-2 text-sm"><Checkbox className="mt-0.5" checked={apply} onCheckedChange={(c) => setApply(c === true)} /> <span>Also set this fee on every active loan{info.data ? ` (${plural(info.data.loans, "loan")})` : ""}, starting on that date.</span></label>
        <div className="flex flex-wrap items-end gap-2 border-t pt-4">
          <Field label="Send a test to" htmlFor="lf-test" className="min-w-0 flex-1"><Input id="lf-test" type="email" placeholder="you@email.com" value={testTo} onChange={(e) => setTestTo(e.target.value)} /></Field>
          <Button variant="outline" onClick={() => test.mutate()} loading={test.isPending}><Mail /> Test</Button>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => prev.mutate()} loading={prev.isPending}><Eye /> Preview</Button>
          <Button onClick={() => { if (!(Number(amount) > 0)) return void toast.error("Enter the late fee amount first."); setConfirm(true); }}><Send /> Send to {info.data ? plural(info.data.borrowers, "borrower") : "borrowers"}</Button>
        </div>
        {apply ? <Alert variant="warning">Sending also updates the late fee on {info.data ? plural(info.data.loans, "loan") : "all active loans"}.</Alert> : null}
      </div>
      <PreviewDialog html={preview?.html ?? ""} subject={preview?.subject ?? ""} onClose={() => setPreview(null)} />
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send the late fee notice?</AlertDialogTitle>
            <AlertDialogDescription>A {money(Number(amount) || 0)} late fee starting {date}{apply ? ", applied to every active loan," : ""} will be emailed to {info.data ? plural(info.data.borrowers, "borrower") : "all borrowers"} now.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not yet</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); send.mutate(); }}>{send.isPending ? "Sending…" : "Send now"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SectionCard>
  );
}
