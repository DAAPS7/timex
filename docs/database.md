# Planning Engine Specification

## 1. Purpose

The planning engine is responsible for converting the user's:

- fixed commitments
- activities
- goals
- preferences
- availability
- constraints

into a feasible schedule.

The planning engine is deterministic and independent from the AI system.

---

# 2. Core Principle

The LLM should not directly generate authoritative schedules.

The LLM interprets the user's request.

The planning engine determines what is actually feasible.

```text
Natural language
       ↓
AI interpretation
       ↓
Structured planning request
       ↓
Planning Engine
       ↓
Feasible schedule
       ↓
AI explanation
```

---

# 3. Inputs

A planning request should contain the relevant planning context.

Conceptually:

```text
PlanningInput

user
timezone

planning_period

calendar_events[]

activities[]

goals[]

preferences[]
```

The planning engine should receive only the data necessary for the requested planning operation.

---

# 4. Calendar Events

Calendar events represent fixed commitments.

Examples:

```text
University
09:00–13:00

Work
14:00–18:00

Doctor appointment
10:30–11:30
```

Calendar events are normally hard constraints.

Recurring events should be expanded into concrete occurrences for the planning period before scheduling.

---

# 5. Activities

Activities are flexible scheduling targets.

Example:

```text
Activity:
Gym

Target:
4 sessions/week

Preferred duration:
75 minutes

Preferred time:
17:00–21:00

Priority:
Medium
```

Activities may be:

- one-time
- recurring
- deadline-based
- goal-associated

---

# 6. Activity Constraints

Activities can contain:

### Required duration

Minimum amount of time required for a useful session.

### Target duration

Total time the user wants to dedicate within the planning period.

### Session duration

Preferred duration for each scheduled instance.

### Frequency

Number of sessions desired.

### Deadline

Latest time by which the activity should be completed.

### Preferred days

Days on which the user prefers the activity.

### Preferred times

Time ranges the user prefers.

### Avoided times

Time ranges the user does not prefer.

### Flexibility

How easily the activity can be moved.

Possible values:

```text
low
medium
high
```

---

# 7. Goals

Goals influence activity priority.

Example:

```text
Goal:
Algorithms Exam

Deadline:
2026-10-15

Priority:
High
```

If an activity is associated with a high-priority goal with an approaching deadline, its candidate slots should receive a higher score.

The planning engine should not invent goal importance.

Importance comes from explicit user data or clearly defined system defaults.

---

# 8. User Preferences

Preferences influence scheduling without normally becoming hard constraints.

Examples:

```text
Preferred working hours:
09:00–21:00

Preferred study time:
14:00–18:00

Avoid:
After 22:00

Minimum break:
15 minutes

Maximum planned work:
8 hours/day
```

---

# 9. Hard Constraints

Hard constraints cannot be violated.

Initial hard constraints include:

1. No overlapping scheduled events.
2. No activity scheduled inside a fixed calendar event.
3. No activity scheduled outside the planning period.
4. Activity must satisfy minimum session duration.
5. Activity must respect explicit unavailable periods.
6. Activity cannot be scheduled after its hard deadline.
7. Required sleep/unavailability must be respected.
8. User-owned schedules must remain internally consistent.

If a hard constraint makes an activity impossible to schedule, the engine must report the conflict.

---

# 10. Soft Constraints

Soft constraints influence candidate ranking.

Examples:

- preferred time
- preferred day
- preferred session duration
- avoiding evenings
- keeping weekends free
- minimizing context switching
- spreading sessions throughout the week
- avoiding excessive workload on one day

Soft constraints can be violated if necessary.

---

# 11. Availability Calculation

Availability should be derived.

Conceptually:

```text
Planning Period
       ↓
User unavailable periods
       +
Fixed calendar events
       +
Sleep
       +
Other hard constraints
       ↓
Available intervals
```

Example:

```text
09:00–13:00 University
13:00–14:00 Lunch
14:00–16:00 AVAILABLE
16:00–17:30 Gym
17:30–20:00 AVAILABLE
```

The engine should merge overlapping unavailable periods before calculating availability.

---

# 12. Candidate Slot Generation

For each activity:

1. Determine its session duration.
2. Identify available intervals.
3. Split intervals into possible candidate slots.
4. Remove candidates violating hard constraints.
5. Calculate a score for each remaining candidate.

Candidate generation should be deterministic.

---

# 13. Candidate Scoring

The first prototype should use a transparent scoring system.

Conceptually:

```text
score =
    priority_score
  + deadline_score
  + preferred_time_score
  + preferred_day_score
  + duration_fit_score
  + distribution_score
  - context_switch_penalty
  - workload_penalty
  - inconvenience_penalty
```

The exact weights should be configurable rather than scattered throughout the code.

For example:

```text
planning/scoring/config
```

The initial weights should be simple and documented.

---

# 14. Priority

Priority should influence scheduling.

A basic priority scale can be:

```text
low
medium
high
critical
```

Priority should not completely override hard constraints.

A high-priority activity cannot be scheduled during a fixed event simply because it has a high priority.

---

# 15. Deadline Urgency

Deadline urgency should increase as the deadline approaches.

Conceptually:

```text
more time remaining → lower urgency
less time remaining  → higher urgency
deadline passed      → infeasible/error
```

The exact urgency curve should initially remain simple.

It can later become more sophisticated.

---

# 16. Distribution

Recurring activities should preferably be distributed across the planning period.

For example:

```text
Bad:

Monday    Gym
Tuesday   Gym
Wednesday Gym
Thursday  Gym


Better:

Monday    Gym
Wednesday Gym
Friday    Gym
Sunday    Gym
```

The engine should avoid unnecessarily clustering repeated sessions when reasonable alternatives exist.

---

# 17. Context Switching

The engine should consider the cost of rapidly switching between unrelated activities.

For example:

```text
14:00–14:30 Study
14:30–15:00 Programming
15:00–15:30 Study
```

may be less desirable than:

```text
14:00–15:30 Study
15:30–17:00 Programming
```

The prototype should use a simple penalty rather than a complex cognitive model.

---

# 18. Workload Distribution

The engine should avoid creating unrealistic daily schedules.

The system should consider:

- total scheduled work
- number of sessions
- session lengths
- user's configured maximum workload

The planner should preserve free time where possible.

---

# 19. Scheduling Algorithm

The first implementation should roughly follow:

```text
1. Load planning input.

2. Expand recurring calendar events.

3. Determine unavailable periods.

4. Calculate available intervals.

5. Normalize activity requirements.

6. Generate candidate slots for each activity.

7. Remove candidates violating hard constraints.

8. Score remaining candidates.

9. Prioritize activities according to:
   - hard deadlines
   - goal priority
   - activity priority
   - remaining target

10. Select compatible candidates.

11. Validate the complete schedule.

12. Calculate feasibility.

13. Generate scheduling explanations.

14. Return the plan.
```

---

# 20. Feasibility

The planner should distinguish between:

```text
fully_feasible
partially_feasible
infeasible
```

### Fully feasible

All requested requirements can be satisfied.

### Partially feasible

Some requirements can be satisfied, but not all.

Example:

```text
Requested:
10 hours

Scheduled:
7 hours

Remaining:
3 hours
```

### Infeasible

An activity cannot be scheduled at all because of hard constraints.

---

# 21. Feasibility Response

A planning result should contain structured information.

Conceptually:

```json
{
  "status": "partially_feasible",
  "scheduled_minutes": 420,
  "requested_minutes": 600,
  "unscheduled_minutes": 180,
  "scheduled_items": [],
  "conflicts": [],
  "warnings": []
}
```

This information can then be presented by the AI.

---

# 22. Plan Modification

When the user requests:

> "Move gym from Wednesday to Thursday."

The system should not regenerate the entire schedule blindly.

It should:

1. Identify the affected scheduled activity.
2. Identify candidate replacement slots.
3. Check hard constraints.
4. Compare soft-constraint scores.
5. Apply the modification if feasible.
6. Revalidate affected activities.
7. Report any consequences.

---

# 23. Regeneration

The system should support two conceptual modes:

### Full regeneration

Rebuild the plan using the current state.

### Local modification

Modify only the relevant part of the schedule.

The first prototype may implement full regeneration first, followed by local modification.

---

# 24. Explainability

Planning results should contain reasons for significant decisions.

Example:

```text
Scheduled Algorithms Study on Tuesday 14:00–15:30 because:

- The activity has high priority.
- The exam deadline is approaching.
- The period is long enough for the preferred session.
- The time falls within the user's preferred study hours.
```

The AI can convert these structured reasons into natural language.

The planning engine itself should not generate conversational prose.

---

# 25. Important Edge Cases

The engine should eventually handle:

- overlapping fixed events
- insufficient available time
- activity deadline conflicts
- extremely short availability windows
- recurring activities
- activities requiring multiple sessions
- multiple high-priority activities competing for the same time
- user changes after plan generation
- timezone changes
- daylight-saving transitions
- cancelled calendar events

Only the necessary cases need to be implemented in the first prototype.

---

# 26. Future Evolution

The planning engine may eventually evolve toward:

- constraint programming
- mathematical optimization
- better workload models
- energy-aware scheduling
- travel-time optimization
- learned user preferences
- adaptive scheduling
- automatic rescheduling

These should be introduced only after the deterministic prototype is validated.

## Implemented (ADR 003)

Cloudflare D1, migrations in `migrations/`. `users(id, email, password_hash, created_at)`, `sessions(id = SHA-256 of token, user_id, expires_at)`
and `user_data(user_id, data JSON, updated_at)`. `user_data` is an interim single-document store; the normalised tables above are still the target.
