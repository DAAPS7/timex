# System Architecture

## 1. Architectural Goal

The system should provide a shared backend for web and mobile clients while keeping business logic independent from presentation and AI providers.

The architecture should initially be a **modular monolith**.

Do not introduce microservices for the prototype.

---

# 2. High-Level Architecture

```text
┌─────────────────────────────────────────────┐
│                  CLIENTS                    │
│                                             │
│       Web Application    Mobile App         │
└──────────────────────┬──────────────────────┘
                       │
                       │ HTTPS
                       ▼
┌─────────────────────────────────────────────┐
│                  BACKEND                    │
│                                             │
│ API                                         │
│ ├── Authentication                          │
│ ├── Calendar                                │
│ ├── Activities                              │
│ ├── Goals                                   │
│ ├── Planning                                │
│ └── Assistant                               │
│                                             │
│ Domain Services                             │
│                                             │
│ Planning Engine                             │
│                                             │
│ AI Orchestration                            │
└───────────────┬────────────────┬────────────┘
                │                │
                ▼                ▼
       ┌────────────────┐  ┌─────────────────┐
       │   PostgreSQL   │  │ External APIs   │
       │                │  │                 │
       │ Application    │  │ AI Providers    │
       │ State          │  │ Calendar APIs   │
       └────────────────┘  └─────────────────┘
```

---

# 3. Architectural Principles

## 3.1 Modular monolith

The first implementation should be one backend application with clearly separated domains.

Benefits:

- simpler development
- simpler deployment
- easier debugging
- easier local development
- lower infrastructure complexity

The internal domain boundaries should still be strong enough that individual components can evolve independently.

---

# 4. Frontend

The frontend should support both web and mobile.

The exact framework should be chosen before implementation, but the application should follow a feature-oriented architecture.

Conceptually:

```text
frontend/
├── src/
│   ├── features/
│   │   ├── assistant/
│   │   ├── calendar/
│   │   ├── activities/
│   │   ├── goals/
│   │   ├── planning/
│   │   └── settings/
│   │
│   ├── components/
│   │   ├── ui/
│   │   └── layout/
│   │
│   ├── services/
│   │   └── api/
│   │
│   ├── state/
│   ├── navigation/
│   ├── hooks/
│   ├── types/
│   └── utils/
```

The frontend should consume the backend API.

It must not access PostgreSQL directly.

---

# 5. Backend

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
│   ├── providers/
│   ├── tools/
│   ├── prompts/
│   └── schemas/
│
├── infrastructure/
│   ├── database/
│   ├── calendar/
│   └── external/
│
└── core/
    ├── config/
    ├── auth/
    ├── errors/
    └── logging/
```

The exact framework-specific naming can differ.

The important requirement is that domain boundaries remain clear.

---

# 6. Request Flow

A normal API request should follow:

```text
Client
  ↓
API Route
  ↓
Validation
  ↓
Domain Service
  ↓
Repository / Infrastructure
  ↓
Database
```

For example:

```text
POST /activities
      ↓
ActivityRoute
      ↓
Validate request
      ↓
ActivityService
      ↓
ActivityRepository
      ↓
PostgreSQL
```

---

# 7. AI Request Flow

AI interactions should follow:

```text
User
  ↓
AI Chat Interface
  ↓
Backend Assistant Endpoint
  ↓
AI Orchestration
  ↓
LLM
  ↓
Tool Call
  ↓
Domain Service
  ↓
Planning Engine / Database
  ↓
Tool Result
  ↓
LLM
  ↓
User
```

Example:

```text
User:
"Can you fit 5 hours of study into this week?"

        ↓

LLM understands intent

        ↓

get_availability()

        ↓

PlanningService

        ↓

Planning Engine

        ↓

Result:
4h 30m feasible

        ↓

LLM explains:
"I can fit 4h 30m without violating
your current commitments..."
```

---

# 8. Domain Boundaries

## Users

Responsible for:

- identity
- authentication-related user information
- timezone
- user-level preferences

## Calendar

Responsible for:

- fixed events
- event recurrence
- event availability
- future external calendar synchronization

## Activities

Responsible for:

- activity definitions
- activity requirements
- activity preferences

## Goals

Responsible for:

- objectives
- deadlines
- priorities
- activity associations
- progress

## Planning

Responsible for:

- availability
- scheduling
- constraints
- scoring
- plans
- scheduled activities

## Assistant

Responsible for:

- conversations
- AI orchestration
- tool execution
- natural-language interaction

---

# 9. Planning Engine Independence

The planning engine must not import or depend on:

- frontend code
- HTTP request objects
- AI provider SDKs
- prompt templates
- chat-specific logic

It should operate on structured domain data.

Conceptually:

```text
PlanningInput
      ↓
PlanningEngine
      ↓
PlanningResult
```

This makes the engine independently testable.

---

# 10. AI Provider Independence

AI providers must be hidden behind an abstraction.

Conceptually:

```text
AssistantService
      ↓
AIProvider interface
      ↓
┌──────────────┬──────────────┐
│ Claude       │ OpenAI       │
│ Adapter      │ Adapter      │
└──────────────┴──────────────┘
```

The rest of the application must not depend directly on provider-specific SDKs.

---

# 11. API

Initial API resources should approximately include:

```text
/auth
/users

/activities
/goals

/calendar/events

/plans
/plans/:id

/assistant
```

Example endpoints:

```text
GET    /api/activities
POST   /api/activities
PATCH  /api/activities/:id
DELETE /api/activities/:id

GET    /api/goals
POST   /api/goals
PATCH  /api/goals/:id
DELETE /api/goals/:id

GET    /api/calendar/events
POST   /api/calendar/events
PATCH  /api/calendar/events/:id
DELETE /api/calendar/events/:id

POST   /api/plans/generate
GET    /api/plans/current
POST   /api/plans/:id/modify

POST   /api/assistant/message
```

Exact request/response schemas should be documented as implementation progresses.

---

# 12. Authentication

The backend must authenticate every protected request.

Authorization must be based on the authenticated user rather than user IDs supplied by the client.

Every database query involving user-owned data must enforce ownership.

---

# 13. External Integrations

External integrations should be isolated behind infrastructure adapters.

Potential future integrations:

```text
Google Calendar
Apple Calendar
Outlook Calendar
AI providers
Notification services
```

The core domain should not depend directly on any specific provider.

---

# 14. Error Architecture

Errors should be represented as domain-level errors where appropriate.

Examples:

```text
RESOURCE_NOT_FOUND
UNAUTHORIZED
FORBIDDEN
INVALID_ACTIVITY
SCHEDULING_CONFLICT
INSUFFICIENT_AVAILABLE_TIME
DEADLINE_UNACHIEVABLE
INVALID_CONSTRAINT
```

The API converts these into appropriate HTTP responses.

The AI layer can convert domain errors into user-friendly explanations.

---

# 15. Testing Strategy

The most important tests should focus on domain behavior.

Priority:

1. Planning engine
2. Availability calculation
3. Constraint handling
4. Activity/goal behavior
5. API services
6. AI tool execution
7. Frontend behavior

The planning engine should have deterministic tests.

Given the same planning input, the same algorithm version should produce the same result.

---

# 16. Deployment

The prototype should be deployable as:

```text
Frontend
    ↓
Backend
    ↓
PostgreSQL
```

Avoid infrastructure that is unnecessary for the prototype.

Scaling architecture should only be introduced when actual requirements justify it.
