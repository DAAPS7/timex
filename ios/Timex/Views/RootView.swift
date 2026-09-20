import SwiftUI

/// Auth gate + the tab bar. On iOS 26 the TabView is drawn as a floating Liquid Glass bar by the system, and
/// `tabBarMinimizeBehavior` collapses it while scrolling so content gets the room.
struct RootView: View {
    @Environment(AppStore.self) private var store

    var body: some View {
        switch store.phase {
        case .loading:
            ProgressView("A carregar…")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background { AppBackground() }
        case .signedOut:
            AuthView()
        case .ready:
            MainTabs()
        }
    }
}

struct MainTabs: View {
    @Environment(AppStore.self) private var store

    var body: some View {
        TabView {
            Tab("Hoje", systemImage: "house") { NavigationStack { TodayView() } }
            Tab("Calendário", systemImage: "calendar") { NavigationStack { CalendarView() } }
            Tab("Atividades", systemImage: "bolt") { NavigationStack { ActivitiesView() } }
            Tab("Assistente", systemImage: "sparkles") { NavigationStack { AssistantView() } }
            Tab("Definições", systemImage: "gearshape") { NavigationStack { SettingsView() } }
        }
        .tabBarMinimizeBehavior(.onScrollDown)
        .safeAreaInset(edge: .top, spacing: 0) {
            if store.syncFailed {
                Text("Não foi possível guardar as últimas alterações. Vou tentar de novo na próxima alteração.")
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .padding(10)
                    .frame(maxWidth: .infinity)
                    .glassEffect(.regular.tint(.red.opacity(0.3)), in: .rect(cornerRadius: 16))
                    .padding(.horizontal, 12)
            }
        }
    }
}
