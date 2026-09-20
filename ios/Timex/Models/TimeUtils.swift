import Foundation

/// Wall-clock helpers matching shared/time.ts: dates are "YYYY-MM-DD", times "HH:mm", weekdays Monday = 0.
/// Pure formatting/arithmetic on strings; nothing here decides what gets scheduled.
enum TimeUtils {
    private static let utc: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(secondsFromGMT: 0)!
        return c
    }()

    private static func date(_ s: String) -> Date {
        let p = s.split(separator: "-").compactMap { Int($0) }
        guard p.count == 3, let d = utc.date(from: DateComponents(year: p[0], month: p[1], day: p[2])) else { return Date(timeIntervalSince1970: 0) }
        return d
    }

    private static func string(_ d: Date) -> String {
        let c = utc.dateComponents([.year, .month, .day], from: d)
        return String(format: "%04d-%02d-%02d", c.year ?? 1970, c.month ?? 1, c.day ?? 1)
    }

    static func addDays(_ s: String, _ n: Int) -> String {
        string(utc.date(byAdding: .day, value: n, to: date(s)) ?? date(s))
    }

    static func daysBetween(_ from: String, _ to: String) -> Int {
        utc.dateComponents([.day], from: date(from), to: date(to)).day ?? 0
    }

    /// Monday = 0 … Sunday = 6
    static func weekday(_ s: String) -> Int { (utc.component(.weekday, from: date(s)) + 5) % 7 }

    static func startOfWeek(_ s: String) -> String { addDays(s, -weekday(s)) }

    static func dayNumber(_ s: String) -> Int { Int(s.suffix(2)) ?? 0 }

    static func today() -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: Date())
        return String(format: "%04d-%02d-%02d", c.year ?? 1970, c.month ?? 1, c.day ?? 1)
    }

    static func nowMinutes() -> Int {
        let c = Calendar.current.dateComponents([.hour, .minute], from: Date())
        return (c.hour ?? 0) * 60 + (c.minute ?? 0)
    }

    static func minutes(_ hhmm: String) -> Int {
        let p = hhmm.split(separator: ":").compactMap { Int($0) }
        return p.count == 2 ? p[0] * 60 + p[1] : 0
    }

    static func hhmm(_ minutes: Int) -> String { String(format: "%02d:%02d", minutes / 60, minutes % 60) }

    static func duration(_ minutes: Int) -> String {
        let h = minutes / 60, m = minutes % 60
        if h == 0 { return "\(m) min" }
        return m == 0 ? "\(h)h" : String(format: "%dh%02d", h, m)
    }

    /// Whether a (possibly weekly) event takes place on `date`. Same rule as shared/events.ts.
    static func occurs(_ e: CalendarEvent, on date: String) -> Bool {
        e.date == date || (e.weekly && date > e.date && weekday(date) == weekday(e.date))
    }

    static let weekdaysShort = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]
    static let weekdaysLong = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]

    /// A `Date` today at the given HH:mm, for time pickers.
    static func clock(_ hhmm: String) -> Date {
        let m = minutes(hhmm)
        return Calendar.current.date(bySettingHour: m / 60, minute: m % 60, second: 0, of: Date()) ?? Date()
    }

    static func hhmm(from date: Date) -> String {
        let c = Calendar.current.dateComponents([.hour, .minute], from: date)
        return String(format: "%02d:%02d", c.hour ?? 0, c.minute ?? 0)
    }

    /// Same helper as shared/sessions.ts: "X hours a week" -> sessions x length (multiple of 15 min).
    static func splitWeeklyMinutes(_ total: Int, preferredSession: Int = 90) -> (sessions: Int, minutes: Int) {
        let t = max(15, Int((Double(total) / 15).rounded()) * 15)
        let sessions = min(14, max(1, Int((Double(t) / Double(max(15, preferredSession))).rounded())))
        let minutes = min(480, max(15, Int((Double(t) / Double(sessions) / 15).rounded()) * 15))
        return (sessions, minutes)
    }
}

/// Presentation-only text for the engine's structured reason and conflict codes (mirrors shared/reasons.ts).
enum Reasons {
    static let text: [String: String] = [
        "HIGH_PRIORITY": "Tem prioridade alta.",
        "PREFERRED_TIME": "Cai dentro do teu horário preferido.",
        "PREFERRED_DAY": "É num dos teus dias preferidos.",
        "BEFORE_DEADLINE": "Fica antes do prazo, com margem.",
        "SPREAD_OUT": "Distribui as sessões pela semana.",
        "LIGHT_DAY": "É um dia com pouca carga.",
        "DURING_TRAVEL": "Aproveita um tempo em que dá para fazer outras coisas (por exemplo, viagem).",
        "SPLIT_OVER_DAY": "Dividida em blocos, espaçados ao longo do dia.",
        "SHORTENED": "Foi encurtada porque não havia um intervalo maior.",
    ]
    static let conflict: [String: String] = [
        "INSUFFICIENT_AVAILABLE_TIME": "Não há tempo livre suficiente",
        "DEADLINE_UNACHIEVABLE": "O prazo não permite encaixar tudo",
    ]
}
