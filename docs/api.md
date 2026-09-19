# API (prototype)

Served by Cloudflare Pages Functions under `/api`. All bodies are JSON and validated with zod
(`shared/domain.ts`). Errors: `{ "error": { "code", "message", "details?" } }` with codes from `backend/core/errors.ts`.

The prototype API is **stateless**: the client sends its data, the backend computes (see ADR 002).
No endpoint reads or writes user data server-side, so no authentication exists yet.

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/health` | – | `{ ok: true }` |
| POST | `/api/plans/generate` | `PlanningInput` (`today`, `weekStart`, `events`, `activities`, `goals`, `preferences`) | `PlanningResult` |
| POST | `/api/assistant/message` | `{ message, state: PlanningInput, currentItems? }` | `{ reply, proposals[], plan?, planAdoptable? }` |

`PlanningResult`: `status` (`fully_feasible` \| `partially_feasible` \| `infeasible`), minute totals,
`scheduledItems[]` (each with structured `reasons` codes), `conflicts[]`, `warnings[]`, `availableMinutesByDay`.

Planned resource endpoints from CLAUDE.md §15 (`/api/activities`, `/api/goals`, `/api/calendar/events`,
`/api/plans/current`, `/api/plans/:id/modify`) arrive together with the database.
