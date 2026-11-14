import { cn } from "@/lib/client/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("relative overflow-hidden rounded-md bg-muted", className)} {...props} />;
}

export { Skeleton };
