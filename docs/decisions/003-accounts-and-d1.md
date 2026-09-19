# 003 — Accounts, Cloudflare D1 and Gemini provider

**Status:** accepted. Supersedes the "no accounts / browser storage" part of ADR 002.

**Decision.**
- **Accounts:** email + password. Passwords are hashed with PBKDF2-SHA256 (Web Crypto, 100k iterations, per-user salt).
  A login creates a session; the raw token is only sent as an `HttpOnly; SameSite=Lax` cookie and the database stores its SHA-256.
- **Storage:** Cloudflare D1 (SQLite) behind the Worker. Tables: `users`, `sessions`, `user_data` (`migrations/0001_users.sql`).
  `user_data` holds one JSON document per user (events, activities, goals, preferences, plans, chat), validated by `userDataSchema`.
  This is an interim step towards the normalised tables in CLAUDE.md §11; it keeps the client `AppState` unchanged.
- **Ownership:** every protected route derives the user from the session cookie (`requireUser`); client-supplied ids are never used.
  `/api/plans/generate` and `/api/assistant/message` also require a session (they cost CPU / AI quota).
- **Backend/D1 coupling:** backend code depends on the small `Db` interface in `backend/core/env.ts`, not on Cloudflare types.
- **AI provider:** `backend/ai/providers/gemini.ts` implements `AIProvider` with Gemini function calling over the existing tool
  layer (`TOOL_SPECS`). Prompts live in `backend/ai/prompts/`. Without `GEMINI_API_KEY`, or if Gemini fails, the rule-based provider answers.
- **Pages:** `functions/api/[[path]].ts` replaces the three per-route wrappers and delegates to the same router as the Worker.

**Consequences.** Data follows the user across devices. Existing browser data (`timex.v1`) is imported once into a new account.
Last-write-wins: two devices editing at once can overwrite each other. No email verification, password reset or login rate limiting yet.

**Next step.** Split `user_data` into the normalised tables and add the resource endpoints of `docs/api.md`.
