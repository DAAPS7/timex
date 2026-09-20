import SwiftUI

struct AuthView: View {
    @Environment(AppStore.self) private var store
    @State private var email = ""
    @State private var password = ""
    @State private var creating = false
    @State private var server = APIClient.baseURL.absoluteString
    @State private var showServer = false

    var body: some View {
        ScrollView {
            VStack(spacing: 22) {
                Image(systemName: "clock")
                    .font(.system(size: 34, weight: .semibold))
                    .frame(width: 76, height: 76)
                    .glassEffect(.regular.tint(Theme.accent.opacity(0.6)), in: .rect(cornerRadius: 24))
                    .padding(.top, 60)
                Text("Timex").font(.largeTitle.bold())
                Text(creating ? "Cria a tua conta" : "Inicia sessão").foregroundStyle(.secondary)

                VStack(spacing: 12) {
                    GlassField(title: "Email", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    GlassField(title: "Palavra-passe (mín. 8 caracteres)", text: $password, secure: true)
                        .textContentType(creating ? .newPassword : .password)
                }

                if let message = store.errorMessage {
                    Text(message).font(.footnote).foregroundStyle(.red).multilineTextAlignment(.center)
                }

                Button {
                    Task { await store.signIn(email: email.trimmingCharacters(in: .whitespaces), password: password, create: creating) }
                } label: {
                    Text(creating ? "Criar conta" : "Entrar").font(.headline).frame(maxWidth: .infinity).padding(.vertical, 6)
                }
                .buttonStyle(.glassProminent)
                .tint(Theme.accent)
                .disabled(store.busy || email.isEmpty || password.count < 8)

                Button(creating ? "Já tenho conta" : "Criar conta") { creating.toggle() }
                    .buttonStyle(.glass)

                DisclosureGroup("Servidor", isExpanded: $showServer) {
                    GlassField(title: "https://…", text: $server)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .onChange(of: server) { _, value in
                            if let url = URL(string: value), url.scheme != nil { APIClient.baseURL = url }
                        }
                }
                .font(.footnote)
                .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 24)
            .frame(maxWidth: 460)
            .frame(maxWidth: .infinity)
        }
        .background { AppBackground() }
    }
}
