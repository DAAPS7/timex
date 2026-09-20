import Foundation

struct APIError: LocalizedError {
    let status: Int
    let message: String
    var errorDescription: String? { message }
}

/// Talks to the same /api as the web app. Authentication is the `timex_session` cookie: URLSession keeps it in
/// HTTPCookieStorage, so the app never sees or stores the session token itself.
final class APIClient {
    static let baseURLKey = "timex.baseURL"

    /// The server address: chosen on the sign-in screen, otherwise the value in Info.plist (TimexAPIBaseURL).
    static var baseURL: URL {
        get {
            let stored = UserDefaults.standard.string(forKey: baseURLKey)
            let fallback = Bundle.main.object(forInfoDictionaryKey: "TimexAPIBaseURL") as? String ?? "http://localhost:8787"
            let text = (stored?.isEmpty == false) ? stored! : fallback
            return URL(string: text) ?? URL(string: "http://localhost:8787")!
        }
        set { UserDefaults.standard.set(newValue.absoluteString, forKey: baseURLKey) }
    }

    private let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.httpCookieStorage = .shared
        config.httpShouldSetCookies = true
        return URLSession(configuration: config)
    }()
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    private struct ErrorBody: Decodable {
        struct Inner: Decodable { let message: String }
        let error: Inner
    }
    private struct Empty: Decodable {}

    private func send<T: Decodable>(_ method: String, _ path: String, body: (any Encodable)? = nil) async throws -> T {
        var request = URLRequest(url: Self.baseURL.appendingPathComponent(path))
        request.httpMethod = method
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "content-type")
            request.httpBody = try encoder.encode(AnyEncodable(body))
        }
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw APIError(status: 0, message: "Não consegui contactar o servidor (\(Self.baseURL.absoluteString)).")
        }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            let message = (try? decoder.decode(ErrorBody.self, from: data))?.error.message ?? "Erro \(status)."
            throw APIError(status: status, message: message)
        }
        return try decoder.decode(T.self, from: data)
    }

    // MARK: Auth

    private struct UserBody: Decodable { let user: User }
    private struct Credentials: Encodable { let email: String; let password: String }

    /// The signed-in user, or nil when there is no valid session.
    func me() async throws -> User? {
        do {
            let body: UserBody = try await send("GET", "api/auth/me")
            return body.user
        } catch let e as APIError where e.status == 401 {
            return nil
        }
    }

    func login(email: String, password: String) async throws -> User {
        let body: UserBody = try await send("POST", "api/auth/login", body: Credentials(email: email, password: password))
        return body.user
    }

    func register(email: String, password: String) async throws -> User {
        let body: UserBody = try await send("POST", "api/auth/register", body: Credentials(email: email, password: password))
        return body.user
    }

    func logout() async throws {
        let _: Empty = try await send("POST", "api/auth/logout")
    }

    // MARK: Data, planning, assistant

    private struct StateBody: Decodable { let data: UserData? }

    func loadState() async throws -> UserData? {
        let body: StateBody = try await send("GET", "api/state")
        return body.data
    }

    func saveState(_ data: UserData) async throws {
        let _: Empty = try await send("PUT", "api/state", body: data)
    }

    func generatePlan(_ input: PlanningInput) async throws -> PlanningResult {
        try await send("POST", "api/plans/generate", body: input)
    }

    func askAssistant(_ request: AssistantRequest) async throws -> AssistantReply {
        try await send("POST", "api/assistant/message", body: request)
    }
}

/// Lets `send` take any Encodable without making the method generic over the body type.
private struct AnyEncodable: Encodable {
    private let encodeFunc: (Encoder) throws -> Void
    init(_ wrapped: any Encodable) { encodeFunc = wrapped.encode }
    func encode(to encoder: Encoder) throws { try encodeFunc(encoder) }
}
