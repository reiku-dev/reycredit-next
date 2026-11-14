"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Landmark, Megaphone, Pencil, Plus, ShieldCheck, Trash2, Wrench } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CardSkeleton, EmptyState, ErrorState, Field, Money, PageHeader, SectionCard } from "@/components/app/primitives";
import { money } from "@/lib/client/format";
import { keys, useBanks, useConfig, useUsers } from "@/lib/client/queries";
import { rpc, rpcRead } from "@/lib/client/rpc";
import { Announcements } from "./announcements";

export function Settings() {
  return (
    <>
      <PageHeader title="Settings" description="Company details, banks, sign-ins and bulk messages." />
      <Tabs defaultValue="company">
        <TabsList className="max-w-full overflow-x-auto">
          <TabsTrigger value="company"><Building2 className="mr-1.5 size-3.5" />Company</TabsTrigger>
          <TabsTrigger value="banks"><Landmark className="mr-1.5 size-3.5" />Banks</TabsTrigger>
          <TabsTrigger value="people"><ShieldCheck className="mr-1.5 size-3.5" />Sign-ins</TabsTrigger>
          <TabsTrigger value="announce"><Megaphone className="mr-1.5 size-3.5" />Announcements</TabsTrigger>
          <TabsTrigger value="maintenance"><Wrench className="mr-1.5 size-3.5" />Data checks</TabsTrigger>
        </TabsList>
        <TabsContent value="company"><CompanyTab /></TabsContent>
        <TabsContent value="banks"><BanksTab /></TabsContent>
        <TabsContent value="people"><PeopleTab /></TabsContent>
        <TabsContent value="announce"><Announcements /></TabsContent>
        <TabsContent value="maintenance"><MaintenanceTab /></TabsContent>
      </Tabs>
    </>
  );
}

/* ---------------- Company ---------------- */

const COMPANY_FIELDS: { key: string; label: string; hint?: string; group: string; inputMode?: "decimal" | "text" }[] = [
  { key: "COMPANY_NAME", label: "Company name", group: "Business" },
  { key: "LENDER_NAME", label: "Lender's full name", group: "Business", hint: "Appears on the loan agreement." },
  { key: "COMPANY_ADDR", label: "Company address", group: "Business" },
  { key: "LENDER_ADDR", label: "Lender's address", group: "Business" },
  { key: "SUPPORT_EMAIL", label: "Support email", group: "Contact" },
  { key: "SUPPORT_PHONE", label: "Support phone", group: "Contact" },
  { key: "OFFICE_HOURS", label: "Office hours", group: "Contact" },
  { key: "PORTAL_URL", label: "Portal link", group: "Links", hint: "Used for the buttons in emails." },
  { key: "LOGO_URL", label: "Logo URL", group: "Links" },
  { key: "GCASH_ACCOUNT", label: "GCash number", group: "How borrowers pay" },
  { key: "BPI_ACCOUNT", label: "BPI account", group: "How borrowers pay" },
  { key: "MARIBANK_ACCOUNT", label: "MariBank account", group: "How borrowers pay" },
  { key: "PENALTY_RATE", label: "Late penalty (%)", group: "Charges", inputMode: "decimal", hint: "Charged on the full bill on the day after its due date." },
  { key: "LATE_FEE_DEFAULT", label: "Default late fee (₱)", group: "Charges", inputMode: "decimal", hint: "Pre-filled on new loans." },
];

function CompanyTab() {
  const { data, isLoading, error, refetch } = useConfig();
  const qc = useQueryClient();
  const form = useForm<Record<string, string>>({ values: data ?? {} });
  const save = useMutation({
    mutationFn: async (v: Record<string, string>) => {
      const patch: Record<string, string> = {};
      for (const f of COMPANY_FIELDS) patch[f.key] = (v[f.key] ?? "").trim();
      const res = await rpc("saveConfig", patch);
      if (!res.success) throw new Error((res as { msg?: string }).msg || "Couldn't save.");
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.config });
      void qc.invalidateQueries({ queryKey: keys.portalInfo });
      toast.success("Settings saved");
    },
    onError: (e: Error) => toast.error("Couldn't save", { description: e.message }),
  });
  if (isLoading) return <CardSkeleton rows={6} />;
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  const groups = Array.from(new Set(COMPANY_FIELDS.map((f) => f.group)));
  return (
    <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-5">
      {groups.map((g) => (
        <SectionCard key={g} title={g}>
          <div className="grid gap-4 sm:grid-cols-2">
            {COMPANY_FIELDS.filter((f) => f.group === g).map((f) => (
              <Field key={f.key} label={f.label} htmlFor={`cfg-${f.key}`} hint={f.hint}>
                <Input id={`cfg-${f.key}`} inputMode={f.inputMode} {...form.register(f.key)} />
              </Field>
            ))}
          </div>
        </SectionCard>
      ))}
      <Alert variant="info">The lender's signature isn't stored here. It is kept privately on the server.</Alert>
      <div className="flex justify-end">
        <Button type="submit" loading={save.isPending}>Save settings</Button>
      </div>
    </form>
  );
}

/* ---------------- Banks ---------------- */

type BankItem = { row: number; bank: string; statementDay: number; dueDay: number; dueMonth: string };
interface BankValues { bank: string; statementDay: string; dueDay: string; dueMonth: string }

function BanksTab() {
  const { data, isLoading, error, refetch } = useBanks();
  const qc = useQueryClient();
  const [edit, setEdit] = React.useState<BankItem | "new" | null>(null);
  const [del, setDel] = React.useState<BankItem | null>(null);
  const done = () => void qc.invalidateQueries({ queryKey: keys.banks });

  const remove = useMutation({
    mutationFn: async (b: BankItem) => {
      const r = await rpc("deleteBankEntry", b.row);
      if (!r.success) throw new Error((r as { msg?: string }).msg || "Couldn't delete.");
    },
    onSuccess: () => { done(); toast.success("Bank deleted"); setDel(null); },
    onError: (e: Error) => toast.error("Couldn't delete", { description: e.message }),
  });

  return (
    <SectionCard
      title="Banks and partners"
      description="A bank sets the statement date and due date for the loans billed through it."
      flush
      actions={<Button size="sm" onClick={() => setEdit("new")}><Plus /> Add bank</Button>}
    >
      {isLoading ? <div className="p-5"><Skeleton className="h-24" /></div> : error ? <ErrorState error={error} onRetry={() => void refetch()} /> : !data?.length ? (
        <EmptyState icon={Landmark} title="No banks yet" text="Add a bank if some loans are billed on a bank's statement cycle." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bank</TableHead>
              <TableHead className="text-right">Statement day</TableHead>
              <TableHead className="text-right">Due day</TableHead>
              <TableHead>Due month</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((b) => (
              <TableRow key={b.row}>
                <TableCell className="font-medium">{b.bank}</TableCell>
                <TableCell className="num text-right">{b.statementDay}</TableCell>
                <TableCell className="num text-right">{b.dueDay}</TableCell>
                <TableCell className="text-muted-foreground">{b.dueMonth}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon-sm" aria-label={`Edit ${b.bank}`} onClick={() => setEdit(b)}><Pencil /></Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`Delete ${b.bank}`} onClick={() => setDel(b)}><Trash2 className="text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <BankDialog target={edit} onClose={() => setEdit(null)} onSaved={done} />
      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {del?.bank}?</AlertDialogTitle>
            <AlertDialogDescription>Loans using this bank keep working but lose its billing dates until you pick another bank for them.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={(e) => { e.preventDefault(); if (del) remove.mutate(del); }}>
              {remove.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SectionCard>
  );
}

function BankDialog({ target, onClose, onSaved }: { target: BankItem | "new" | null; onClose: () => void; onSaved: () => void }) {
  const editing = target && target !== "new" ? target : null;
  const form = useForm<BankValues>({ defaultValues: { bank: "", statementDay: "1", dueDay: "1", dueMonth: "Next Month" } });
  React.useEffect(() => {
    if (target) form.reset(editing ? { bank: editing.bank, statementDay: String(editing.statementDay), dueDay: String(editing.dueDay), dueMonth: editing.dueMonth } : { bank: "", statementDay: "1", dueDay: "1", dueMonth: "Next Month" });
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = useMutation({
    mutationFn: async (v: BankValues) => {
      const day = (s: string) => Math.min(31, Math.max(1, Math.round(Number(s) || 1)));
      const d = { bank: v.bank.trim(), statementDay: day(v.statementDay), dueDay: day(v.dueDay), dueMonth: v.dueMonth };
      if (!d.bank) throw new Error("Enter the bank's name.");
      const r = editing ? await rpc("updateBankEntry", editing.row, d) : await rpc("addBankEntry", d);
      if (!r.success) throw new Error((r as { msg?: string }).msg || "Couldn't save.");
    },
    onSuccess: () => { onSaved(); toast.success("Bank saved"); onClose(); },
    onError: (e: Error) => toast.error("Couldn't save", { description: e.message }),
  });
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit bank" : "Add bank"}</DialogTitle>
            <DialogDescription>Statement day is when the bank issues its statement. Due day is when payment is due.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Field label="Bank name" htmlFor="bk-name" required><Input id="bk-name" {...form.register("bank")} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Statement day" htmlFor="bk-st"><Input id="bk-st" inputMode="numeric" {...form.register("statementDay")} /></Field>
              <Field label="Due day" htmlFor="bk-due"><Input id="bk-due" inputMode="numeric" {...form.register("dueDay")} /></Field>
            </div>
            <Field label="Due month">
              <Select value={form.watch("dueMonth")} onValueChange={(v) => form.setValue("dueMonth", v)}>
                <SelectTrigger aria-label="Due month"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Next Month">Month after the statement</SelectItem>
                  <SelectItem value="Same Month">Same month as the statement</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={save.isPending}>Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Sign-ins ---------------- */

function PeopleTab() {
  const users = useUsers();
  const qc = useQueryClient();
  const audit = useQuery({ queryKey: ["weakAudit"], queryFn: () => rpcRead("auditWeakPasswords") });
  const [pw, setPw] = React.useState<{ row: number; email: string } | null>(null);
  const [value, setValue] = React.useState("");

  const sendPin = useMutation({
    mutationFn: async (email: string) => {
      const r = await rpc("resetPasswordToDefault", email);
      if (!r.success) throw new Error(r.msg || "Couldn't send.");
      return r.msg;
    },
    onSuccess: (m) => toast.success("New PIN sent", { description: m }),
    onError: (e: Error) => toast.error("Couldn't send", { description: e.message }),
  });
  const fixWeak = useMutation({
    mutationFn: async () => {
      const r = await rpcRead("resetWeakPasswords");
      return r as { changed: number; emailed: number; failed: string[] };
    },
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ["weakAudit"] });
      toast.success(`${r.changed} PIN${r.changed === 1 ? "" : "s"} replaced`, { description: `${r.emailed} emailed${r.failed.length ? `, ${r.failed.length} failed` : ""}.` });
    },
    onError: (e: Error) => toast.error("Couldn't reset", { description: e.message }),
  });
  const setPassword = useMutation({
    mutationFn: async () => {
      if (!pw) return;
      if (value.length < 4) throw new Error("Use at least 4 characters.");
      const r = await rpc("updateUserAdmin", pw.row, { password: value });
      if (!r.success) throw new Error((r as { msg?: string }).msg || "Couldn't save.");
    },
    onSuccess: () => { toast.success("Password changed"); setPw(null); setValue(""); },
    onError: (e: Error) => toast.error("Couldn't save", { description: e.message }),
  });

  return (
    <div className="space-y-5">
      {audit.data && audit.data.count > 0 ? (
        <Alert variant="warning" className="items-start">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span><b>{audit.data.count}</b> of {audit.data.total} borrowers still use the old default password. Give each a random PIN and email it to them.</span>
            <Button size="sm" onClick={() => fixWeak.mutate()} loading={fixWeak.isPending}>Replace and email</Button>
          </div>
        </Alert>
      ) : null}
      <SectionCard title="Accounts" description="Admins and borrowers who can sign in." flush>
        {users.isLoading ? <div className="p-5"><Skeleton className="h-24" /></div> : users.error ? <ErrorState error={users.error} onRetry={() => void users.refetch()} /> : (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead className="w-56" /></TableRow>
            </TableHeader>
            <TableBody>
              {(users.data ?? []).map((u) => (
                <TableRow key={u.row}>
                  <TableCell className="font-medium">{u.email}</TableCell>
                  <TableCell>{u.role === "ADMIN" ? <Badge variant="info">Admin</Badge> : <Badge variant="neutral">Borrower</Badge>}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      {u.role !== "ADMIN" ? <Button variant="outline" size="sm" onClick={() => sendPin.mutate(u.email)} disabled={sendPin.isPending}>Email new PIN</Button> : null}
                      <Button variant="outline" size="sm" onClick={() => { setPw({ row: u.row, email: u.email }); setValue(""); }}>Set password</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
      <Dialog open={!!pw} onOpenChange={(o) => !o && setPw(null)}>
        <DialogContent size="sm">
          <form onSubmit={(e) => { e.preventDefault(); setPassword.mutate(); }} className="flex min-h-0 flex-1 flex-col">
            <DialogHeader>
              <DialogTitle>Set a new password</DialogTitle>
              <DialogDescription>{pw?.email}</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <Field label="New password" htmlFor="np"><Input id="np" type="text" autoComplete="off" value={value} onChange={(e) => setValue(e.target.value)} /></Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPw(null)}>Cancel</Button>
              <Button type="submit" loading={setPassword.isPending}>Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- Data checks ---------------- */

function MaintenanceTab() {
  const qc = useQueryClient();
  const audit = useQuery({ queryKey: ["termsAudit"], queryFn: () => rpcRead("auditLoanTerms") });
  const fix = useMutation({
    mutationFn: async () => rpcRead("fixLoanAmortizations") as Promise<{ report: string }>,
    onSuccess: (r) => { toast.success(r.report); void qc.invalidateQueries({ queryKey: ["termsAudit"] }); void qc.invalidateQueries({ queryKey: keys.loans }); },
    onError: (e: Error) => toast.error("Couldn't fix", { description: e.message }),
  });
  if (audit.isLoading) return <CardSkeleton rows={3} />;
  if (audit.error || !audit.data) return <ErrorState error={audit.error} onRetry={() => void audit.refetch()} />;
  const a = audit.data;
  return (
    <SectionCard
      title="Loan amortization check"
      description="Compares each loan's monthly amount with its total payable and term."
      actions={a.count > 0 ? <Button size="sm" onClick={() => fix.mutate()} loading={fix.isPending}>Correct all</Button> : undefined}
      flush={a.count > 0}
    >
      {a.count === 0 ? (
        <Alert variant="success">{a.report}</Alert>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Borrower</TableHead>
              <TableHead className="text-right">Term</TableHead>
              <TableHead className="text-right">Total payable</TableHead>
              <TableHead className="text-right">Saved monthly</TableHead>
              <TableHead className="text-right">Should be</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {a.loans.map((l) => (
              <TableRow key={l.row}>
                <TableCell><span className="font-medium">{l.name}</span><span className="block text-xs text-muted-foreground">{l.loan}</span></TableCell>
                <TableCell className="num text-right">{l.terms}</TableCell>
                <TableCell className="num text-right">{money(l.payable)}</TableCell>
                <TableCell className="num text-right text-destructive">{money(l.stored)}</TableCell>
                <TableCell className="num text-right font-medium"><Money value={l.implied} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </SectionCard>
  );
}
