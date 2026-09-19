# AI Time Management Assistant

## 1. Project Overview

This project is an AI-powered time management assistant for web and mobile.

The core purpose of the application is to help users fit the activities they need and want to do into their work, school, and personal lives.

The application should not behave primarily as a chatbot that gives generic productivity advice.

It should behave as a **planning system**.

The fundamental problem it solves is:

> Given a user's commitments, available time, activities, goals, preferences, and constraints, create realistic schedules that help the user accomplish what matters to them.

The AI is responsible for understanding natural language and helping the user interact with the planning system.

The actual scheduling and constraint handling should be performed by deterministic application logic rather than relying entirely on an LLM.

---

# 2. Product Principles

### 2.1 Realistic over idealistic

The application should create schedules that a real person could realistically follow.

Do not fill every available minute.

Preserve reasonable amounts of:

- breaks
- meals
- personal time
- transition time
- sleep
- unscheduled/free time

### 2.2 User control

The AI should propose and modify plans rather than silently making significant changes.

Important schedule changes should be explainable and visible to the user.

### 2.3 AI as an interface, not the source of truth

The LLM should interpret user intent and interact with application tools.

It should not independently invent:

- calendar events
- availability
- durations
- deadlines
- user preferences
- scheduling constraints

All factual application state must come from the application/database.

### 2.4 Deterministic scheduling

Scheduling decisions should be handled by application code whenever possible.

The AI may determine:

> "The user wants to study algorithms for approximately 6 hours this week."

The planning engine should determine:

> "These four time slots satisfy the current constraints."

### 2.5 Explainability

Whenever the system creates or significantly changes a schedule, it should be able to explain why.

Example:

> "I scheduled your study sessions on Monday, Tuesday, Thursday, and Saturday because those are your longest available periods before the exam."

---

# 3. Core Domain Concepts

The application is built around the following concepts.

## User

Represents the person using the application.

A user has:

- preferences
- timezone
- working/studying schedule
- activities
- goals
- calendar events
- plans

---

## Calendar Event

A fixed or externally synchronized commitment.

Examples:

- university class
- work shift
- meeting
- doctor's appointment
- travel
- manually created event

Calendar events generally represent things that cannot freely be moved.

Properties should include concepts such as:

- title
- start time
- end time
- recurrence
- location
- source
- flexibility
- user ownership

---

## Activity

Something the user wants or needs to spend time doing.

Examples:

- gym
- studying
- programming
- reading
- gaming
- socializing
- personal projects

Activities are not necessarily scheduled at a specific time.

An activity can have constraints such as:

- target duration
- preferred duration per session
- frequency
- deadline
- priority
- preferred time range
- avoided time range
- preferred days
- flexibility
- required recovery time
- energy requirement

---

## Goal

A higher-level objective that may require multiple activities.

Example:

```text
Goal:
Pass Algorithms Exam

Deadline:
2026-10-15

Priority:
High

Required activities:
- Algorithms study
- Practice exercises
```

Goals should allow the system to understand _why_ activities exist.

---

## Availability

Availability represents periods in which the user could potentially perform activities.

Availability should generally be **derived from calendar events and user preferences**, rather than manually maintaining a separate list of free periods.

For example:

```text
08:00 - 09:00  unavailable
09:00 - 13:00  university
13:00 - 14:00  lunch
14:00 - 16:00  available
16:00 - 17:30  gym
17:30 - 20:00  available
```

---

## Scheduled Activity

An activity placed into a specific time slot by the planning engine.

A scheduled activity references its source activity.

Example:

```text
Activity:
Study Algorithms

Scheduled instance:
Tuesday
14:00 - 15:30
```

Activities and scheduled activities must remain conceptually separate.

---

## Plan

A collection of scheduled activities for a particular planning period.

Examples:

- today's plan
- weekly plan
- exam preparation plan

Plans should be versionable so that the system can understand how a schedule changed.

---

# 4. High-Level Architecture

Use a layered architecture.

```text
┌─────────────────────────────────────────┐
│                CLIENTS                  │
│                                         │
│       Web App       Mobile App          │
└───────────────────┬─────────────────────┘
                    │
                    │ HTTPS / API
                    ▼
┌─────────────────────────────────────────┐
│               BACKEND                   │
│                                         │
│  API                                     │
│  Authentication                          │
│  Domain Services                         │
│  Planning Engine                         │
│  AI Orchestration                        │
└──────────────┬──────────────┬───────────┘
               │              │
               ▼              ▼
        ┌────────────┐  ┌───────────────┐
        │ PostgreSQL │  │ External APIs │
        │            │  │               │
        │ App State  │  │ Calendars     │
        └────────────┘  │ AI Providers  │
                        └───────────────┘
```

The frontend must never directly manipulate the database.

The frontend communicates with the backend through a defined API.

---

# 5. Architectural Layers

## Presentation Layer

Responsible for:

- UI
- navigation
- user interaction
- displaying plans
- displaying calendar
- displaying activities and goals
- AI chat interface

The presentation layer must not contain core scheduling logic.

---

## API Layer

Responsible for:

- HTTP endpoints
- request validation
- authentication
- authorization
- serialization/deserialization

The API layer should delegate actual business operations to domain services.

---

## Domain Layer

Contains the application's business logic.

Examples:

- ActivityService
- GoalService
- CalendarService
- PlanningService
- UserPreferenceService

Business rules should live here rather than inside API controllers or UI components.

---

## Planning Engine

The planning engine is one of the most important parts of the application.

It should be independent from the AI layer.

Its responsibilities include:

1. Retrieve commitments.
2. Determine available time.
3. Retrieve activities and goals.
4. Apply constraints.
5. Identify candidate time slots.
6. Score candidate slots.
7. Construct a schedule.
8. Detect conflicts.
9. Return a proposed plan.
10. Provide reasons for important scheduling decisions.

The planning engine should be deterministic given the same input state.

---

## AI Orchestration Layer

The AI layer translates natural language into structured operations.

Example:

User:

> "I want to study six hours this week and go to the gym four times."

The AI should interpret this as structured intent.

Conceptually:

```json
{
  "intent": "create_plan",
  "activities": [
    {
      "name": "Study",
      "target_duration_minutes": 360
    },
    {
      "name": "Gym",
      "target_sessions": 4
    }
  ]
}
```

The AI then calls application tools/services.

It must not directly manipulate the database.

---

# 6. AI Tool Architecture

The AI should interact with the application through explicit tools.

Potential tools include:

```text
get_user_context
get_calendar_events
get_availability
get_activities
get_goals

create_activity
update_activity
delete_activity

create_goal
update_goal

generate_plan
get_current_plan
modify_plan

schedule_activity
reschedule_activity
remove_scheduled_activity

explain_plan
```

Tools should have strict schemas.

The AI should never receive unrestricted database access.

---

# 7. Planning Engine

The first prototype should use a deterministic rule-based scheduler.

Do not implement a complex optimization algorithm prematurely.

The initial scheduling process should roughly be:

```text
1. Load user's calendar.
2. Load user's activities.
3. Load goals and deadlines.
4. Calculate available periods.
5. Remove periods blocked by fixed events.
6. Apply activity constraints.
7. Generate candidate slots.
8. Score candidate slots.
9. Select compatible slots.
10. Check conflicts.
11. Generate proposed plan.
12. Return plan + reasoning.
```

Candidate slots can initially be scored using factors such as:

```text
+ priority
+ deadline urgency
+ preferred time
+ preferred day
+ consistency
+ sufficient session length

- conflicts
- excessive context switching
- insufficient recovery
- inconvenient time
- excessive daily workload
```

The scoring system should be isolated so that it can later be replaced by a more sophisticated optimization algorithm.

---

# 8. Important Scheduling Rules

The scheduler should distinguish between:

### Hard constraints

These must not be violated.

Examples:

- calendar events
- sleep requirements
- unavailable periods
- activity deadline
- minimum session duration
- overlapping events

### Soft constraints

These should influence scheduling but can be violated when necessary.

Examples:

- preferred gym time
- preferred study time
- preferred days
- avoiding late-night work
- keeping weekends free

This distinction is essential.

If the user wants to study six hours but only has four feasible hours, the system should not invent two additional hours.

It should report the conflict and explain the tradeoff.

---

# 9. Frontend Architecture

The frontend should be feature-oriented rather than organized solely by technical type.

Conceptually:

```text
src/
├── features/
│   ├── assistant/
│   ├── calendar/
│   ├── activities/
│   ├── goals/
│   ├── planning/
│   └── settings/
│
├── components/
│   ├── ui/
│   └── layout/
│
├── services/
│   └── api/
│
├── state/
├── navigation/
├── hooks/
├── utils/
└── types/
```

Feature-specific logic should remain close to its feature.

Reusable UI components belong in `components/ui`.

API communication belongs in the API/service layer.

Do not place API calls directly inside presentational components.

---

# 10. Backend Architecture

The backend should be organized by domain.

Conceptually:

```text
backend/
├── api/
│   ├── routes/
│   └── schemas/
│
├── domains/
│   ├── users/
│   ├── calendar/
│   ├── activities/
│   ├── goals/
│   ├── planning/
│   └── assistant/
│
├── ai/
│   ├── agents/
│   ├── tools/
│   ├── prompts/
│   └── schemas/
│
├── infrastructure/
│   ├── database/
│   ├── calendar/
│   └── ai/
│
└── core/
    ├── config/
    ├── auth/
    └── logging/
```

Exact filenames and framework-specific conventions can be decided during implementation.

---

# 11. Database Principles

The database should represent application state rather than AI-generated conversation state.

Core entities will likely include:

```text
users
calendar_events
activities
goals
scheduled_activities
plans
user_preferences
```

Potential future entities:

```text
activity_history
goal_progress
calendar_integrations
ai_conversations
ai_messages
plan_versions
```

Do not add entities simply because they might be useful later.

Only implement what the current product requires.

---

# 12. Prototype Scope

The first prototype should prove the core product concept.

## Required

### User

A basic user profile.

### Activities

Users can:

- create activities
- define duration
- define frequency
- define priority
- define preferences

### Calendar

Users can create fixed events.

### Goals

Users can create basic goals and deadlines.

### Planning

The application can generate a daily/weekly plan.

### AI Assistant

The user can communicate naturally with the assistant.

The assistant should be able to:

- understand requests
- inspect the user's schedule
- create/update activities
- create goals
- generate plans
- explain plans
- propose changes

### Plan visualization

The user must be able to see the generated schedule visually.

The prototype should make the central value proposition obvious:

> "Give the assistant my commitments and what I want to accomplish, and it figures out how to fit everything together."

---

# 13. Explicitly Out of Scope for the First Prototype

Do not implement these unless explicitly requested:

- Apple Calendar integration
- Google Calendar integration
- Outlook integration
- advanced notifications
- wearable integrations
- social features
- team scheduling
- complex analytics
- advanced machine learning
- autonomous calendar modification
- complicated optimization algorithms
- subscription/payment infrastructure
- elaborate onboarding
- excessive animation
- unnecessary microservices

The prototype should validate the planning experience before expanding the system.

---

# 14. Cross-Platform Strategy

The application should be designed so that the backend is platform-independent.

Web and mobile clients should consume the same backend API.

Do not implement separate business logic for web and mobile.

The planning engine, authentication, AI orchestration, and domain logic belong on the backend.

The clients are responsible primarily for presentation and user interaction.

---

# 15. API Principles

Use resource-oriented APIs.

Conceptual examples:

```text
GET    /api/activities
POST   /api/activities
PATCH  /api/activities/:id
DELETE /api/activities/:id

GET    /api/goals
POST   /api/goals
PATCH  /api/goals/:id

GET    /api/calendar/events
POST   /api/calendar/events

GET    /api/plans/current
POST   /api/plans/generate
POST   /api/plans/:id/modify

POST   /api/assistant/message
```

Exact API contracts should be documented separately in:

```text
docs/api.md
```

Do not create endpoints simply because they seem convenient. Keep the API consistent with the domain model.

---

# 16. Error Handling

Errors must be explicit and actionable.

Examples:

```text
INSUFFICIENT_AVAILABLE_TIME
SCHEDULING_CONFLICT
INVALID_ACTIVITY_CONSTRAINT
DEADLINE_UNACHIEVABLE
UNAUTHORIZED
RESOURCE_NOT_FOUND
```

The AI layer should be able to translate technical/domain errors into understandable explanations for the user.

Example:

Internal:

```text
DEADLINE_UNACHIEVABLE
```

User-facing:

> "You need approximately 8 hours of study before Friday, but only 5 suitable hours are currently available. I can either extend the sessions, use less-preferred time slots, or reduce the target."

---

# 17. Security

Never expose:

- API keys
- database credentials
- authentication secrets
- private tokens

to the frontend.

Use environment variables for secrets.

All protected API routes must validate authentication.

Users must only be able to access their own data.

Do not trust user IDs supplied by the client when determining ownership.

---

# 18. Code Quality Rules

Follow these rules throughout development:

1. Prefer simple solutions over premature abstraction.
2. Keep business logic out of UI components.
3. Keep AI logic separate from deterministic business logic.
4. Keep scheduling logic independent from the AI provider.
5. Use strong typing wherever supported.
6. Validate external input.
7. Avoid duplicated business logic.
8. Do not introduce dependencies without a reason.
9. Do not create abstractions for hypothetical future requirements.
10. Keep functions focused and reasonably small.
11. Prefer explicit code over clever code.
12. Document architectural decisions that are not obvious.
13. Do not silently change architectural boundaries.
14. Do not rewrite working systems unnecessarily.

---

# 19. AI Provider Independence

The application should not become tightly coupled to one AI provider.

AI functionality should communicate through an abstraction layer.

Conceptually:

```text
Application
     │
     ▼
AI Service
     │
     ▼
AI Provider Adapter
     │
     ├── Claude
     ├── OpenAI
     └── Future providers
```

Provider-specific implementation should remain isolated.

Prompts, tool schemas, and AI-specific configuration should not be scattered throughout the application.

---

# 20. Development Method

Claude Code must work incrementally.

Do not attempt to implement the entire application in one step.

Before implementing a feature:

1. Understand the existing architecture.
2. Identify affected domains.
3. Inspect relevant files.
4. Explain the implementation approach.
5. Implement the smallest coherent change.
6. Run relevant tests/checks.
7. Review the result against the architecture.
8. Only then continue.

Do not rewrite unrelated parts of the project.

---

# 21. Architectural Change Rule

If an implementation requires changing a major architectural decision, stop and explain:

1. What decision needs to change.
2. Why the current architecture is insufficient.
3. What alternatives exist.
4. What the consequences are.

Do not silently redesign the architecture.

---

# 22. Documentation

Maintain:

```text
docs/
├── product.md
├── architecture.md
├── database.md
├── api.md
├── planning-engine.md
└── decisions/
```

Architecture-changing decisions should be recorded as short Architecture Decision Records.

Example:

```text
docs/decisions/001-deterministic-planning-engine.md
```

---

# 23. Implementation Order

The initial implementation should follow approximately this order.

### Phase 1 — Foundation

- Repository setup
- Frontend setup
- Backend setup
- Database setup
- Environment configuration
- Basic API
- Basic authentication structure

### Phase 2 — Core Domain

Implement:

- users
- activities
- goals
- calendar events
- scheduled activities
- plans

### Phase 3 — Basic Planning Engine

Implement:

- availability calculation
- hard constraints
- soft constraints
- candidate slot generation
- basic scoring
- schedule generation
- conflict detection

### Phase 4 — Core UI

Implement:

- dashboard
- calendar
- activities
- goals
- generated plan
- plan editing

### Phase 5 — AI Assistant

Implement:

- conversation interface
- AI service
- structured tool calls
- application tools
- context retrieval
- plan generation through AI
- plan explanation

### Phase 6 — Refinement

Test the complete flow:

```text
User creates commitments
        ↓
User creates activities/goals
        ↓
User asks AI for help
        ↓
AI understands request
        ↓
Planning engine creates plan
        ↓
User reviews plan
        ↓
User accepts/modifies plan
```

Only after this flow works should additional integrations and advanced features be considered.

---

# 24. Claude Code Behaviour

At the beginning of a new task:

- Read this file.
- Inspect the existing project.
- Identify the relevant architecture.
- Do not assume files or technologies that do not exist.
- Do not immediately start coding if the requested change is architecturally ambiguous.

For large tasks, first provide:

```text
Understanding
Architecture impact
Implementation plan
Files likely to change
Potential risks
```

Then implement after the plan is clear.

When implementing, prioritize maintaining architectural consistency over minimizing the number of changed files.

---

# 25. Current Product Goal

The immediate goal is NOT to build a complete productivity platform.

The immediate goal is to prove one experience:

> A user tells the application what their life currently looks like and what they want to accomplish. The application understands their constraints and creates a realistic schedule that fits those goals into their available time.

Every early implementation decision should support validating this experience.
