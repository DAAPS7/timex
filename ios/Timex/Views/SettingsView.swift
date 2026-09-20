import SwiftUI

struct SettingsView: View {
    @Environment(AppStore.self) private var store
    @State private var wake = Date()
    @State private var bed = Date()
    @State private var loaded = false

    var body: some View {
        Form {
            Section("Conta") {
                if let user = store.user { LabeledContent("Sessão iniciada como", value: user.email) }
                LabeledContent("Servidor", value: APIClient.baseURL.absoluteString)
                Button("Terminar sessão", role: .destructive) { Task { await store.signOut() } }
            }

            Section {
                DatePicker("Acordo às", selection: $wake, displayedComponents: .hourAndMinute)
                DatePicker("Deito-me às", selection: $bed, displayedComponents: .hourAndMinute)
            } header: {
                Text("Sono")
            } footer: {
                Text("Fora destas horas nada é planeado. Refeições, transporte e compromissos fixos configuram-se na versão web por agora.")
            }
        }
        .scrollContentBackground(.hidden)
        .background { AppBackground() }
        .navigationTitle("Definições")
        .onAppear {
            guard !loaded else { return }
            loaded = true
            wake = TimeUtils.clock(store.data.preferences.dayStart)
            bed = TimeUtils.clock(store.data.preferences.dayEnd)
        }
        .onChange(of: wake) { _, value in update { $0.dayStart = TimeUtils.hhmm(from: value) } }
        .onChange(of: bed) { _, value in update { $0.dayEnd = TimeUtils.hhmm(from: value) } }
    }

    private func update(_ change: (inout Preferences) -> Void) {
        guard loaded else { return }
        var prefs = store.data.preferences
        change(&prefs)
        store.setPreferences(prefs)
    }
}
