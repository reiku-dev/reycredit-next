/**
 * Typed client for the single /api/rpc endpoint. The argument and result types come straight from the
 * server functions (lib/functions.ts) with `import type`, so the browser bundle never contains any
 * server code, yet the two sides cannot drift apart without the compiler noticing.
 */
import type * as ServerFunctions from "@/lib/functions";

type Fns = typeof ServerFunctions;
export type RpcName = {
  [K in keyof Fns]: Fns[K] extends (...args: never[]) => unknown ? K : never;
}[keyof Fns];
export type RpcArgs<K extends RpcName> = Parameters<Fns[K] extends (...a: infer A) => unknown ? (...a: A) => unknown : never>;
export type RpcResult<K extends RpcName> = Awaited<ReturnType<Fns[K] extends (...a: never[]) => unknown ? Fns[K] : never>>;

/** Results of read calls: failure shapes ({ success: false, msg }) are thrown, so callers only see the data. */
export type RpcData<K extends RpcName> = Exclude<RpcResult<K>, { success: boolean; msg: unknown }>;

export class RpcError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "RpcError";
  }
}

let onUnauthorized: (() => void) | null = null;
/** Registered by the app shell so an expired session sends the user back to sign-in. */
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

export async function rpc<K extends RpcName>(fn: K, ...args: RpcArgs<K>): Promise<RpcResult<K>> {
  let res: Response;
  try {
    res = await fetch("/api/rpc", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fn, args }),
    });
  } catch {
    throw new RpcError("Can't reach the server. Check your connection and try again.");
  }
  let body: { result?: unknown; error?: string } = {};
  try {
    body = await res.json();
  } catch {
    /* non-JSON error page */
  }
  if (!res.ok) {
    if (res.status === 401 && fn !== "validateLogin" && onUnauthorized) onUnauthorized();
    throw new RpcError(body.error || `Request failed (${res.status}).`, res.status);
  }
  return body.result as RpcResult<K>;
}

/** Like rpc(), but turns `{ success: false, msg }` into a thrown error and returns only the success shape. */
export async function rpcRead<K extends RpcName>(fn: K, ...args: RpcArgs<K>): Promise<RpcData<K>> {
  const r = (await rpc(fn, ...args)) as unknown as { success?: boolean; msg?: string; error?: string };
  if (r && typeof r === "object" && !Array.isArray(r)) {
    if (r.success === false) throw new RpcError(r.msg || "Something went wrong.");
    if (typeof r.error === "string" && r.success === undefined) throw new RpcError(r.error);
  }
  return r as unknown as RpcData<K>;
}
