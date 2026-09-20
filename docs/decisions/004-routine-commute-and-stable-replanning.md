# 004 — Routine, commute and stable replanning

**Status:** accepted.

**Decision.**
- **Routine as data.** Fixed commitments are recurring calendar events (`weekly: true`); sleep is the complement of the waking window
  (`dayStart` = wake-up, `dayEnd` = bedtime, and a bedtime at or before wake-up means "after midnight", see `shared/routine.ts`);
  transport is `preferences.commute = { modes[], minutesPerDay }` (one or more modes; data saved with the former single `mode` is upgraded on read). All are optional, so stored data stays valid.
- **Commute is reserved by the engine.** On days with at least one recurring commitment, half of `minutesPerDay` is blocked right before the
  first and half right after the last (clamped to waking hours). The blocks are returned as `commuteBlocks` so the UI can draw them.
- **Stable replanning.** `PlanningInput.previousItems` is the plan being revised. Sessions of past days, and future sessions that still fit,
  are kept untouched; the rest is re-placed by the normal scoring. `PlanningResult.changes` reports `kept`, `moved`, `dropped`, `added`.
  This is how one-off events (meetings, exams, emergencies) are absorbed without reshuffling the whole week.
- **Every week is planned.** A week without a plan gets a *proposed* plan automatically (`useAutoPlan`); changing events or settings revises
  the existing plans as proposals. Nothing is accepted without the user (product principle 2.2).
- **Assistant.** New tools `get_routine` (sleep, commute, grounded transport ideas from `shared/transport.ts`) and `create_event`
  (proposal only). When a plan is on screen, `generate_plan` replans from it, so the assistant can say what moved and why.
- **Guided setup** (wizard: fixed schedule, sleep, transport, activities) is shown until `preferences.setupDone`. It was requested explicitly,
  so it is in scope despite CLAUDE.md §13 listing elaborate onboarding.

**Consequences.** Commute only applies to recurring commitments (not to one-off events). Hours per activity are entered per week and converted to
sessions by `shared/sessions.ts`. Sessions cannot cross midnight.
