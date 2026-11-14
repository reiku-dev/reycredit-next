"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  BookUser,
  ChevronsUpDown,
  CreditCard,
  Gauge,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  PlusCircle,
  Search,
  Settings,
  TrendingUp,
} from "lucide-react";
import { Brand } from "@/components/app/brand";
import { CommandMenu } from "@/components/app/command-menu";
import { Avatar, ThemeToggle } from "@/components/app/primitives";
import { useSession, useSignOut } from "@/components/app/session";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/client/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

const NAV: { label: string; items: NavItem[] }[] = [
  {
    label: "Portfolio",
    items: [
      { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
      { href: "/admin/borrowers/new", label: "New borrower", icon: PlusCircle },
      { href: "/admin/payments", label: "Record payment", icon: CreditCard },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/admin/reports", label: "Reports", icon: BarChart3 },
      { href: "/admin/collections", label: "Collections", icon: TrendingUp },
      { href: "/admin/credit", label: "Credit scores", icon: Gauge },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin/emails", label: "Email log", icon: Mail },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href || pathname.startsWith("/admin/loans");
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

function pageTitle(pathname: string): string {
  if (pathname.startsWith("/admin/loans")) return "Loan";
  for (const g of NAV) for (const i of g.items) if (isActive(pathname, i)) return i.label;
  return "Admin";
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4 scroll-thin" aria-label="Main">
      {NAV.map((group) => (
        <div key={group.label}>
          <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">{group.label}</p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors",
                      active ? "bg-sidebar-accent text-white" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-white",
                    )}
                  >
                    <item.icon className={cn("size-4 shrink-0", active ? "text-white" : "text-sidebar-muted group-hover:text-sidebar-foreground")} />
                    {item.label}
                    {active ? <span className="ml-auto size-1.5 rounded-full bg-[hsl(221_90%_68%)]" /> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function UserMenu({ compact }: { compact?: boolean }) {
  const session = useSession();
  const signOut = useSignOut();
  const name = session.email.split("@")[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex w-full items-center gap-3 rounded-lg p-2 text-left outline-none transition-colors hover:bg-sidebar-accent/70 focus-visible:ring-2 focus-visible:ring-ring",
            compact && "w-auto",
          )}
          aria-label="Account menu"
        >
          <Avatar name={name} className="size-8 bg-primary text-primary-foreground" />
          {compact ? null : (
            <>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[13px] font-medium text-white">{name}</span>
                <span className="block truncate text-xs text-sidebar-muted">Administrator</span>
              </span>
              <ChevronsUpDown className="size-4 text-sidebar-muted" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side={compact ? "bottom" : "top"} className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-sm font-medium text-foreground">{name}</span>
          <span className="block truncate text-xs text-muted-foreground">{session.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileNav, setMobileNav] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);

  React.useEffect(() => setMobileNav(false), [pathname]);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      {/* Desktop sidebar */}
      <aside className="no-print sticky top-0 hidden h-dvh flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-16 items-center border-b border-sidebar-border px-5">
          <Brand subtitle="Admin console" inverted />
        </div>
        <SidebarNav />
        <div className="border-t border-sidebar-border p-3">
          <UserMenu />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Top bar */}
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-6 lg:h-16">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileNav(true)} aria-label="Open menu">
            <Menu />
          </Button>
          <div className="min-w-0 lg:hidden">
            <Brand className="gap-2" />
          </div>
          <h2 className="hidden truncate text-sm font-medium text-muted-foreground lg:block">{pageTitle(pathname)}</h2>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => setSearchOpen(true)}
              className="hidden h-9 w-64 items-center gap-2 rounded-lg border bg-card px-3 text-left text-[13px] text-muted-foreground shadow-sm transition-colors hover:bg-accent sm:flex"
            >
              <Search className="size-4" />
              <span className="flex-1">Search loans…</span>
              <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">⌘K</kbd>
            </button>
            <Button variant="ghost" size="icon" className="sm:hidden" onClick={() => setSearchOpen(true)} aria-label="Search">
              <Search />
            </Button>
            <ThemeToggle />
            <div className="lg:hidden">
              <UserMenu compact />
            </div>
          </div>
        </header>

        <main className="page-enter mx-auto w-full max-w-[1280px] flex-1 px-3 py-5 sm:px-6 sm:py-7">{children}</main>
      </div>

      {/* Mobile drawer */}
      <Sheet open={mobileNav} onOpenChange={setMobileNav}>
        <SheetContent side="left" className="border-sidebar-border bg-sidebar p-0 text-sidebar-foreground" hideClose>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Pages of the admin console</SheetDescription>
          <div className="flex h-16 items-center border-b border-sidebar-border px-5">
            <Brand subtitle="Admin console" inverted />
          </div>
          <SidebarNav onNavigate={() => setMobileNav(false)} />
          <div className="border-t border-sidebar-border p-3">
            <UserMenu />
          </div>
        </SheetContent>
      </Sheet>

      <CommandMenu
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onNavigate={(href) => {
          setSearchOpen(false);
          router.push(href);
        }}
        pages={NAV.flatMap((g) => g.items.map((i) => ({ href: i.href, label: i.label, icon: i.icon })))}
      />
    </div>
  );
}

export { BookUser };
