import SwiftUI

enum CalendarMode: String, CaseIterable, Hashable {
    case day, threeDays, week, agenda

    var label: String {
        switch self {
        case .day: "Dia"
        case .threeDays: "3 dias"
        case .week: "Semana"
        case .agenda: "Agenda"
        }
    }

    /// The window rolls with the anchor and the anchor is always the second day, so yesterday and the days ahead are
    /// visible (same rule as the web calendar). It is not tied to Monday-Sunday.
    func dates(anchor: String) -> [String] {
        switch self {
        case .day: [anchor]
        case .threeDays: (0..<3).map { TimeUtils.addDays(anchor, $0 - 1) }
        case .week, .agenda: (0..<7).map { TimeUtils.addDays(anchor, $0 - 1) }
        }
    }

    var stepDays: Int {
        switch self {
        case .day: 1
        case .threeDays: 3
        case .week, .agenda: 7
        }
    }
}

struct CalendarView: View {
    @Environment(AppStore.self) private var store
    @AppStorage("timex.calendarMode") private var modeRaw = CalendarMode.day.rawValue
    @State private var anchor = TimeUtils.today()
    @State private var selected: ScheduledItem?

    private var mode: Binding<CalendarMode> {
        Binding(get: { CalendarMode(rawValue: modeRaw) ?? .day }, set: { modeRaw = $0.rawValue })
    }

    var body: some View {
        let dates = mode.wrappedValue.dates(anchor: anchor)
        let weeks = Array(Set(dates.map(TimeUtils.startOfWeek))).sorted()
        let planWeek = TimeUtils.startOfWeek(anchor)

        ScrollView {
            VStack(spacing: 14) {
                GlassPicker(options: CalendarMode.allCases, label: { $0.label }, selection: mode)

                if mode.wrappedValue == .agenda {
                    AgendaList(dates: dates, onItem: { selected = $0 })
                } else {
                    TimelineGrid(dates: dates, onItem: { selected = $0 })
                }

                Legend()

                if let plan = store.plan(for: planWeek) {
                    PlanCard(plan: plan)
                } else {
                    Text("Ainda não há plano para esta semana. Adiciona atividades para o motor as encaixar no tempo livre.")
                        .foregroundStyle(.secondary)
                        .glassCard()
                }
                if let error = store.errorMessage {
                    Text(error).font(.footnote).foregroundStyle(.red)
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 24)
        }
        .appBackground()
        .navigationTitle(monthName(dates.first ?? anchor))
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button { move(-1) } label: { Image(systemName: "chevron.left") }.accessibilityLabel("Anterior")
                Button("Hoje") { anchor = TimeUtils.today() }
                Button { move(1) } label: { Image(systemName: "chevron.right") }.accessibilityLabel("Seguinte")
            }
        }
        .task(id: weeks.joined(separator: ",")) { await store.ensurePlans(for: weeks) }
        .sheet(item: $selected) { item in
            ItemSheet(item: item).presentationDetents([.medium])
        }
    }

    private func move(_ delta: Int) { anchor = TimeUtils.addDays(anchor, delta * mode.wrappedValue.stepDays) }

    private func monthName(_ date: String) -> String {
        let months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
        let p = date.split(separator: "-").compactMap { Int($0) }
        return p.count == 3 ? "\(months[p[1] - 1]) \(p[0])" : "Calendário"
    }
}

// MARK: - Shared helpers

extension AppStore {
    func plan(forDate date: String) -> Plan? { plan(for: TimeUtils.startOfWeek(date)) }

    /// Free time left on a day; nil when there is nothing to say (no plan yet, or the day is over).
    func freeLabel(for date: String) -> String? {
        guard date >= TimeUtils.today(), let plan = plan(forDate: date) else { return nil }
        guard let free = plan.result.freeMinutesByDay?[date] ?? plan.result.availableMinutesByDay[date] else { return nil }
        return "livre \(TimeUtils.duration(free))"
    }

    func activityName(_ id: String) -> String { data.activities.first { $0.id == id }?.name ?? "Atividade" }
}

let transportLabels = ["walk": "A pé", "bike": "Bicicleta", "bus": "Autocarro", "train": "Metro / comboio", "car": "Carro"]
func transportText(_ modes: [String]) -> String { modes.map { transportLabels[$0] ?? $0 }.joined(separator: " + ") }

// MARK: - Timeline (day, 3 days, week)

private struct Block: Identifiable {
    enum Kind { case fixed, travel, essential, planned, overlapped }
    let id: String
    let start: Int
    let end: Int
    let title: String
    let kind: Kind
    var color: Color = .gray
    var item: ScheduledItem?
}

struct TimelineGrid: View {
    @Environment(AppStore.self) private var store
    let dates: [String]
    let onItem: (ScheduledItem) -> Void

    private let hourHeight: CGFloat = 52
    private let axisWidth: CGFloat = 38

    var body: some View {
        let prefs = store.data.preferences
        let wakeStart = TimeUtils.minutes(prefs.dayStart)
        let wakeEnd = TimeUtils.minutes(prefs.dayEnd) > wakeStart ? TimeUtils.minutes(prefs.dayEnd) : 1440
        let startHour = wakeStart / 60
        let endHour = (wakeEnd + 59) / 60
        let hours = max(1, endHour - startHour)
        let dense = dates.count > 3

        VStack(spacing: 0) {
            HStack(spacing: 0) {
                Color.clear.frame(width: axisWidth)
                ForEach(dates, id: \.self) { date in
                    VStack(spacing: 2) {
                        Text(TimeUtils.weekdaysShort[TimeUtils.weekday(date)]).font(.caption2).foregroundStyle(.secondary)
                        Text("\(TimeUtils.dayNumber(date))")
                            .font(.headline)
                            .frame(width: 30, height: 30)
                            .glassEffect(date == TimeUtils.today() ? .regular.tint(Theme.accent) : .clear, in: .circle)
                        if !dense, let free = store.freeLabel(for: date) {
                            Text(free).font(.caption2.weight(.semibold)).foregroundStyle(Theme.green)
                        }
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .padding(.vertical, 10)

            HStack(alignment: .top, spacing: 0) {
                ZStack(alignment: .topTrailing) {
                    ForEach(1..<max(2, hours), id: \.self) { i in
                        Text(String(format: "%02d:00", startHour + i))
                            .font(.system(size: 10))
                            .foregroundStyle(.secondary)
                            .offset(x: -4, y: CGFloat(i) * hourHeight - 7)
                    }
                }
                .frame(width: axisWidth, height: CGFloat(hours) * hourHeight, alignment: .topTrailing)

                ForEach(dates, id: \.self) { date in
                    DayColumn(date: date, startMin: startHour * 60, hours: hours, hourHeight: hourHeight, dense: dense, onItem: onItem)
                }
            }
        }
        .padding(.horizontal, 6)
        .glassEffect(.regular, in: .rect(cornerRadius: 26))
    }
}

private struct DayColumn: View {
    @Environment(AppStore.self) private var store
    let date: String
    let startMin: Int
    let hours: Int
    let hourHeight: CGFloat
    let dense: Bool
    let onItem: (ScheduledItem) -> Void

    var body: some View {
        let blocks = makeBlocks()
        GeometryReader { geo in
            ZStack(alignment: .topLeading) {
                ForEach(0..<hours, id: \.self) { i in
                    Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5).offset(y: CGFloat(i) * hourHeight)
                }
                ForEach(blocks) { block in
                    let y = CGFloat(max(block.start, startMin) - startMin) / 60 * hourHeight
                    let h = max(14, CGFloat(block.end - max(block.start, startMin)) / 60 * hourHeight - 2)
                    let width = block.kind == .overlapped ? geo.size.width * 0.58 : geo.size.width - 2
                    BlockView(block: block, dense: dense)
                        .frame(width: width, height: h, alignment: .topLeading)
                        .offset(x: block.kind == .overlapped ? geo.size.width * 0.42 - 1 : 1, y: y)
                        .onTapGesture { if let item = block.item { onItem(item) } }
                }
            }
        }
        .frame(height: CGFloat(hours) * hourHeight)
        .overlay(alignment: .leading) { Rectangle().fill(.white.opacity(0.08)).frame(width: 0.5) }
        .opacity(date < TimeUtils.today() ? 0.55 : 1)
    }

    private func makeBlocks() -> [Block] {
        var out: [Block] = []
        for e in store.data.events where TimeUtils.occurs(e, on: date) {
            out.append(Block(id: "e-\(e.id)", start: TimeUtils.minutes(e.start), end: TimeUtils.minutes(e.end), title: e.title, kind: e.isTravel ? .travel : .fixed))
        }
        let plan = store.plan(forDate: date)
        for (n, b) in (plan?.result.commuteBlocks ?? []).enumerated() where b.date == date {
            out.append(Block(id: "c-\(n)", start: TimeUtils.minutes(b.start), end: TimeUtils.minutes(b.end), title: transportText(b.modes), kind: .travel))
        }
        for (n, b) in (plan?.result.essentialBlocks ?? []).enumerated() where b.date == date {
            out.append(Block(id: "s-\(n)", start: TimeUtils.minutes(b.start), end: TimeUtils.minutes(b.end), title: b.title, kind: .essential))
        }
        for i in (plan?.result.scheduledItems ?? []) where i.date == date {
            out.append(Block(id: "p-\(i.id)", start: TimeUtils.minutes(i.start), end: TimeUtils.minutes(i.end), title: store.activityName(i.activityId),
                             kind: i.reasons.contains("DURING_TRAVEL") ? .overlapped : .planned, color: Theme.color(for: i.activityId), item: i))
        }
        // planned items last so they are drawn on top of whatever they share time with
        return out.sorted { rank($0.kind) < rank($1.kind) }
    }

    private func rank(_ k: Block.Kind) -> Int {
        switch k {
        case .fixed: 0
        case .travel: 1
        case .essential: 2
        case .planned: 3
        case .overlapped: 4
        }
    }
}

private struct BlockView: View {
    let block: Block
    let dense: Bool

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 10, style: .continuous)
        VStack(alignment: .leading, spacing: 1) {
            Text(block.title).font(.system(size: dense ? 9 : 12, weight: .semibold)).lineLimit(dense ? 2 : 1)
            if !dense { Text("\(TimeUtils.hhmm(block.start))–\(TimeUtils.hhmm(block.end))").font(.system(size: 10)).opacity(0.85) }
        }
        .padding(.horizontal, dense ? 3 : 6)
        .padding(.vertical, 3)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .foregroundStyle(foreground)
        .modifier(BlockSurface(kind: block.kind, color: block.color, shape: shape))
        .contentShape(shape)
    }

    private var foreground: Color {
        switch block.kind {
        case .travel: Theme.amber
        case .essential: Theme.green
        default: .white
        }
    }
}

/// Fixed commitments and planned sessions are tinted glass; transport and essentials are hollow dashed outlines so they
/// read as "time reserved" rather than as things to do.
private struct BlockSurface: ViewModifier {
    let kind: Block.Kind
    let color: Color
    let shape: RoundedRectangle

    func body(content: Content) -> some View {
        switch kind {
        case .fixed:
            content.glassEffect(.regular.tint(.gray.opacity(0.35)), in: shape)
        case .planned, .overlapped:
            content.glassEffect(.regular.tint(color.opacity(0.75)).interactive(), in: shape)
        case .travel:
            content.overlay(shape.strokeBorder(Theme.amber.opacity(0.8), style: StrokeStyle(lineWidth: 1, dash: [4, 3])))
        case .essential:
            content.overlay(shape.strokeBorder(Theme.green.opacity(0.8), style: StrokeStyle(lineWidth: 1, dash: [4, 3])))
        }
    }
}

// MARK: - Agenda

struct AgendaList: View {
    @Environment(AppStore.self) private var store
    let dates: [String]
    let onItem: (ScheduledItem) -> Void

    private struct Row: Identifiable {
        let id: String
        let start: String
        let end: String
        let title: String
        let color: Color
        var item: ScheduledItem?
    }

    var body: some View {
        VStack(spacing: 12) {
            ForEach(dates, id: \.self) { date in
                let rows = rows(for: date)
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Text("\(TimeUtils.weekdaysLong[TimeUtils.weekday(date)]) \(TimeUtils.dayNumber(date))\(date == TimeUtils.today() ? " · hoje" : "")")
                            .font(.headline)
                        Spacer()
                        if let free = store.freeLabel(for: date) { GlassChip(text: free, tint: Theme.green) }
                    }
                    if rows.isEmpty {
                        Text(date < TimeUtils.today() ? "Sem registos." : "Dia livre.").font(.subheadline).foregroundStyle(.secondary)
                    }
                    ForEach(rows) { row in
                        Button { if let item = row.item { onItem(item) } } label: {
                            HStack(spacing: 12) {
                                Circle().fill(row.color).frame(width: 10, height: 10)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(row.title).font(.subheadline.weight(.semibold))
                                    Text("\(row.start)–\(row.end)").font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
                .glassCard()
                .opacity(date < TimeUtils.today() ? 0.6 : 1)
            }
        }
    }

    private func rows(for date: String) -> [Row] {
        var out: [Row] = store.data.events.filter { TimeUtils.occurs($0, on: date) }
            .map { Row(id: "e-\($0.id)", start: $0.start, end: $0.end, title: $0.title, color: $0.isTravel ? Theme.amber : .gray) }
        let plan = store.plan(forDate: date)
        for (n, b) in (plan?.result.commuteBlocks ?? []).enumerated() where b.date == date {
            out.append(Row(id: "c-\(n)", start: b.start, end: b.end, title: "Transporte · \(transportText(b.modes))", color: Theme.amber))
        }
        for (n, b) in (plan?.result.essentialBlocks ?? []).enumerated() where b.date == date {
            out.append(Row(id: "s-\(n)", start: b.start, end: b.end, title: b.title, color: Theme.green))
        }
        for i in (plan?.result.scheduledItems ?? []) where i.date == date {
            out.append(Row(id: "p-\(i.id)", start: i.start, end: i.end, title: store.activityName(i.activityId), color: Theme.color(for: i.activityId), item: i))
        }
        return out.sorted { $0.start < $1.start }
    }
}

// MARK: - Legend, plan card, item sheet

private struct Legend: View {
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 14) {
                entry(Theme.color(for: "x"), "Atividade planeada", dashed: false)
                entry(.gray, "Compromisso fixo", dashed: false)
                entry(Theme.amber, "Transporte / tempo difícil", dashed: true)
                entry(Theme.green, "Refeições e essenciais", dashed: true)
            }
            .font(.caption)
            .foregroundStyle(.secondary)
            .padding(.horizontal, 4)
        }
    }

    private func entry(_ color: Color, _ text: String, dashed: Bool) -> some View {
        HStack(spacing: 6) {
            RoundedRectangle(cornerRadius: 3)
                .strokeBorder(color, style: StrokeStyle(lineWidth: 1.2, dash: dashed ? [3, 2] : []))
                .background(RoundedRectangle(cornerRadius: 3).fill(dashed ? Color.clear : color.opacity(0.8)))
                .frame(width: 12, height: 12)
            Text(text)
        }
    }
}

struct PlanCard: View {
    @Environment(AppStore.self) private var store
    let plan: Plan

    private let feasibility: [String: (String, Color)] = [
        "fully_feasible": ("Tudo cabe", Theme.green), "partially_feasible": ("Cabe parcialmente", Theme.amber), "infeasible": ("Não cabe", .red),
    ]
    private let status: [String: (String, Color)] = [
        "proposed": ("Proposto", Theme.amber), "accepted": ("Aceite", Theme.green), "modified": ("Modificado", Theme.accent),
    ]

    var body: some View {
        let r = plan.result
        let pct = r.requestedMinutes == 0 ? 1.0 : min(1.0, Double(r.scheduledMinutes) / Double(r.requestedMinutes))
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Plano da semana").font(.headline)
                Spacer()
                if let s = status[plan.status] { GlassChip(text: "\(s.0) · v\(plan.version)", tint: s.1) }
            }
            if let f = feasibility[r.status] { GlassChip(text: f.0, tint: f.1) }
            Text("\(TimeUtils.duration(r.scheduledMinutes)) planeadas de \(TimeUtils.duration(r.requestedMinutes)) pedidas")
                .font(.subheadline).foregroundStyle(.secondary)
            ProgressView(value: pct).tint(Theme.accent)

            ForEach(Array(r.conflicts.enumerated()), id: \.offset) { _, c in
                VStack(alignment: .leading, spacing: 4) {
                    Text("\(Reasons.conflict[c.code] ?? c.code): \(store.activityName(c.activityId)).").font(.subheadline.weight(.semibold))
                    Text("Precisa de \(TimeUtils.duration(c.requestedMinutes)), só há \(TimeUtils.duration(c.scheduledMinutes)) encaixadas (\(TimeUtils.duration(c.availableInWindowMinutes)) livres nos dias que restam).")
                        .font(.footnote).foregroundStyle(.secondary)
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .glassEffect(.regular.tint(Theme.amber.opacity(0.25)), in: .rect(cornerRadius: 16))
            }
            ForEach(Array(r.warnings.enumerated()), id: \.offset) { _, w in
                Text("Eventos sobrepostos: \(w.detail)").font(.footnote).foregroundStyle(Theme.amber)
            }

            GlassEffectContainer(spacing: 10) {
                HStack(spacing: 10) {
                    if plan.status != "accepted" {
                        Button("Aceitar plano") { store.acceptPlan(weekStart: plan.weekStart) }
                            .buttonStyle(.glassProminent).tint(Theme.accent)
                    }
                    Button(store.busy ? "A gerar…" : "Gerar de novo") { Task { await store.generate(weekStart: plan.weekStart) } }
                        .buttonStyle(.glass)
                        .disabled(store.busy)
                }
            }
        }
        .glassCard()
    }
}

struct ItemSheet: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let item: ScheduledItem

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 14) {
                Text("\(TimeUtils.weekdaysLong[TimeUtils.weekday(item.date)]), \(item.date) · \(item.start)–\(item.end)").foregroundStyle(.secondary)
                Text("Porque está aqui").font(.headline)
                if item.reasons.isEmpty { Text("• Foi o melhor intervalo livre disponível.") }
                ForEach(item.reasons, id: \.self) { Text("• \(Reasons.text[$0] ?? $0)") }
                Spacer()
                Button("Remover do plano", role: .destructive) {
                    store.removeItem(weekStart: TimeUtils.startOfWeek(item.date), itemId: item.id)
                    dismiss()
                }
                .buttonStyle(.glass)
                .tint(.red)
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .navigationTitle(store.activityName(item.activityId))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Fechar") { dismiss() } } }
        }
    }
}
