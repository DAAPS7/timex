# 002 — Prototype persistence and Cloudflare Pages hosting

**Status:** temporary, deviates from the target architecture (PostgreSQL behind the API).

**Decision.** Frontend = static Vite build; backend = Cloudflare Pages Functions (`functions/api`) reusing the
`backend/` modules. There is no database yet: user data is kept in the browser (`localStorage`, behind
`src/services/api/storage.ts`) and sent to stateless endpoints when the engine or assistant is needed.

**Why.** It allows deploying and testing the planning experience on Pages with zero infrastructure or secrets.

**Consequences.** No accounts, no cross-device data, no server-side ownership checks. Engine and AI logic stay on
the backend, so web and mobile clients can share them.

**Next step.** Add a database (Postgres via Hyperdrive, or D1), auth, and the resource endpoints of `docs/api.md`;
replace `storage.ts` with API calls. The `AppState` shape maps directly to the tables in CLAUDE.md §11.
