"use client";
import * as React from "react";
import { Command } from "cmdk";
import { FileText } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/app/primitives";
import { useLoans } from "@/lib/client/queries";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (href: string) => void;
  pages: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
}

/** ⌘K / Ctrl+K: jump to any loan or page. */
export function CommandMenu({ open, onOpenChange, onNavigate, pages }: Props) {
  const { data: loans } = useLoans();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideClose size="md" className="top-[20%] translate-y-0 overflow-visible p-0">
        <DialogTitle className="sr-only">Search</DialogTitle>
        <DialogDescription className="sr-only">Find a loan or jump to a page</DialogDescription>
        <Command label="Search" className="flex max-h-[60dvh] flex-col overflow-hidden rounded-xl">
          <Command.Input
            autoFocus
            placeholder="Search by borrower, loan or email…"
            className="h-12 w-full border-b bg-transparent px-4 text-sm outline-none placeholder:text-muted-foreground"
          />
          <Command.List className="overflow-y-auto p-2 scroll-thin">
            <Command.Empty className="px-3 py-8 text-center text-sm text-muted-foreground">No results.</Command.Empty>
            <Command.Group heading="Pages" className="text-xs font-semibold text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
              {pages.map((p) => (
                <Command.Item
                  key={p.href}
                  value={`page ${p.label}`}
                  onSelect={() => onNavigate(p.href)}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm font-normal text-foreground aria-selected:bg-accent"
                >
                  <p.icon className="size-4 text-muted-foreground" />
                  {p.label}
                </Command.Item>
              ))}
            </Command.Group>
            {loans?.length ? (
              <Command.Group heading="Loans" className="mt-1 text-xs font-semibold text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
                {loans.map((l) => (
                  <Command.Item
                    key={l.rowIndex}
                    value={`${l.name} ${l.loan} ${l.email}`}
                    onSelect={() => onNavigate(`/admin/loans/${l.rowIndex}`)}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm font-normal text-foreground aria-selected:bg-accent"
                  >
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{l.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{l.loan}</span>
                    </span>
                    <StatusBadge status={l.status} />
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
