import SwiftUI

struct TodayView: View {
    @Environment(AppStore.self) private var store
    @State private var freeToday: Int?

    private struct Row: Identifiable {
        let id: String
        let start: String
        let end: String
        let title: String
        let color: Color
        let fixed: Bool
    }

    var body: some View {
        let today = TimeUtils.today()
        let week = TimeUtils.startOfWeek(today)
        let plan = store.plan(for: week)
        let items = (plan?.result.scheduledItems ?? []).filter { $0.date == today }
        let planned = items.reduce(0) { $0 + TimeUtils.minutes($1.end) - TimeUtils.minutes($1.start) }
        let rows = rows(today: today, plan: plan, items: items)

        ScrollView {
            VStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Diz o que precisas de fazer.").font(.title2.bold())
                    Text("Eu encaixo tudo no teu tempo livre — de forma realista.").foregroundStyle(.secondary)
                    Button {
                        Task { await store.generate(weekStart: week) }
                    } label: {
                        Label(store.busy ? "A gerar…" : (plan == nil ? "Planear a minha semana" : "Replanear a semana"), systemImage: "sparkles")
                    }
                    .buttonStyle(.glassProminent)
                    .tint(Theme.accent)
                    .disabled(store.busy)
                }
                .glassCard(cornerRadius: 30)

                GlassEffectContainer(spacing: 12) {
                    HStack(spacing: 12) {
                        stat("Livre hoje", freeToday.map(TimeUtils.duration) ?? "—", Theme.green)
                        stat("Planeado", TimeUtils.duration(planned), Theme.accent)
                        stat("Semana", plan.map { p in
                            p.result.requestedMinutes == 0 ? "100%" : "\(Int((Double(p.result.scheduledMinutes) / Double(p.result.requestedMinutes) * 100).rounded()))%"
                        } ?? "—", Theme.amber)
                    }
                }

                VStack(alignment: .leading, spacing: 12) {
                    Text("Hoje").font(.headline)
                    if rows.isEmpty { Text("Dia livre. Aproveita.").foregroundStyle(.secondary) }
                    ForEach(rows) { row in
                        HStack(spacing: 12) {
                            Circle().fill(row.color).frame(width: 10, height: 10)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(row.title).font(.subheadline.weight(.semibold))
                                Text("\(row.start)–\(row.end) · \(row.fixed ? "Fixo" : "Planeado")").font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
                .glassCard()
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 24)
        }
        .appBackground()
        .navigationTitle(greeting())
        .navigationSubtitle("\(TimeUtils.weekdaysLong[TimeUtils.weekday(today)]), \(today)")
        .task(id: "\(store.data.events.count)-\(store.data.preferences.hashValue)-\(plan?.version ?? 0)") { freeToday = await store.freeToday() }
        .task { await store.ensurePlans(for: [week]) }
    }

    private func stat(_ title: String, _ value: String, _ color: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.caption).foregroundStyle(.secondary)
            Text(value).font(.title2.bold()).foregroundStyle(color).minimumScaleFactor(0.7).lineLimit(1)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassEffect(.regular, in: .rect(cornerRadius: 22))
    }

    private func greeting() -> String {
        let h = Calendar.current.component(.hour, from: Date())
        return h < 12 ? "Bom dia" : h < 20 ? "Boa tarde" : "Boa noite"
    }

    private func rows(today: String, plan: Plan?, items: [ScheduledItem]) -> [Row] {
        var out = store.data.events.filter { TimeUtils.occurs($0, on: today) }
            .map { Row(id: "e-\($0.id)", start: $0.start, end: $0.end, title: $0.title, color: .gray, fixed: true) }
        for (n, b) in (plan?.result.commuteBlocks ?? []).enumerated() where b.date == today {
            out.append(Row(id: "c-\(n)", start: b.start, end: b.end, title: "Transporte · \(transportText(b.modes))", color: Theme.amber, fixed: true))
        }
        for (n, b) in (plan?.result.essentialBlocks ?? []).enumerated() where b.date == today {
            out.append(Row(id: "s-\(n)", start: b.start, end: b.end, title: b.title, color: Theme.green, fixed: true))
        }
        for i in items {
            out.append(Row(id: "p-\(i.id)", start: i.start, end: i.end, title: store.activityName(i.activityId), color: Theme.color(for: i.activityId), fixed: false))
        }
        return out.sorted { $0.start < $1.start }
    }
}
