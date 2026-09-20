# 005 — Native iOS client (SwiftUI, Liquid Glass)

## Status

Accepted (first slice written, not yet built: see `ios/README.md`).

## Context

CLAUDE.md §14 says web and mobile clients consume the same backend and hold no business logic. The web app is
responsive but the user wants a native app with the iOS 26 Liquid Glass look.

## Decision

Add `ios/`, a SwiftUI app that is a third client of the existing API. No backend change:

- Auth is the existing `timex_session` HttpOnly cookie, kept by `URLSession`'s cookie storage.
- Data is loaded and saved through `GET/PUT /api/state`; plans through `POST /api/plans/generate`; the assistant through
  `POST /api/assistant/message`. Swift contains no scheduling logic and no AI logic.
- The Swift models mirror `shared/domain.ts` completely, because `PUT /api/state` replaces the whole document; `plans` and
  `chat` stay opaque JSON so nothing written by the web client is lost.
- The Xcode project is generated from `ios/project.yml` (XcodeGen), so no `.xcodeproj` is committed.
- Target iOS 26 only: Liquid Glass (`glassEffect`, `GlassEffectContainer`, `.glass` button styles) does not exist earlier.

## Consequences

- `shared/domain.ts` is now mirrored by hand in `ios/Timex/Models/Domain.swift`; changes to the shared schema must be
  made in both. A generated schema (OpenAPI/JSON Schema) would remove this, and is worth adding if the models keep changing.
- Rules mirrored on the client are presentation only (date arithmetic, reason texts, how a weekly event recurs).
- Goals, fixed-event editing, transport/essentials settings and the guided setup remain web-only in this first slice.
