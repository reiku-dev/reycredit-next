# Rey Credit

Loan record-keeping and borrower portal: instalment schedules, payments and
receipts, penalties and late fees, email notices, reports and profit tracking.

## Stack

| Layer | Tools |
| --- | --- |
| Framework | Next.js 14 (App Router), React 18, TypeScript (strict) |
| UI | Tailwind CSS, Radix UI primitives (shadcn/ui style components), lucide-react icons, Sonner toasts, Geist font, dark mode |
| Data fetching and forms | TanStack Query, React Hook Form + Zod |
| Charts | Recharts |
| Backend | Next.js route handlers (`/api/rpc`, `/api/cron`), Supabase (Postgres), Resend (email), @react-pdf/renderer (PDF), bcrypt + signed session cookie |
| Hosting | Vercel |

The browser and the server share one set of types: the client calls the server functions through a typed RPC
helper whose argument and result types come straight from `lib/functions.ts`.

## Project layout

```
app/            routes: / (sign in), /admin/*, /portal, /api/*
components/     ui/ (design-system components) and app/ (shell, primitives)
features/       admin/ and portal/ screens, auth/ sign-in
lib/            engine.ts (all loan maths), functions.ts (server functions), auth, email, PDFs, client/ helpers
tests/          assertion tests (npm test) and browser/ui.test.py
```

Commands: `npm run dev`, `npm run typecheck`, `npm test`, `npm run build`.

## Developer

**Rey Flores Pedrabuena** -- designed, built and maintained by the developer above.

## License

Copyright (c) 2026 Rey Flores Pedrabuena. **All rights reserved.**

The code is public so it can be viewed, not so it can be reused. You may not
use, copy, modify, host or distribute it without written permission.
See [LICENSE](./LICENSE).

## Setup (for the owner)

See [DEPLOY.md](./DEPLOY.md). Run the tests with `npm test`. The browser test
(`python3 tests/browser/ui.test.py`, needs `npm run build` first and Playwright with Chromium) drives the real
screens against the real server functions on an in-memory database.
