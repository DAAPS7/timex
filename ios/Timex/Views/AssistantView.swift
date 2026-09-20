import SwiftUI

struct AssistantView: View {
    @Environment(AppStore.self) private var store
    @State private var text = ""

    private let suggestions = [
        "Planeia a minha semana",
        "Planeia a próxima semana",
        "Quero estudar 6 horas esta semana e ir ao ginásio 4 vezes",
        "Consigo encaixar 3 horas de programação?",
        "Porque pões o ginásio nesses dias?",
        "Como aproveito o tempo de transporte?",
    ]

    var body: some View {
        let chat = store.chat
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 12) {
                    if chat.isEmpty {
                        Text("Diz o que queres fazer. O assistente interpreta; o motor de planeamento decide o que cabe.")
                            .foregroundStyle(.secondary)
                            .padding(.top, 8)
                        suggestionChips
                    }
                    ForEach(chat) { message in
                        MessageView(message: message).id(message.id)
                    }
                    if store.assistantBusy {
                        Text("A pensar…").foregroundStyle(.secondary).padding(12).glassEffect(.regular, in: .rect(cornerRadius: 20))
                    }
                    Color.clear.frame(height: 1).id("end")
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 12)
            }
            .scrollDismissesKeyboard(.interactively)
            .onChange(of: chat.count) { _, _ in withAnimation { proxy.scrollTo("end", anchor: .bottom) } }
            .onChange(of: store.assistantBusy) { _, _ in withAnimation { proxy.scrollTo("end", anchor: .bottom) } }
        }
        .appBackground()
        .navigationTitle("Assistente")
        .safeAreaInset(edge: .bottom) { composer }
    }

    private var suggestionChips: some View {
        GlassEffectContainer(spacing: 8) {
            VStack(alignment: .leading, spacing: 8) {
                ForEach(suggestions, id: \.self) { s in
                    Button { Task { await store.send(s) } } label: {
                        Text(s).font(.subheadline).padding(.horizontal, 14).padding(.vertical, 9).multilineTextAlignment(.leading)
                    }
                    .buttonStyle(.plain)
                    .glassEffect(.regular.interactive(), in: .rect(cornerRadius: 18))
                }
            }
        }
    }

    /// The composer floats above the content on glass: a field and a send button that morph together.
    private var composer: some View {
        GlassEffectContainer(spacing: 10) {
            HStack(spacing: 10) {
                TextField("Escreve ao assistente…", text: $text, axis: .vertical)
                    .lineLimit(1...4)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .glassEffect(.regular.interactive(), in: .capsule)
                    .submitLabel(.send)
                    .onSubmit(submit)
                GlassIconButton(systemName: "arrow.up", label: "Enviar", prominent: true, action: submit)
                    .disabled(store.assistantBusy || text.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
    }

    private func submit() {
        let message = text
        text = ""
        Task { await store.send(message) }
    }
}

private struct MessageView: View {
    @Environment(AppStore.self) private var store
    let message: ChatMessage

    var body: some View {
        VStack(alignment: message.role == "user" ? .trailing : .leading, spacing: 10) {
            bubble
            if let proposals = message.proposals, !proposals.isEmpty { proposalCard(proposals) }
            if let plan = message.plan, message.planAdoptable == true, !plan.scheduledItems.isEmpty { planCard(plan) }
        }
        .frame(maxWidth: .infinity, alignment: message.role == "user" ? .trailing : .leading)
    }

    @ViewBuilder private var bubble: some View {
        if message.role == "user" {
            Text(message.text)
                .padding(.horizontal, 16).padding(.vertical, 10)
                .glassEffect(.regular.tint(Theme.accent), in: .rect(cornerRadius: 22))
        } else {
            Text(message.text)
                .padding(.horizontal, 16).padding(.vertical, 10)
                .glassEffect(.regular, in: .rect(cornerRadius: 22))
        }
    }

    private func proposalCard(_ proposals: [ProposedAction]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Proposta").font(.headline)
            ForEach(Array(proposals.enumerated()), id: \.offset) { _, p in Text("• \(p.summary)").font(.footnote) }
            Button(message.handled == true ? "Aplicado" : "Aplicar e planear") { Task { await store.applyProposals(of: message) } }
                .buttonStyle(.glassProminent).tint(Theme.accent)
                .disabled(message.handled == true || store.busy)
        }
        .glassCard(cornerRadius: 22)
    }

    /// A weekly plan is only a proposal: it enters the calendar when the user approves it.
    private func planCard(_ plan: PlanningResult) -> some View {
        let byDay = Dictionary(grouping: plan.scheduledItems, by: \.date).sorted { $0.key < $1.key }
        return VStack(alignment: .leading, spacing: 8) {
            Text("Plano semanal proposto").font(.headline)
            Text("\(TimeUtils.duration(plan.scheduledMinutes)) planeadas de \(TimeUtils.duration(plan.requestedMinutes)) pedidas · \(plan.scheduledItems.count) sessões")
                .font(.footnote).foregroundStyle(.secondary)
            ForEach(byDay, id: \.key) { date, items in
                let sessions = items.sorted { $0.start < $1.start }.map { "\(store.activityName($0.activityId)) \($0.start)–\($0.end)" }.joined(separator: ", ")
                Text("**\(TimeUtils.weekdaysShort[TimeUtils.weekday(date)]) \(TimeUtils.dayNumber(date)):** \(sessions)").font(.footnote)
            }
            switch message.planDecision {
            case "approved": Text("Aprovado e adicionado ao calendário.").font(.footnote).foregroundStyle(Theme.green)
            case "rejected": Text("Rejeitado. Nada foi alterado no calendário.").font(.footnote).foregroundStyle(.secondary)
            default:
                GlassEffectContainer(spacing: 10) {
                    HStack(spacing: 10) {
                        Button("Aprovar plano") { store.approvePlan(of: message) }.buttonStyle(.glassProminent).tint(Theme.accent)
                        Button("Rejeitar") { store.rejectPlan(of: message) }.buttonStyle(.glass)
                    }
                }
            }
        }
        .glassCard(cornerRadius: 22)
    }
}
