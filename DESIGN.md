# DESIGN.md — EcomfyApp Mini Lead Routing Engine (Frontend)

> Drop-in design system + redesign brief for an AI coding agent (Claude Code / Claude Design).
> Goal: modernize the **Next.js dashboard** (`frontend/`) into a polished, data-dense,
> "operations console" UI using **Tailwind CSS v4 + shadcn/ui**, **WITHOUT changing the
> backend contract or the data flow**. Aesthetic baseline: Linear-grade dark, technical,
> quietly premium. Format modeled on the `awesome-design-md` convention.

---

## 0. Integration Contract — DO NOT BREAK (read first)

This redesign is **presentation-only**. The FastAPI backend, its data shapes, and the
server-side data flow are already built, tested (26 tests + concurrency proof) and deployed.
**Touch the look, never the wiring.**

**Hard invariants — keep exactly as-is:**

1. **Data access stays server-side.** Keep `frontend/lib/api.ts` (`apiGet`/`apiPost` reading
   `process.env.API_BASE_URL` at **runtime**). Do **NOT** introduce `NEXT_PUBLIC_*` for the API
   base, do **NOT** fetch the API from the browser/client components (this is what keeps it
   CORS-free and deploy-portable).
2. **Mutations stay Server Actions.** Keep `frontend/app/actions.ts`: `submitLead`,
   `returnLead`, `resetDemo`, `seedLeads` — same names, same `FormData` field names, same
   endpoints, same `revalidatePath("/")`. You may restyle the forms; do not change what they post.
3. **The page stays a Server Component** (`app/page.tsx`, `export const dynamic = "force-dynamic"`).
   Fetch on the server, render with the modern components. The `?ai=1` search param gating the
   AI summary must keep working.
4. **API endpoints & response field names are frozen.** Render the data below verbatim — do not
   rename, remap, or invent fields:

   | Endpoint | Key fields the UI consumes |
   |---|---|
   | `GET /reports/daily-summary[?ai=true]` | `total_leads_received, rejected_leads, sold_leads, unsold_leads, returned_leads, pending_leads, gross_revenue, refunds, net_revenue, top_buyer_by_spend{buyer_id,spend}, buyers_low_balance[], buyers_cap_reached[], top_rejection_reasons[{reason,count}], average_routing_latency_ms, ai_summary{summary,problems[],recommended_actions[],generated_by}` |
   | `GET /buyers` | `buyer_id, buyer_name, status, balance, daily_cap, leads_received_today, allowed_states[], allowed_verticals[], schedule_start, schedule_end, campaign_active, ping_tree_assigned, priority, price_per_lead, webhook_behavior` |
   | `GET /leads?limit=` | `lead_id, first_name, last_name, phone, email, state, vertical, source, status, rejection_reason, assigned_buyer_id, sold_price, return_reason, created_at` |
   | `POST /leads` (returns trace) | `lead_id, status, assigned_buyer_id, sold_price, rejection_reason, evaluations[{buyer_id,eligible,reason_if_not_eligible,priority}], attempts[{buyer_id,attempt_order,status,accepted,rejection_reason,latency_ms}]` |
   | `POST /leads/{id}/return` | `status, assigned_buyer_id, refund_amount, balance_after, return_reason, buyer_total_returns` |
   | `GET /alerts` | `id, severity, alert_type, entity_id, message, suggested_action, created_at` |

5. **Domain enums are fixed.** Lead `status ∈ {rejected, pending_distribution, sold, unsold, returned}`.
   Alert `severity ∈ {info, warning, critical}`. Buyer `webhook_behavior ∈ {accept, reject_duplicate, timeout, error}`.
6. **Routing, ledger, money, and all backend logic are out of scope.** Money is server-computed;
   the UI only formats it. Never compute or mutate balances client-side.
7. **Docker stays green.** Keep `output: "standalone"` in `next.config.mjs` and the `frontend/Dockerfile`
   multi-stage build. After the redesign, `docker compose up --build` and `bash scripts/smoke.sh` must
   still pass unchanged.

**Definition of done:** the dashboard looks like a modern SaaS ops console, **and** `npm run build`
succeeds, the existing smoke/concurrency runs are unaffected, and no new client→API network call appears.

---

## 1. Visual Theme & Atmosphere

A **dark-first operations console** for an insurance lead-routing platform: dense, technical,
trustworthy, "quietly luxurious" in the Linear sense. The dark canvas IS the whitespace; depth
comes from a **surface ladder + hairline borders**, not drop shadows. Real-time-feeling data
(ledger, attempts, alerts) is the protagonist — chrome recedes, numbers lead. Convey precision
and auditability: every routing decision is traceable, and the UI should *feel* like an
auditable control room, not a marketing page.

## 2. Color Palette & Roles

Dark-first, semantic tokens in **OKLCH**, wired through shadcn/ui's `@theme inline` so every
component reads from variables. Single brand accent (indigo); status colors are reserved for
**meaning**, never decoration.

```css
/* app/globals.css — replace the hand-rolled palette with shadcn tokens */
.dark {
  --background:        oklch(0.16 0.006 285);   /* near-black canvas        */
  --card:              oklch(0.205 0.006 285);   /* surface-1               */
  --popover:           oklch(0.205 0.006 285);
  --muted:             oklch(0.269 0.006 285);   /* surface-2 / subtle bg    */
  --border:            oklch(1 0 0 / 8%);         /* hairline                */
  --input:             oklch(1 0 0 / 12%);
  --foreground:        oklch(0.985 0 0);          /* ink                     */
  --muted-foreground:  oklch(0.708 0 0);          /* ink-subtle              */
  --primary:           oklch(0.62 0.19 264);      /* indigo brand accent     */
  --primary-foreground:oklch(0.985 0 0);
  --ring:              oklch(0.62 0.19 264);
  /* domain status palette (use ONLY for status meaning) */
  --status-sold:       oklch(0.72 0.17 152);      /* green   */
  --status-rejected:   oklch(0.64 0.21 25);       /* red     */
  --status-unsold:     oklch(0.80 0.16 85);       /* amber   */
  --status-returned:   oklch(0.70 0.16 255);      /* blue    */
  --status-pending:    oklch(0.70 0.02 285);      /* slate   */
  --sev-critical:      oklch(0.64 0.21 25);
  --sev-warning:       oklch(0.80 0.16 85);
  --sev-info:          oklch(0.72 0.12 240);
  /* chart ramp (Recharts) */
  --chart-1: oklch(0.62 0.19 264); --chart-2: oklch(0.70 0.15 180);
  --chart-3: oklch(0.80 0.16 85);  --chart-4: oklch(0.64 0.21 25);
  --chart-5: oklch(0.72 0.17 152);
}
```

**Roles:** indigo `--primary` → primary CTA, focus ring, active nav, links. Status colors →
badges, ledger deltas (debit/refund), alert severity dots. Green for `sold`/credit, red for
`rejected`/`critical`/debit, amber for `unsold`/`warning`, blue for `returned`, slate for `pending`.

## 3. Typography Rules

- **Font:** `Geist` (or Inter) via `next/font` for UI; `Geist Mono` / `JetBrains Mono` for IDs,
  money, latency, and any tabular number. Always set `font-variant-numeric: tabular-nums` on
  metrics and table figures so columns align.
- **Scale (Tailwind):** page title `text-2xl font-semibold tracking-tight`; section `text-lg
  font-medium`; card label `text-xs uppercase tracking-wide text-muted-foreground`; KPI value
  `text-3xl font-semibold tabular-nums`; body `text-sm`; mono IDs `text-xs font-mono text-muted-foreground`.
- Negative tracking on large display; never center long data labels.

## 4. Component Stylings (shadcn/ui mapping)

Adopt these shadcn primitives; map our existing UI 1:1 so no data is lost:

| Current element | shadcn/ui component | Notes |
|---|---|---|
| Metric cards (total/sold/net…) | `Card` + KPI layout | label (muted, xs, uppercase) over `text-3xl tabular-nums` value; optional sparkline |
| Buyers table, Leads table | `Table` (or TanStack `DataTable`) | sortable headers, sticky header, zebra via `even:bg-muted/40`, row hover |
| Lead `status`, buyer `webhook_behavior` | `Badge` (variants) | one variant per status using the status tokens above |
| Submit-lead form | `Card` + `Input`/`Select`/`Label` + `Button` | **keep `name=` attributes & the `action={submitLead}`** |
| Return action | `Dialog` or inline `Input`+`Button` | posts to `returnLead` with `lead_id` + `reason` (unchanged) |
| Reset / Seed buttons | `Button` (`variant="outline"` / `destructive`) | wrap the existing Server Actions |
| Alerts list | `Table` or stacked `Alert` | severity dot/badge + message + `suggested_action` |
| AI summary | `Card` (accent ring) + `Tabs` (Summary / Problems / Actions) | render `ai_summary.*`; show `generated_by` as a muted footnote |
| Navigation | `Sidebar` (collapsible) + topbar | sections: Overview, Leads, Buyers, Ledger, Alerts; topbar holds Reset/Seed + a density toggle |
| Toasts on actions | `Sonner` | "Lead sold to buyer_a", "Refund issued", etc. (derived from action results) |
| Charts (optional) | `Chart` (Recharts): status donut, revenue area, latency bar | feed from report fields only |

- **Cards:** `--card` bg, `rounded-xl`, `1px` hairline border, `p-4`/`p-6`. No heavy shadow.
- **Buttons:** primary = indigo fill, white text, `h-9 px-4 rounded-md`; secondary = `outline`;
  destructive (Reset) = `destructive`. Focus ring 2px `--ring`.
- **Badges:** pill, `text-xs font-medium`, tinted bg (`/15` alpha) + solid foreground per status.

## 5. Layout Principles

- **App shell:** collapsible left `Sidebar` (icon+label) + sticky topbar + scrollable content.
  Content max-width ~`1400px`, generous but data-first.
- **Grid:** KPI row = `grid auto-fit minmax(160px,1fr)`; main content = 12-col responsive grid,
  tables full-width, form + buyers side-by-side on `lg`.
- **Spacing:** 4px base scale (Tailwind `gap-2/4/6`). Sections separate by surface lift, not big gaps.
- **Density toggle** (comfortable/compact) adjusts table row padding — valued in ops tooling.

## 6. Depth & Elevation

Four levels, **no drop shadows** (a subtle `shadow-sm` is the max on popovers/dialogs only):
flat (canvas) → `--card` surface-1 → `--muted` surface-2 (hover/selected) → 2px focus ring.
Borders are `oklch(1 0 0 / 8%)` hairlines. Elevation = lighter surface, never a glow.

## 7. Motion & Interaction

Fast, functional, never bouncy: `transition-colors`/`opacity` at `150ms ease-out`. Skeletons
(`Skeleton`) for server-fetched panels via `loading.tsx`/`Suspense`. Optimistic UI is optional;
if used, reconcile with the Server Action result. Respect `prefers-reduced-motion`.

## 8. Do's and Don'ts

**Do:** keep the dark canvas as anchor; use indigo only for brand/CTA/focus/active; reserve
status colors for meaning; use `tabular-nums` + mono for all figures/IDs; make the routing trace
(evaluations + attempts) legible and scannable (it's the product's "wow"); keep every byte of
data the API returns visible somewhere.

**Don't:** ship a light-only theme; use status colors decoratively; introduce a second brand
accent or gradients; add client-side fetching to the API; rename/remap API fields; compute money
in the browser; replace Server Actions with client handlers; pill-round standard buttons.

## 9. Responsive Behavior

Breakpoints 1440 → 1024 → 768 → 480. Sidebar collapses to icons at `lg`, to a `Sheet` drawer at
`md`. KPI grid 5-up → 3-up → 2-up → 1-up. Tables scroll horizontally on small screens with the
first column (lead/buyer id) pinned. Touch targets ≥44px.

---

## 10. Adoption Plan (additive, reversible, verified)

Do it in this order; each step is presentation-only:

1. `cd frontend && npx shadcn@latest init` (dark, base color **neutral**, CSS variables = true,
   RSC = true). This adds Tailwind v4 + `globals.css` tokens; **merge** our palette from §2.
2. `npx shadcn@latest add card table badge button input select label sidebar tabs dialog sonner skeleton chart`.
3. Replace markup in `app/page.tsx` and `app/layout.tsx` with the components in §4 — **keep the
   same `await apiGet(...)` calls and the same Server Actions**. Move sub-UI into
   `app/_components/*` (client components only for interactivity, never for data fetching).
4. Delete the hand-rolled rules in `globals.css` only after parity is reached.
5. **Verify (gate):** `npm run build` passes; `docker compose up --build` then
   `bash scripts/smoke.sh` and `python scripts/concurrency_test.py` are unaffected; no
   `NEXT_PUBLIC_API*` exists; grep shows no client-side `fetch("http.../leads")`.

## 11. Agent Prompt Guide (paste this into Claude)

> You are modernizing the frontend of the EcomfyApp Mini Lead Routing Engine. Read `DESIGN.md`
> in full and treat **§0 Integration Contract as inviolable** — this is a presentation-only
> redesign. Migrate `frontend/` to **Tailwind v4 + shadcn/ui** following §1–§9, using the OKLCH
> tokens in §2 and the component mapping in §4. **Do not change** `lib/api.ts`, `app/actions.ts`,
> the API endpoints/field names, the Server-Component data flow, or any backend code. Keep all
> data the API returns visible. Build a sidebar app-shell, KPI cards, sortable Buyers/Leads
> tables with status `Badge`s, an AI-summary card with tabs, and an alerts panel. Work in small
> commits (one component group per commit, conventional style). After each milestone run
> `npm run build`; at the end confirm `bash scripts/smoke.sh` still passes and no client→API
> fetch was introduced. If a design choice would require changing the data contract, STOP and
> ask instead of breaking it.

**Acceptance checklist:** ☐ dark shadcn theme with our tokens ☐ sidebar shell ☐ KPI cards
(`tabular-nums`) ☐ Buyers + Leads tables with status badges ☐ routing trace (evaluations+attempts)
readable ☐ AI summary card ☐ alerts panel ☐ `npm run build` green ☐ smoke + concurrency unaffected
☐ zero client-side API calls ☐ no renamed API fields.

---

### Sources & basis
- Format & company exemplars: VoltAgent **awesome-design-md** (`design-md/linear.app`, `design-md/vercel`) and **getdesign.md**.
- Component/theming accuracy: **shadcn/ui** docs via Context7 (OKLCH CSS variables, Tailwind v4 `@theme inline`, dark mode, chart/sidebar tokens, Table).
- Dashboard patterns: shadcn/ui dashboard guidance (data-dense tables, KPI cards, density controls, dark-mode-as-default).
