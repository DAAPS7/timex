import SwiftUI

@main
struct TimexApp: App {
    @State private var store = AppStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(store)
                .tint(Theme.accent)
                .preferredColorScheme(.dark)
                .task { await store.bootstrap() }
        }
    }
}
