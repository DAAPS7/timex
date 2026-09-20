import Foundation

// Mirrors shared/domain.ts. Every field of the server schema is listed, even the ones this app does not edit:
// PUT /api/state replaces the whole document, so a field missing here would be erased for the web client too.

enum Priority: String, Codable, CaseIterable, Identifiable {
    case low, medium, high, critical
    var id: String { rawValue }
    var label: String {
        switch self {
        case .low: "Baixa"
        case .medium: "Média"
        case .high: "Alta"
        case .critical: "Crítica"
        }
    }
}

struct CalendarEvent: Codable, Identifiable, Hashable {
    var id: String
    var title: String
    var date: String // first occurrence, YYYY-MM-DD
    var start: String // HH:mm
    var end: String
    var weekly: Bool
    var location: String?
    var remote: Bool?
    var kind: String? // "commitment" | "travel"
    var canOverlap: Bool?

    var isTravel: Bool { kind == "travel" }
}

extension CalendarEvent {
    enum CodingKeys: String, CodingKey { case id, title, date, start, end, weekly, location, remote, kind, canOverlap }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        title = try c.decode(String.self, forKey: .title)
        date = try c.decode(String.self, forKey: .date)
        start = try c.decode(String.self, forKey: .start)
        end = try c.decode(String.self, forKey: .end)
        weekly = try c.decodeIfPresent(Bool.self, forKey: .weekly) ?? false
        location = try c.decodeIfPresent(String.self, forKey: .location)
        remote = try c.decodeIfPresent(Bool.self, forKey: .remote)
        kind = try c.decodeIfPresent(String.self, forKey: .kind)
        canOverlap = try c.decodeIfPresent(Bool.self, forKey: .canOverlap)
    }
}

struct Activity: Codable, Identifiable, Hashable {
    var id: String
    var name: String
    var sessionsPerWeek: Int
    var sessionMinutes: Int
    var minSessionMinutes: Int?
    var priority: Priority
    var preferredDays: [Int] // 0 = Monday
    var preferredStart: String?
    var preferredEnd: String?
    var splitMinutes: Int?
    var canOverlap: Bool?
    var overlapWith: [String]?
    var maxOverlapMinutes: Int?
    var onlyPreferred: Bool?
    var deadline: String?
    var goalId: String?
}

extension Activity {
    enum CodingKeys: String, CodingKey {
        case id, name, sessionsPerWeek, sessionMinutes, minSessionMinutes, priority, preferredDays, preferredStart, preferredEnd
        case splitMinutes, canOverlap, overlapWith, maxOverlapMinutes, onlyPreferred, deadline, goalId
    }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        sessionsPerWeek = try c.decode(Int.self, forKey: .sessionsPerWeek)
        sessionMinutes = try c.decode(Int.self, forKey: .sessionMinutes)
        minSessionMinutes = try c.decodeIfPresent(Int.self, forKey: .minSessionMinutes)
        priority = try c.decode(Priority.self, forKey: .priority)
        preferredDays = try c.decodeIfPresent([Int].self, forKey: .preferredDays) ?? []
        preferredStart = try c.decodeIfPresent(String.self, forKey: .preferredStart)
        preferredEnd = try c.decodeIfPresent(String.self, forKey: .preferredEnd)
        splitMinutes = try c.decodeIfPresent(Int.self, forKey: .splitMinutes)
        canOverlap = try c.decodeIfPresent(Bool.self, forKey: .canOverlap)
        overlapWith = try c.decodeIfPresent([String].self, forKey: .overlapWith)
        maxOverlapMinutes = try c.decodeIfPresent(Int.self, forKey: .maxOverlapMinutes)
        onlyPreferred = try c.decodeIfPresent(Bool.self, forKey: .onlyPreferred)
        deadline = try c.decodeIfPresent(String.self, forKey: .deadline)
        goalId = try c.decodeIfPresent(String.self, forKey: .goalId)
    }
}

struct Goal: Codable, Identifiable, Hashable {
    var id: String
    var title: String
    var deadline: String
    var priority: Priority
}

struct Commute: Codable, Hashable {
    var modes: [String] // walk | bike | bus | train | car
    var minutesPerDay: Int

    enum CodingKeys: String, CodingKey { case modes, mode, minutesPerDay }
    init(modes: [String], minutesPerDay: Int) {
        self.modes = modes
        self.minutesPerDay = minutesPerDay
    }
    // Data saved by older versions has a single `mode`.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        if let modes = try c.decodeIfPresent([String].self, forKey: .modes), !modes.isEmpty {
            self.modes = modes
        } else {
            self.modes = [try c.decodeIfPresent(String.self, forKey: .mode) ?? "bus"]
        }
        minutesPerDay = try c.decode(Int.self, forKey: .minutesPerDay)
    }
    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(modes, forKey: .modes)
        try c.encode(minutesPerDay, forKey: .minutesPerDay)
    }
}

struct Essential: Codable, Identifiable, Hashable {
    var id: String
    var title: String
    var start: String
    var end: String
    var kind: String // meal | other
}

struct Preferences: Codable, Hashable {
    var timezone: String
    var dayStart: String
    var dayEnd: String
    var minBreakMinutes: Int
    var maxDailyPlannedMinutes: Int
    var commute: Commute?
    var essentials: [Essential]?
    var setupDone: Bool?

    static func makeDefault() -> Preferences {
        Preferences(
            timezone: TimeZone.current.identifier, dayStart: "08:00", dayEnd: "22:00", minBreakMinutes: 15, maxDailyPlannedMinutes: 480,
            commute: nil,
            essentials: [
                Essential(id: "ess-almoco", title: "Almoço", start: "12:30", end: "13:30", kind: "meal"),
                Essential(id: "ess-jantar", title: "Jantar", start: "19:30", end: "20:30", kind: "meal"),
            ],
            setupDone: nil)
    }
}

struct ScheduledItem: Codable, Identifiable, Hashable {
    var id: String
    var activityId: String
    var date: String
    var start: String
    var end: String
    var reasons: [String]
}

// ---- Planning output ----

struct Conflict: Codable, Hashable {
    var code: String
    var activityId: String
    var requestedMinutes: Int
    var scheduledMinutes: Int
    var availableInWindowMinutes: Int
    var deadline: String?
}

struct PlanWarning: Codable, Hashable {
    var code: String
    var detail: String
}

struct CommuteBlock: Codable, Hashable {
    var date: String
    var start: String
    var end: String
    var modes: [String]
    var overlappable: Bool?

    enum CodingKeys: String, CodingKey { case date, start, end, modes, mode, overlappable }
    // Plans stored by older versions have a single `mode`.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        date = try c.decode(String.self, forKey: .date)
        start = try c.decode(String.self, forKey: .start)
        end = try c.decode(String.self, forKey: .end)
        if let modes = try c.decodeIfPresent([String].self, forKey: .modes), !modes.isEmpty {
            self.modes = modes
        } else {
            self.modes = [try c.decodeIfPresent(String.self, forKey: .mode) ?? "bus"]
        }
        overlappable = try c.decodeIfPresent(Bool.self, forKey: .overlappable)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(date, forKey: .date)
        try c.encode(start, forKey: .start)
        try c.encode(end, forKey: .end)
        try c.encode(modes, forKey: .modes)
        try c.encodeIfPresent(overlappable, forKey: .overlappable)
    }
}

struct EssentialBlock: Codable, Hashable {
    var date: String
    var start: String
    var end: String
    var title: String
    var kind: String
}

struct PlanChanges: Codable, Hashable {
    struct Move: Codable, Hashable { var from: ScheduledItem; var to: ScheduledItem }
    var kept: Int
    var moved: [Move]
    var dropped: [ScheduledItem]
    var added: [ScheduledItem]
}

struct PlanningResult: Codable, Hashable {
    var engineVersion: String
    var status: String // fully_feasible | partially_feasible | infeasible
    var requestedMinutes: Int
    var scheduledMinutes: Int
    var unscheduledMinutes: Int
    var scheduledItems: [ScheduledItem]
    var conflicts: [Conflict]
    var warnings: [PlanWarning]
    var availableMinutesByDay: [String: Int]
    var freeMinutesByDay: [String: Int]?
    var commuteBlocks: [CommuteBlock]?
    var essentialBlocks: [EssentialBlock]?
    var changes: PlanChanges?
}

struct Plan: Codable, Identifiable, Hashable {
    var id: String
    var weekStart: String
    var status: String // proposed | accepted | modified
    var version: Int
    var createdAt: String
    var result: PlanningResult
}

// ---- Request bodies ----

struct PlanningInput: Codable {
    var today: String
    var weekStart: String
    var events: [CalendarEvent]
    var activities: [Activity]
    var goals: [Goal]
    var preferences: Preferences
    var previousItems: [ScheduledItem]?
    var nowMinutes: Int?
}

struct User: Codable, Hashable {
    var id: String
    var email: String
}

/// What the server stores per user. `plans` and `chat` stay opaque (see JSONValue).
struct UserData: Codable {
    var events: [CalendarEvent]
    var activities: [Activity]
    var goals: [Goal]
    var preferences: Preferences
    var plans: [String: JSONValue]
    var chat: [JSONValue]

    static func empty() -> UserData {
        UserData(events: [], activities: [], goals: [], preferences: .makeDefault(), plans: [:], chat: [])
    }
}

// ---- Assistant ----

enum ProposedAction: Codable, Hashable {
    case createActivity(summary: String, payload: Activity)
    case createGoal(summary: String, payload: Goal)
    case createEvent(summary: String, payload: CalendarEvent)

    enum CodingKeys: String, CodingKey { case type, summary, payload }

    var summary: String {
        switch self {
        case .createActivity(let s, _), .createGoal(let s, _), .createEvent(let s, _): s
        }
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let summary = try c.decode(String.self, forKey: .summary)
        switch try c.decode(String.self, forKey: .type) {
        case "create_activity": self = .createActivity(summary: summary, payload: try c.decode(Activity.self, forKey: .payload))
        case "create_goal": self = .createGoal(summary: summary, payload: try c.decode(Goal.self, forKey: .payload))
        case "create_event": self = .createEvent(summary: summary, payload: try c.decode(CalendarEvent.self, forKey: .payload))
        case let other:
            throw DecodingError.dataCorruptedError(forKey: .type, in: c, debugDescription: "Unknown proposal type \(other)")
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(summary, forKey: .summary)
        switch self {
        case .createActivity(_, let p): try c.encode("create_activity", forKey: .type); try c.encode(p, forKey: .payload)
        case .createGoal(_, let p): try c.encode("create_goal", forKey: .type); try c.encode(p, forKey: .payload)
        case .createEvent(_, let p): try c.encode("create_event", forKey: .type); try c.encode(p, forKey: .payload)
        }
    }
}

struct AssistantReply: Codable {
    var reply: String
    var proposals: [ProposedAction]
    var plan: PlanningResult?
    var planAdoptable: Bool?
    var planWeekStart: String?
}

struct AssistantRequest: Codable {
    var message: String
    var state: PlanningInput
    var currentItems: [ScheduledItem]?
}

/// Same shape the web app stores in `chat`, so a conversation started on one client shows on the other.
struct ChatMessage: Codable, Identifiable, Hashable {
    var id: String
    var role: String // user | assistant
    var text: String
    var proposals: [ProposedAction]?
    var plan: PlanningResult?
    var planAdoptable: Bool?
    var handled: Bool?
    var planWeekStart: String?
    var planDecision: String? // approved | rejected
}
