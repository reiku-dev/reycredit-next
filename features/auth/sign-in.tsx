"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Lock, Mail, ShieldCheck, Smartphone, Wallet } from "lucide-react";
import { Brand } from "@/components/app/brand";
import { InstallPrompt } from "@/components/app/install-prompt";
import { Field, ThemeToggle } from "@/components/app/primitives";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { usePortalInfo } from "@/lib/client/queries";
import { rpc } from "@/lib/client/rpc";

const schema = z.object({
  email: z.string().trim().min(1, "Enter your email.").email("That doesn't look like an email address."),
  password: z.string().min(1, "Enter your password."),
});
type FormValues = z.infer<typeof schema>;

export function SignIn({ expired }: { expired?: boolean }) {
  const router = useRouter();
  const { data: info } = usePortalInfo();
  const [error, setError] = React.useState<string | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);
  const [forgot, setForgot] = React.useState(false);
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });
  const { register, handleSubmit, formState } = form;

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      const res = await rpc("validateLogin", values.email, values.password);
      if (!res || !res.success) {
        setError(res && "locked" in res && res.locked && res.msg ? res.msg : "That email and password don't match.");
        return;
      }
      router.replace(res.role === "ADMIN" ? "/admin" : "/portal");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    }
  }

  const company = info?.companyName || "Rey Credit";

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-32 -top-32 size-[28rem] rounded-full bg-primary/25 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-40 -left-24 size-[26rem] rounded-full bg-[hsl(262_70%_55%)]/15 blur-3xl" aria-hidden />
        <Brand inverted className="relative" />
        <div className="relative max-w-md">
          <h2 className="text-balance text-3xl font-semibold leading-tight tracking-tight text-white">Your balance, due dates and payments, always up to date.</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-sidebar-foreground/75">
            Sign in to see exactly what you owe, when it is due, and every payment you have made.
          </p>
          <ul className="mt-8 space-y-4 text-sm">
            {[
              { icon: Wallet, text: "Clear amounts due, with every charge itemized" },
              { icon: Smartphone, text: "Install it on your phone like any other app" },
              { icon: ShieldCheck, text: "Private to you. Protected sign-in with lockout" },
            ].map((f) => (
              <li key={f.text} className="flex items-center gap-3">
                <span className="grid size-8 place-items-center rounded-lg bg-white/10 text-white">
                  <f.icon className="size-4" />
                </span>
                {f.text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-sidebar-muted">© 2026 Rey Flores Pedrabuena. All rights reserved.</p>
      </aside>

      {/* Form */}
      <main className="relative flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between lg:justify-end">
          <Brand className="lg:hidden" />
          <ThemeToggle />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in to {company}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Track your balance, due dates and payments.</p>

          {expired ? (
            <Alert variant="warning" className="mt-6">
              Your session ended. Please sign in again.
            </Alert>
          ) : null}

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
            <Field label="Email" htmlFor="email" error={formState.errors.email?.message}>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@email.com"
                  className="h-10 pl-9"
                  aria-invalid={!!formState.errors.email}
                  {...register("email")}
                />
              </div>
            </Field>
            <Field label="Password" htmlFor="password" error={formState.errors.password?.message}>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="h-10 pl-9 pr-10"
                  aria-invalid={!!formState.errors.password}
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>
            {error ? <Alert variant="danger">{error}</Alert> : null}
            <Button type="submit" size="lg" className="w-full" loading={formState.isSubmitting}>
              {formState.isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <div className="mt-5 text-center">
            <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={() => setForgot(true)}>
              Forgot your password?
            </button>
          </div>
        </div>
      </main>

      <ForgotPasswordDialog open={forgot} onOpenChange={setForgot} />
      <InstallPrompt />
    </div>
  );
}

const forgotSchema = z.object({ email: z.string().trim().min(1, "Enter the email on your account.").email("That doesn't look like an email address.") });

function ForgotPasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [result, setResult] = React.useState<{ ok: boolean; text: string } | null>(null);
  const form = useForm<z.infer<typeof forgotSchema>>({ resolver: zodResolver(forgotSchema), defaultValues: { email: "" } });

  React.useEffect(() => {
    if (!open) {
      form.reset();
      setResult(null);
    }
  }, [open, form]);

  async function onSubmit(v: z.infer<typeof forgotSchema>) {
    setResult(null);
    try {
      const res = await rpc("resetPasswordToDefault", v.email);
      if (res && res.success) {
        setResult({ ok: true, text: `${res.msg || "If that email has an account, a new PIN is on its way."} Check your inbox, then sign in with it.` });
      } else {
        setResult({ ok: false, text: (res && res.msg) || "Something went wrong." });
      }
    } catch (e) {
      setResult({ ok: false, text: e instanceof Error ? e.message : "Something went wrong." });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>Reset your password</DialogTitle>
            <DialogDescription>We'll email a temporary 4-digit PIN to your registered address.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <Field label="Email" htmlFor="fg-email" error={form.formState.errors.email?.message}>
              <Input id="fg-email" type="email" placeholder="you@email.com" autoComplete="email" {...form.register("email")} />
            </Field>
            {result ? <Alert variant={result.ok ? "success" : "danger"}>{result.text}</Alert> : null}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              Send PIN
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
