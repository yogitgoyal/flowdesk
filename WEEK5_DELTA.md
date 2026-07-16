# Week 5 — What Carried Over From Week 4, What's New

This repo started as a direct fork of the Week 4 "Overlap/FlowDesk" real-time
collaboration project. Use this file as the source for the "Features,
Challenges, Analysis" section of your report, and to answer viva questions
about what you built when.

## Carried over from Week 4 (already working, lightly modified)

| Piece | Week 4 → Week 5 change |
|---|---|
| JWT + refresh token auth (`lib/auth.ts`, `app/api/auth/*`) | None — reused as-is |
| Workspace / Membership multi-tenant model (`prisma/schema.prisma`) | None — `Workspace` already *is* the tenant boundary |
| RBAC (`lib/roles.ts`) | **Collapsed** from 3 roles (`OWNER/EDITOR/VIEWER`) to the 2 roles the Week 5 brief asks for (`ADMIN/MEMBER`). `isAdmin()` gates workspace/member management; `canWrite()` now applies to both roles since there's no read-only tier anymore |
| Socket.io real-time (`lib/socket.ts`, presence, task events) | None — reused as-is |
| Activity log (`Activity` model + feed) | None — this already satisfies Week 5's "audit logs" requirement |
| Notifications (model, bell component, `user:{id}` socket room) | None |
| Dark mode toggle | None — already satisfies that bonus item |
| Kanban board CRUD (Task/Column/Project) | None — this is the CRUD entity for Week 5 too |
| Version history (`TaskVersion`) | None — carries over as extra depth beyond the Week 5 ask |

## Genuinely new for Week 5 (scaffolded as TODOs, not pre-written — build these yourself)

| File | What it needs | Why it's a stub, not finished |
|---|---|---|
| `app/api/dashboard/analytics/route.ts` | KPI aggregation (counts by status/priority, avg time-to-decision, 7-day trend) | Week 4 had zero analytics — this is the actual new backend logic worth understanding for your viva |
| `app/api/tasks/route.ts` (`GET`) | Paginated/searchable/filterable/sortable task list, separate from the full board fetch | Query-param parsing is scaffolded; the Prisma `where`/`orderBy`/`skip`/`take` query is left for you |
| `lib/cloudinary.ts` + `app/api/uploads/route.ts` | Signed direct-to-cloud upload flow | Needs your own Cloudinary account + the actual HMAC signing (~10 lines, good to understand) |
| `lib/rate-limit.ts` | Apply `checkRateLimit()` to the auth routes | The limiter itself is written; wiring it into `login`/`register`/`refresh` is left as the integration step |
| `jobs/dailyDigest.ts` | Cron-triggered admin summary email | Needs `node-cron` scheduling in `server.ts` + a Resend API key |
| `app/error.tsx` | — | Fully implemented (standard Next.js convention, not project-specific logic) |

## Security note

The original Week 4 `.env` (with live DB credentials + JWT secrets) was
**removed from this fork** — see `.env.example`. Generate new JWT secrets and
either reuse or rotate the Railway DB, your call, but don't commit real
secrets to this repo either.

## What's still genuinely missing (not stubbed, needs a decision from you)

- Responsive/mobile pass — the Week 4 UI was mainly demoed on desktop; budget
  time to check the board/drawer/members pages at mobile width
- Deciding what "done" means for a task (needed for the analytics
  avg-time-to-decision metric) — either pick a Column name convention or add
  a `completedAt` field via a migration
