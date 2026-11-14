"use client";
import * as React from "react";
import { usePortalInfo } from "@/lib/client/queries";
import { cn } from "@/lib/client/utils";

/** Logo and company name, taken from the business profile in Settings (with sensible fallbacks). */
export function Brand({ subtitle, className, inverted }: { subtitle?: string; className?: string; inverted?: boolean }) {
  const { data } = usePortalInfo();
  const name = data?.companyName || "Rey Credit";
  const [broken, setBroken] = React.useState(false);
  const logo = !broken && data?.logo ? data.logo : "/logo.png";
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logo}
        alt=""
        onError={() => setBroken(true)}
        className="size-9 shrink-0 rounded-lg bg-white object-contain p-0.5 ring-1 ring-black/5"
      />
      <div className="min-w-0 leading-tight">
        <div className={cn("truncate text-[15px] font-semibold tracking-tight", inverted && "text-white")}>{name}</div>
        {subtitle ? <div className={cn("truncate text-xs", inverted ? "text-sidebar-muted" : "text-muted-foreground")}>{subtitle}</div> : null}
      </div>
    </div>
  );
}
