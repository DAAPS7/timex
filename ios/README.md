# Timex for iOS (SwiftUI + Liquid Glass)

A native client for the same backend as the web app (`/api`, see `docs/api.md`). It only presents data and collects
input: plans come from `POST /api/plans/generate` and the assistant from `POST /api/assistant/message`; there is no
scheduling logic in Swift (CLAUDE.md §2.3, §2.4, §14). Decision record: `docs/decisions/005-native-ios-client.md`.

> **Status: written but not compiled.** It was authored on a Windows machine without Xcode, so nothing here has been built
> or run. Expect a few compile fixes on first build, and check the layouts visually.

## Requirements

- macOS with **Xcode 26** and an **iOS 26** simulator or device (Liquid Glass APIs do not exist earlier).
- [XcodeGen](https://github.com/yonaskolb/XcodeGen): `brew install xcodegen`.
- The backend running: from the repo root `npm run cf:dev` (serves on `http://localhost:8787`).

## Run

```sh
cd ios
xcodegen            # creates Timex.xcodeproj from project.yml
open Timex.xcodeproj
```

Run on a simulator. The default server is `http://localhost:8787`; on a real device change it under **Servidor** on the
sign-in screen (or use your deployed https URL). Sign-in uses the `timex_session` cookie, which `URLSession` stores for
you, so there is no token handling in the app. Accounts are shared with the web app.

## What is in the app

| Tab | What it does |
|---|---|
| Hoje | Free time left today, what is planned, today's timeline, "plan my week" |
| Calendário | Dia / 3 dias / Semana / Agenda. Today is always the second day, so yesterday and the days ahead are visible. Plan card with accept / regenerate, tap a session for the reasons and to remove it |
| Atividades | List and form: weekly hours, preferred days and hours (optionally mandatory), split into blocks, overlap with travel/classes with a weekly cap |
| Assistente | Chat. Proposals are applied by the user; a weekly plan is approved or rejected |
| Definições | Account, server, sleep hours |

Not in this first slice (use the web app): goals, fixed events, transport, meals/essentials, the guided setup. The models
still carry every field, so data edited on the web is preserved when the app saves.

## Liquid Glass

Defined once in `Timex/Design/Glass.swift` and used consistently:

- **System-provided:** the tab bar (`TabView`, minimizing on scroll), navigation bars, toolbars and sheets become glass on
  iOS 26 without extra code.
- **`.glassEffect(_, in:)`** for cards (`glassCard()`), chips (`GlassChip`), fields (`GlassField`), chat bubbles,
  calendar blocks (tinted per activity) and the calendar container.
- **`GlassEffectContainer`** around groups of related glass (the mode picker, button rows, stat tiles, the chat composer)
  so they blend and morph together; `GlassPicker` also uses `glassEffectID` so the selection glides between options.
- **`.interactive()`** on everything tappable, so it responds to touch like system controls.
- **`.buttonStyle(.glass)` / `.glassProminent`** for buttons instead of hand-drawn backgrounds; `GlassIconButton` for
  round icon buttons.
- Glass needs something to refract, so every screen sits on `AppBackground` (dark base with warm ember glows).
- Transport and essentials are dashed outlines, not glass, so they read as reserved time rather than things to do.

## Layout

```
ios/
├── project.yml            XcodeGen definition (iOS 26 target)
└── Timex/
    ├── TimexApp.swift
    ├── Models/            Domain.swift (mirrors shared/domain.ts), JSONValue.swift, TimeUtils.swift
    ├── Services/          APIClient.swift (URLSession + cookie session)
    ├── State/             AppStore.swift (@Observable: session, saving, plans, assistant)
    ├── Design/            Glass.swift (Liquid Glass components)
    └── Views/             Root, Auth, Today, Calendar, Activities, Assistant, Settings
```

## Things to check on first build

- `Domain.swift` must stay in sync with `shared/domain.ts`; a missing field would be dropped by `PUT /api/state`.
- Data saved by older web versions (`commute.mode`, plan `commuteBlocks[].mode`) is upgraded in the decoders.
- `plans` and `chat` are stored as opaque JSON (`JSONValue`) and decoded only for display.
