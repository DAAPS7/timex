import Foundation
import Observation

/// The app's single source of state. It holds the user's data, talks to the backend and applies what the user
/// confirms. It contains NO scheduling logic: plans come from POST /api/plans/generate, answers from the assistant API
/// (CLAUDE.md §2.3/§2.4/§14).
@MainActor
@Observable
final class AppStore {
    enum Phase: Equatable { case loading, signedOut, ready }

    private(set) var phase: Phase = .loading
    private(set) var user: User?
    private(set) var data = UserData.empty()
    private(set) var busy = false
    private(set) var assistantBusy = false
    var errorMessage: String?
    private(set) var syncFailed = false

    private let api = APIClient()
    private var saveTask: Task<Void, Never>?
    private var loaded = false // false while the data is being loaded, so a load is never saved back
    private var triedWeeks = Set<String>()

    // MARK: Session

    func bootstrap() async {
        do {
            if let user = try await api.me() { await enter(user) } else { phase = .signedOut }
        } catch {
            errorMessage = error.localizedDescription
            phase = .signedOut
        }
    }

    func signIn(email: String, password: String, create: Bool) async {
        errorMessage = nil
        busy = true
        defer { busy = false }
        do {
            let user = create ? try await api.register(email: email, password: password) : try await api.login(email: email, password: password)
            await enter(user)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func signOut() async {
        try? await api.logout()
        saveTask?.cancel()
        loaded = false
        user = nil
        data = .empty()
        triedWeeks = []
        phase = .signedOut
    }

    private func enter(_ user: User) async {
        do {
            let stored = try await api.loadState()
            self.data = stored ?? .empty()
            self.user = user
            loaded = true
            phase = .ready
        } catch {
            errorMessage = error.localizedDescription
            phase = .signedOut
        }
    }

    // MARK: Saving (debounced, like the web store)

    /// Every change to the user's data goes through here so it is saved afterwards.
    private func modify(_ change: (inout UserData) -> Void) {
        change(&data)
        scheduleSave()
    }

    private func scheduleSave() {
        guard loaded else { return }
        saveTask?.cancel()
        let snapshot = data
        saveTask = Task {
            try? await Task.sleep(for: .milliseconds(600))
            guard !Task.isCancelled else { return }
            do {
                try await self.api.saveState(snapshot)
                self.syncFailed = false
            } catch {
                self.syncFailed = true
            }
        }
    }

    // MARK: Plans

    func plan(for weekStart: String) -> Plan? { data.plans[weekStart]?.decoded(as: Plan.self) }

    private func setPlan(_ plan: Plan) {
        if let value = try? JSONValue(encoding: plan) { modify { $0.plans[plan.weekStart] = value } }
    }

    func planningInput(weekStart: String, previous: [ScheduledItem]? = nil, source: UserData? = nil) -> PlanningInput {
        let s = source ?? data
        let today = TimeUtils.today()
        return PlanningInput(
            today: today, weekStart: weekStart, events: s.events, activities: s.activities, goals: s.goals, preferences: s.preferences,
            previousItems: (previous?.isEmpty == false) ? previous : nil,
            nowMinutes: TimeUtils.nowMinutes())
    }

    /// Ask the backend engine for a proposed plan. `stable` keeps the sessions of the current plan that are still valid.
    func generate(weekStart: String, stable: Bool = false, source: UserData? = nil) async {
        busy = true
        errorMessage = nil
        defer { busy = false }
        do {
            let previous = stable ? plan(for: weekStart)?.result.scheduledItems : nil
            let result = try await api.generatePlan(planningInput(weekStart: weekStart, previous: previous, source: source))
            adopt(weekStart: weekStart, result: result, status: "proposed")
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func adopt(weekStart: String, result: PlanningResult, status: String) {
        let version = (plan(for: weekStart)?.version ?? 0) + 1
        setPlan(Plan(id: "plan-\(weekStart)", weekStart: weekStart, status: status, version: version,
                     createdAt: ISO8601DateFormatter().string(from: Date()), result: result))
    }

    /// Every week on screen gets a proposed plan when it has none (once per week per session, so a failure cannot loop).
    func ensurePlans(for weeks: [String]) async {
        guard !data.activities.isEmpty else { return }
        for week in weeks where plan(for: week) == nil && TimeUtils.addDays(week, 6) >= TimeUtils.today() && !triedWeeks.contains(week) {
            triedWeeks.insert(week)
            await generate(weekStart: week)
        }
    }

    func acceptPlan(weekStart: String) {
        guard var p = plan(for: weekStart) else { return }
        p.status = "accepted"
        setPlan(p)
    }

    func removeItem(weekStart: String, itemId: String) {
        guard var p = plan(for: weekStart) else { return }
        p.result.scheduledItems.removeAll { $0.id == itemId }
        p.status = "modified"
        p.version += 1
        setPlan(p)
    }

    /// Free minutes left today: fresh availability (already excludes the hours that have passed) minus what is still planned.
    func freeToday() async -> Int? {
        let today = TimeUtils.today()
        let week = TimeUtils.startOfWeek(today)
        var input = planningInput(weekStart: week)
        input.activities = []
        guard let result = try? await api.generatePlan(input), let available = result.availableMinutesByDay[today] else { return nil }
        let now = TimeUtils.nowMinutes()
        let ahead = (plan(for: week)?.result.scheduledItems ?? []).filter { $0.date == today }.reduce(0) {
            $0 + max(0, TimeUtils.minutes($1.end) - max(TimeUtils.minutes($1.start), now))
        }
        return max(0, available - ahead)
    }

    // MARK: Activities

    func upsert(_ activity: Activity) {
        modify { d in
            if let i = d.activities.firstIndex(where: { $0.id == activity.id }) { d.activities[i] = activity } else { d.activities.append(activity) }
        }
    }

    func deleteActivity(id: String) { modify { $0.activities.removeAll { $0.id == id } } }

    func setPreferences(_ preferences: Preferences) { modify { $0.preferences = preferences } }

    // MARK: Assistant

    var chat: [ChatMessage] { data.chat.compactMap { $0.decoded(as: ChatMessage.self) } }

    private func append(_ message: ChatMessage) {
        guard let value = try? JSONValue(encoding: message) else { return }
        modify { $0.chat = Array(($0.chat + [value]).suffix(60)) }
    }

    private func update(_ id: String, _ change: (inout ChatMessage) -> Void) {
        modify { d in
            d.chat = d.chat.map { value in
                guard var m = value.decoded(as: ChatMessage.self), m.id == id else { return value }
                change(&m)
                return (try? JSONValue(encoding: m)) ?? value
            }
        }
    }

    func send(_ text: String) async {
        let message = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !message.isEmpty, !assistantBusy else { return }
        assistantBusy = true
        defer { assistantBusy = false }
        append(ChatMessage(id: UUID().uuidString, role: "user", text: message))
        let week = TimeUtils.startOfWeek(TimeUtils.today())
        do {
            let reply = try await api.askAssistant(AssistantRequest(
                message: message, state: planningInput(weekStart: week), currentItems: plan(for: week)?.result.scheduledItems))
            append(ChatMessage(id: UUID().uuidString, role: "assistant", text: reply.reply, proposals: reply.proposals,
                               plan: reply.plan, planAdoptable: reply.planAdoptable, planWeekStart: reply.planWeekStart))
        } catch {
            append(ChatMessage(id: UUID().uuidString, role: "assistant", text: error.localizedDescription))
        }
    }

    /// Nothing changes until the user confirms (product principle 2.2).
    func applyProposals(of message: ChatMessage) async {
        update(message.id) { $0.handled = true }
        for proposal in message.proposals ?? [] {
            switch proposal {
            case .createActivity(_, let a): upsert(a)
            case .createGoal(_, let g):
                modify { d in
                    if let i = d.goals.firstIndex(where: { $0.id == g.id }) { d.goals[i] = g } else { d.goals.append(g) }
                }
            case .createEvent(_, let e):
                modify { d in
                    if let i = d.events.firstIndex(where: { $0.id == e.id }) { d.events[i] = e } else { d.events.append(e) }
                }
            }
        }
        await generate(weekStart: message.planWeekStart ?? TimeUtils.startOfWeek(TimeUtils.today()), stable: true)
    }

    /// The assistant only proposes a weekly plan; it enters the calendar as accepted when the user approves it.
    func approvePlan(of message: ChatMessage) {
        guard let result = message.plan else { return }
        update(message.id) { $0.planDecision = "approved" }
        adopt(weekStart: message.planWeekStart ?? TimeUtils.startOfWeek(TimeUtils.today()), result: result, status: "accepted")
    }

    func rejectPlan(of message: ChatMessage) { update(message.id) { $0.planDecision = "rejected" } }
}
