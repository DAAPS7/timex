# API (prototype)

Served by the Cloudflare Worker (or the Pages catch-all) under `/api`. All bodies are JSON and validated with zod
(`shared/domain.ts`). Errors: `{ "error": { "code", "message", "details?" } }` with codes from `backend/core/errors.ts`.

Authentication is a session cookie (`timex_session`, HttpOnly) set by register/login (ADR 003). Routes marked 🔒 return
`UNAUTHORIZED` (401) without a valid session. The user is always derived from the cookie.

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/health` | – | `{ ok: true }` |
| POST | `/api/auth/register` | `{ email, password }` (password ≥ 8) | `201 { user }` + cookie; `CONFLICT` if the email exists |
| POST | `/api/auth/login` | `{ email, password }` | `{ user }` + cookie |
| POST | `/api/auth/logout` | – | `{ ok }`, clears the cookie |
| GET | `/api/auth/me` 🔒 | – | `{ user }` |
| GET | `/api/state` 🔒 | – | `{ data: UserData | null }` (null = new user) |
| PUT | `/api/state` 🔒 | `UserData` (events, activities, goals, preferences, plans, chat) | `{ ok }` |
| POST | `/api/plans/generate` 🔒 | `PlanningInput` (`today`, `weekStart`, `events`, `activities`, `goals`, `preferences`) | `PlanningResult` |
| POST | `/api/assistant/message` 🔒 | `{ message, state: PlanningInput, currentItems? }` | `{ reply, proposals[], plan?, planAdoptable? }` |

`PlanningResult`: `status` (`fully_feasible` \| `partially_feasible` \| `infeasible`), minute totals,
`scheduledItems[]` (each with structured `reasons` codes), `conflicts[]`, `warnings[]`, `availableMinutesByDay` (free before planning) and `freeMinutesByDay` (still free after the sessions).
The input may carry `nowMinutes`: the time already gone today is not available. The assistant reply may carry `plan` + `planWeekStart`: a weekly plan that is only a proposal until the user approves it.

Planned resource endpoints from CLAUDE.md §15 (`/api/activities`, `/api/goals`, `/api/calendar/events`,
`/api/plans/current`, `/api/plans/:id/modify`) arrive together with the database.

The assistant uses Gemini when `GEMINI_API_KEY` is set (see ADR 003) and the rule-based interpreter otherwise.
