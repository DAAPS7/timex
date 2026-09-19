# Product Specification

## 1. Product Vision

The application is an AI-powered time management assistant designed to help people fit the things they need and want to do into their work, school, and personal lives.

Users often have a mixture of:

- fixed commitments
- work or school
- personal responsibilities
- recurring activities
- long-term goals
- deadlines
- hobbies
- social activities
- exercise
- personal projects

The problem is not simply knowing what needs to be done.

The problem is deciding **when everything can realistically happen**.

The application should help transform this complexity into a practical schedule.

---

# 2. Core Value Proposition

The application should answer:

> "Given everything I have going on and what I want to accomplish, how can I realistically fit it all into my available time?"

Instead of requiring users to manually construct every part of their schedule, the application should help determine:

- what can fit
- when it can fit
- what should take priority
- what conflicts exist
- what cannot realistically fit
- what compromises are necessary

The system should be transparent about tradeoffs.

---

# 3. Target Users

The initial target user is someone with a relatively complex personal schedule.

Examples:

- university students
- professionals
- people combining work and study
- people pursuing fitness or personal projects alongside work
- people managing multiple recurring activities

The first prototype should primarily optimize for individual users.

---

# 4. Core Concepts

## 4.1 Calendar Event

A calendar event represents a commitment occurring at a specific time.

Examples:

- university lecture
- work shift
- meeting
- appointment
- commute
- travel
- manually scheduled event

Calendar events normally behave as hard constraints.

---

## 4.2 Activity

An activity represents something the user wants or needs to spend time doing.

Examples:

- gym
- studying
- programming
- reading
- gaming
- cleaning
- socializing

An activity does not necessarily have a specific time.

It contains requirements and preferences that the planning engine uses to determine when it should occur.

Possible properties include:

- name
- description
- target duration
- preferred session duration
- frequency
- priority
- deadline
- preferred days
- preferred times
- avoided times
- flexibility
- required recovery
- associated goal

---

## 4.3 Goal

A goal represents a larger outcome the user wants to achieve.

Examples:

> Pass an exam.

> Finish a personal project.

> Exercise consistently for three months.

Goals can contain or be associated with activities.

A goal may have:

- title
- description
- deadline
- priority
- target
- progress
- associated activities

---

## 4.4 Scheduled Activity

A scheduled activity is an instance of an activity placed into a specific time period.

Example:

```text
Activity:
Study Algorithms

Scheduled instance:
October 3
14:00–15:30
```

The underlying activity and its scheduled instances must remain separate concepts.

---

## 4.5 Plan

A plan is a proposed or accepted arrangement of scheduled activities over a specific planning period.

Examples:

- today's plan
- weekly plan
- exam preparation plan

A plan should have a status such as:

- draft
- proposed
- accepted
- modified
- archived

Plans should eventually support versioning.

---

# 5. Core User Experience

The central interaction should be:

```text
User provides commitments
        ↓
User provides activities/goals
        ↓
System calculates available time
        ↓
User requests a plan
        ↓
Planning engine generates schedule
        ↓
User reviews schedule
        ↓
User accepts or modifies it
        ↓
System remembers the resulting state
```

---

# 6. First-Time User Flow

The first prototype should not require an extremely long onboarding process.

The user should be able to:

1. Create an account.
2. Set timezone.
3. Provide basic working/study hours.
4. Add several fixed calendar events.
5. Add activities.
6. Add an optional goal.
7. Generate their first plan.

The onboarding should demonstrate the product's value quickly.

---

# 7. Activity Creation Flow

The user should be able to create an activity manually or through the AI assistant.

Example:

> "I want to go to the gym four times a week for about an hour."

The system should convert this into structured activity data.

The user should be able to review and modify the interpreted values.

Example:

```text
Gym

Frequency:
4 times / week

Session duration:
60 minutes

Preferred time:
17:00–21:00

Priority:
Medium
```

---

# 8. Goal Creation Flow

Example:

> "I have an algorithms exam in three weeks and need to study for it."

The system should allow creation of:

```text
Goal:
Algorithms Exam

Deadline:
[date]

Priority:
High

Associated activity:
Algorithms Study
```

The application should not assume exact study requirements unless the user provides them or explicitly asks the AI to estimate them.

---

# 9. Planning Flow

The user can request:

> "Plan my week."

The system should:

1. Retrieve fixed commitments.
2. Retrieve activities.
3. Retrieve active goals.
4. Retrieve preferences.
5. Calculate available periods.
6. Generate candidate slots.
7. Apply hard constraints.
8. Score candidates.
9. Generate a proposed plan.
10. Return the plan and relevant reasoning.

---

# 10. Plan Review

The generated plan should be visually understandable.

The user should be able to:

- view the plan by day
- see scheduled activities
- see fixed events
- identify free time
- move activities
- remove activities
- regenerate part or all of the plan

The application should clearly distinguish:

- fixed commitments
- planned activities
- free time

---

# 11. AI Assistant

The AI assistant should support natural-language interaction with the planning system.

Examples:

> "I want to start running twice a week."

> "I have an exam next Friday. Prioritize studying."

> "Move my gym session from Wednesday to Thursday."

> "Can I fit three hours of programming into this week?"

> "Why did you put my study session on Saturday?"

> "I don't want to work after 9 PM."

The AI should use application tools rather than directly manipulating data.

---

# 12. AI Behavior

The AI should:

- understand natural language
- ask clarification questions when required
- retrieve relevant user state
- create structured activities
- create goals
- request plans from the planning engine
- explain plans
- propose alternatives

The AI should not:

- fabricate calendar events
- invent available time
- silently override hard constraints
- make unsupported assumptions about the user's priorities
- directly modify the database
- claim that an activity fits when the planning engine says it does not

---

# 13. Handling Conflicts

When a user's requirements cannot all fit, the application should explicitly communicate this.

Example:

```text
Requested:
10 hours of study

Available suitable time:
6 hours
```

The system should say that the target cannot currently fit and offer alternatives such as:

- use less-preferred times
- reduce other activities
- extend the planning period
- reduce the target
- relax certain preferences

The system should not silently overload the schedule.

---

# 14. Main Screens

The first prototype should contain approximately:

## Dashboard

Shows:

- today's schedule
- upcoming activities
- important goals
- available time
- quick AI interaction

## Calendar

Shows:

- fixed events
- scheduled activities
- free periods

## Activities

Allows:

- create
- edit
- delete
- inspect activity constraints

## Goals

Allows:

- create
- edit
- view progress
- associate activities

## Assistant

Provides:

- conversational interface
- planning requests
- activity/goal management
- explanations

## Settings

Contains:

- account
- timezone
- scheduling preferences
- notification preferences
- future integrations

---

# 15. MVP Features

The MVP must include:

- user accounts
- activities
- fixed calendar events
- goals
- basic preferences
- availability calculation
- deterministic scheduling
- plan visualization
- plan modification
- AI assistant
- AI tools for interacting with application state

---

# 16. Out of Scope for MVP

The first prototype should not require:

- Google Calendar integration
- Apple Calendar integration
- Outlook integration
- wearable integrations
- social features
- collaboration
- advanced analytics
- payments
- subscriptions
- complex notifications
- machine-learning-based scheduling
- autonomous calendar modification
- multi-agent AI systems

These may be added after validating the core experience.

---

# 17. Future Direction

Potential future features include:

- Google Calendar synchronization
- Apple Calendar synchronization
- Outlook synchronization
- automatic calendar updates
- smart notifications
- habit tracking
- time-use analytics
- energy-aware scheduling
- travel-time awareness
- location-aware scheduling
- adaptive scheduling based on user behavior
- advanced optimization
- recurring routines
- collaborative scheduling

These features must not influence the architecture of the MVP unnecessarily.
