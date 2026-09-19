# 001 — Deterministic planning engine

**Status:** implemented. The engine (`backend/domains/planning`) is a pure function `PlanningInput -> PlanningResult`:
no I/O, clock, randomness, HTTP or AI imports; `today` is an input. Scoring weights live in `scoringConfig.ts`.
The engine returns structured reason codes only; prose is produced in the AI layer / UI (`shared/reasons.ts`).

Prototype decisions worth reviewing:
- Times are local wall-clock (`YYYY-MM-DD`, `HH:mm`); the timezone is a preference only. DST is not handled yet.
- Waking hours (`dayStart`–`dayEnd`) define sleep; everything else is availability minus fixed events.
- `maxDailyPlannedMinutes` is treated as a **hard** cap (docs list it as a preference) to avoid overloaded days.
- Activities are ordered by deadline, then priority, then demand; each session takes the best-scoring slot (greedy).
