"use client";
import * as React from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function store(kind: "local" | "session") {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

type Mode = "none" | "prompt" | "ios" | "inapp";

/**
 * "Install app" card for borrowers. Browsers only let a page open the install dialog from a tap, so this
 * card is how the page asks. It stays until the app is installed; "Not now" hides it for this visit only.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = React.useState<Mode>("none");
  const [hidden, setHidden] = React.useState(false);

  React.useEffect(() => {
    if (store("session")?.getItem("rc-install-later") === "1") setHidden(true);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      store("local")?.removeItem("rc-installed");
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      store("local")?.setItem("rc-installed", "1");
      setDeferred(null);
      setMode("none");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  React.useEffect(() => {
    const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) {
      store("local")?.setItem("rc-installed", "1");
      setMode("none");
      return;
    }
    if (deferred) return setMode("prompt");
    if (store("local")?.getItem("rc-installed") === "1") return setMode("none");
    const ua = navigator.userAgent || "";
    if (/FBAN|FBAV|FB_IAB|Messenger|Instagram|Line\/|TikTok|Snapchat|MicroMessenger|Twitter/i.test(ua)) return setMode("inapp");
    const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setMode(ios ? "ios" : "none");
  }, [deferred]);

  if (hidden || mode === "none") return null;

  const text =
    mode === "prompt"
      ? "Open your account in one tap from your home screen, like any other app."
      : mode === "ios"
        ? "Tap the Share button, then “Add to Home Screen” to install it like an app."
        : "This page is open inside another app. Open it in Chrome or Safari to install.";

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => null);
    setDeferred(null);
  }

  return (
    <div
      role="dialog"
      aria-label="Install the app"
      data-testid="install-card"
      className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-md rounded-xl border bg-card p-4 shadow-pop sm:left-auto sm:right-4"
    >
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" width={44} height={44} className="size-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{mode === "inapp" ? "Open in your browser to install" : "Install Rey Credit"}</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{text}</p>
        </div>
        <button
          aria-label="Dismiss"
          className="-mr-1 -mt-1 rounded-md p-1 text-muted-foreground hover:bg-accent"
          onClick={() => {
            store("session")?.setItem("rc-install-later", "1");
            setHidden(true);
          }}
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {mode === "ios" ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              store("local")?.setItem("rc-installed", "1");
              setMode("none");
            }}
          >
            <Share /> Already installed
          </Button>
        ) : null}
        {mode === "prompt" ? (
          <Button size="sm" onClick={install}>
            <Download /> Install
          </Button>
        ) : null}
      </div>
    </div>
  );
}
