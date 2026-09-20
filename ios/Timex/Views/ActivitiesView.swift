import SwiftUI

struct ActivitiesView: View {
    @Environment(AppStore.self) private var store
    @State private var editing: ActivityEdit?

    /// `nil` activity = creating a new one.
    struct ActivityEdit: Identifiable {
        let id = UUID()
        let activity: Activity?
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                if store.data.activities.isEmpty {
                    Text("Sem atividades. Cria uma ou pede ao assistente.").foregroundStyle(.secondary).glassCard()
                }
                ForEach(store.data.activities) { activity in
                    Button { editing = ActivityEdit(activity: activity) } label: { row(activity) }.buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 24)
        }
        .appBackground()
        .navigationTitle("Atividades")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { editing = ActivityEdit(activity: nil) } label: { Image(systemName: "plus") }.accessibilityLabel("Nova atividade")
            }
        }
        .sheet(item: $editing) { edit in
            ActivityForm(existing: edit.activity)
        }
    }

    private func row(_ a: Activity) -> some View {
        HStack(spacing: 12) {
            Circle().fill(Theme.color(for: a.id)).frame(width: 12, height: 12)
            VStack(alignment: .leading, spacing: 3) {
                Text(a.name).font(.headline)
                Text(summary(a)).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            GlassChip(text: a.priority.label, tint: a.priority == .high || a.priority == .critical ? .red : (a.priority == .medium ? Theme.accent : nil))
        }
        .glassCard(cornerRadius: 22)
    }

    private func summary(_ a: Activity) -> String {
        var parts = ["\(a.sessionsPerWeek)× \(TimeUtils.duration(a.sessionMinutes)) por semana"]
        if let s = a.preferredStart, let e = a.preferredEnd { parts.append("\(a.onlyPreferred == true ? "só " : "")\(s)–\(e)") }
        if !a.preferredDays.isEmpty { parts.append(a.preferredDays.map { TimeUtils.weekdaysShort[$0] }.joined(separator: ", ")) }
        if a.splitMinutes != nil { parts.append("em blocos") }
        if a.canOverlap == true { parts.append("em simultâneo" + ((a.overlapWith?.isEmpty == false) ? " (\(a.overlapWith!.joined(separator: ", ")))" : "")) }
        return parts.joined(separator: " · ")
    }
}

struct ActivityForm: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let existing: Activity?

    @State private var name = ""
    @State private var weeklyHours = 3.0
    @State private var sessionMinutes = 60
    @State private var priority = Priority.medium
    @State private var days: Set<Int> = []
    @State private var useWindow = false
    @State private var windowStart = TimeUtils.clock("17:00")
    @State private var windowEnd = TimeUtils.clock("21:00")
    @State private var onlyPreferred = false
    @State private var splitOn = false
    @State private var splitMinutes = 30
    @State private var canOverlap = false
    @State private var overlapWith: Set<String> = []
    @State private var maxOverlapHours = 0.0
    @State private var loaded = false

    private var sessions: (sessions: Int, minutes: Int) { TimeUtils.splitWeeklyMinutes(Int(weeklyHours * 60), preferredSession: sessionMinutes) }
    private var windowValid: Bool { !useWindow || TimeUtils.hhmm(from: windowEnd) > TimeUtils.hhmm(from: windowStart) }
    private var splitValid: Bool { !splitOn || (splitMinutes >= 15 && splitMinutes < sessions.minutes) }
    private var valid: Bool { !name.trimmingCharacters(in: .whitespaces).isEmpty && windowValid && splitValid }

    /// Titles of the user's events that allow other things, plus automatic bus/train travel.
    private var overlapSources: [String] {
        var seen = Set<String>()
        return (store.data.events.filter { $0.canOverlap == true }.map(\.title) + ["Transporte"]).filter { seen.insert($0).inserted }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Atividade") {
                    TextField("Ginásio, Estudar…", text: $name)
                    Stepper(value: $weeklyHours, in: 0.25...40, step: 0.25) { Text("\(weeklyHours.formatted()) h por semana") }
                    Stepper(value: $sessionMinutes, in: 15...480, step: 15) { Text("Sessões de \(TimeUtils.duration(sessionMinutes))") }
                    Text("Fica em \(sessions.sessions) \(sessions.sessions == 1 ? "sessão" : "sessões") de \(TimeUtils.duration(sessions.minutes))")
                        .font(.footnote).foregroundStyle(.secondary)
                    Picker("Prioridade", selection: $priority) { ForEach(Priority.allCases) { Text($0.label).tag($0) } }
                }

                Section("Dias preferidos") {
                    GlassEffectContainer(spacing: 6) {
                        HStack(spacing: 6) {
                            ForEach(0..<7, id: \.self) { d in
                                Button(TimeUtils.weekdaysShort[d]) { if !days.insert(d).inserted { days.remove(d) } }
                                    .font(.caption.weight(.semibold))
                                    .buttonStyle(.plain)
                                    .padding(.vertical, 8)
                                    .frame(maxWidth: .infinity)
                                    .glassEffect(days.contains(d) ? .regular.tint(Theme.accent).interactive() : .regular.interactive(), in: .capsule)
                            }
                        }
                    }
                    .listRowBackground(Color.clear)
                }

                Section("Horas preferidas") {
                    SettingToggle(title: "Definir horário", isOn: $useWindow)
                    if useWindow {
                        DatePicker("A partir das", selection: $windowStart, displayedComponents: .hourAndMinute)
                        DatePicker("Até às", selection: $windowEnd, displayedComponents: .hourAndMinute)
                        SettingToggle(title: "Só dentro deste horário", isOn: $onlyPreferred)
                        if !windowValid { Text("O fim tem de ser depois do início.").font(.footnote).foregroundStyle(.red) }
                    }
                }

                Section("Como pode ser feita") {
                    SettingToggle(title: "Dividir em blocos ao longo do dia", isOn: $splitOn)
                    if splitOn {
                        Stepper(value: $splitMinutes, in: 15...240, step: 15) { Text("Blocos de \(TimeUtils.duration(splitMinutes))") }
                        if !splitValid { Text("O bloco tem de ser mais curto que a sessão (\(TimeUtils.duration(sessions.minutes))).").font(.footnote).foregroundStyle(.red) }
                    }
                    SettingToggle(title: "Pode fazer-se durante viagens ou aulas", isOn: $canOverlap)
                    if canOverlap {
                        Text("Onde (nenhum marcado = qualquer tempo que o permita)").font(.footnote).foregroundStyle(.secondary)
                        ForEach(overlapSources, id: \.self) { source in
                            Toggle(source, isOn: Binding(get: { overlapWith.contains(source) }, set: { on in
                                if on { overlapWith.insert(source) } else { overlapWith.remove(source) }
                            })).tint(Theme.accent)
                        }
                        Stepper(value: $maxOverlapHours, in: 0...40, step: 0.5) {
                            Text(maxOverlapHours == 0 ? "Sem limite semanal nestes tempos" : "No máximo \(maxOverlapHours.formatted()) h por semana")
                        }
                    }
                }

                if let existing {
                    Section {
                        Button("Apagar atividade", role: .destructive) {
                            store.deleteActivity(id: existing.id)
                            dismiss()
                        }
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background { AppBackground() }
            .navigationTitle(existing == nil ? "Nova atividade" : "Editar atividade")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Guardar") { save() }.disabled(!valid) }
            }
            .onAppear(perform: load)
        }
    }

    private func load() {
        guard !loaded, let a = existing else { loaded = true; return }
        loaded = true
        name = a.name
        weeklyHours = Double(a.sessionsPerWeek * a.sessionMinutes) / 60
        sessionMinutes = a.sessionMinutes
        priority = a.priority
        days = Set(a.preferredDays)
        if let s = a.preferredStart, let e = a.preferredEnd {
            useWindow = true
            windowStart = TimeUtils.clock(s)
            windowEnd = TimeUtils.clock(e)
        }
        onlyPreferred = a.onlyPreferred ?? false
        if let split = a.splitMinutes { splitOn = true; splitMinutes = split }
        canOverlap = a.canOverlap ?? false
        overlapWith = Set(a.overlapWith ?? [])
        maxOverlapHours = Double(a.maxOverlapMinutes ?? 0) / 60
    }

    private func save() {
        // Start from the stored activity so fields this form does not edit (goal, deadline…) are kept.
        var a = existing ?? Activity(id: "a-\(UUID().uuidString.prefix(8).lowercased())", name: "", sessionsPerWeek: 1, sessionMinutes: 60,
                                     priority: .medium, preferredDays: [])
        a.name = name.trimmingCharacters(in: .whitespaces)
        a.sessionsPerWeek = sessions.sessions
        a.sessionMinutes = sessions.minutes
        a.priority = priority
        a.preferredDays = days.sorted()
        a.preferredStart = useWindow ? TimeUtils.hhmm(from: windowStart) : nil
        a.preferredEnd = useWindow ? TimeUtils.hhmm(from: windowEnd) : nil
        a.onlyPreferred = useWindow && onlyPreferred ? true : nil
        a.splitMinutes = splitOn ? splitMinutes : nil
        a.canOverlap = canOverlap ? true : nil
        a.overlapWith = canOverlap && !overlapWith.isEmpty ? overlapWith.sorted() : nil
        a.maxOverlapMinutes = canOverlap && maxOverlapHours > 0 ? Int((maxOverlapHours * 60).rounded()) : nil
        store.upsert(a)
        dismiss()
    }
}
