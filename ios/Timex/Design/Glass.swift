import SwiftUI

// Liquid Glass design system (iOS 26+).
//
// Rules used everywhere in the app:
//  - Glass is for the *functional layer* that floats above content: controls, cards that group information, the tab bar.
//    The tab bar, navigation bars, toolbars and sheets get their glass from the system automatically.
//  - Related glass elements share a GlassEffectContainer so they blend and are rendered together.
//  - Tappable glass uses `.interactive()` so it reacts to touch (press, shimmer) like system controls.
//  - Buttons use the system `.glass` / `.glassProminent` styles rather than hand-made backgrounds.
//  - Glass needs something behind it to refract, so screens sit on `AppBackground`.

enum Theme {
    static let accent = Color(red: 1.0, green: 0.353, blue: 0.173)
    static let accent2 = Color(red: 0.878, green: 0.141, blue: 0.141)
    static let amber = Color(red: 0.91, green: 0.604, blue: 0.11)
    static let green = Color(red: 0.298, green: 0.765, blue: 0.541)
    static let crimson = Color(red: 0.784, green: 0.118, blue: 0.227)

    private static let activityPalette: [Color] = [accent, accent2, Color(red: 0.96, green: 0.44, blue: 0.10), crimson, Color(red: 1.0, green: 0.48, blue: 0.40), amber]

    /// Stable red/orange-family color per activity id (same idea as the web app's colorFor).
    static func color(for id: String) -> Color {
        var h: UInt32 = 0
        for scalar in id.unicodeScalars { h = h &* 31 &+ scalar.value }
        return activityPalette[Int(h % UInt32(activityPalette.count))]
    }
}

/// The warm dark backdrop that the glass refracts.
struct AppBackground: View {
    var body: some View {
        ZStack {
            Color(red: 0.024, green: 0.024, blue: 0.028)
            RadialGradient(colors: [Theme.accent.opacity(0.32), .clear], center: .topTrailing, startRadius: 0, endRadius: 420)
            RadialGradient(colors: [Theme.accent2.opacity(0.24), .clear], center: .bottomLeading, startRadius: 0, endRadius: 460)
        }
        .ignoresSafeArea()
    }
}

extension View {
    /// Screen background: the glow, with scroll views/lists letting it show through.
    func appBackground() -> some View {
        self.scrollContentBackground(.hidden).background { AppBackground() }
    }

    /// A card of related information on a glass surface.
    func glassCard(cornerRadius: CGFloat = 26) -> some View {
        self
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .glassEffect(.regular, in: .rect(cornerRadius: cornerRadius))
    }
}

/// A glass capsule that shows a value (status, duration).
struct GlassChip: View {
    let text: String
    var tint: Color? = nil
    var body: some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .glassEffect(.regular.tint(tint?.opacity(0.35)), in: .capsule)
    }
}

/// Segmented choice made of glass capsules. The selected one is tinted; all of them share one container so the
/// glass merges and morphs as the selection moves.
struct GlassPicker<Value: Hashable>: View {
    let options: [Value]
    let label: (Value) -> String
    @Binding var selection: Value
    @Namespace private var namespace

    var body: some View {
        GlassEffectContainer(spacing: 8) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(options, id: \.self) { option in
                        let selected = option == selection
                        Button {
                            withAnimation(.smooth(duration: 0.25)) { selection = option }
                        } label: {
                            Text(label(option))
                                .font(.subheadline.weight(.semibold))
                                .padding(.horizontal, 16)
                                .padding(.vertical, 9)
                                .foregroundStyle(selected ? Color.white : Color.primary)
                        }
                        .buttonStyle(.plain)
                        .glassEffect(selected ? .regular.tint(Theme.accent).interactive() : .regular.interactive(), in: .capsule)
                        .glassEffectID(option, in: namespace)
                    }
                }
                .padding(.horizontal, 2)
            }
        }
    }
}

/// Round glass icon button (previous/next, add, send).
struct GlassIconButton: View {
    let systemName: String
    var label: String
    var prominent = false
    let action: () -> Void

    var body: some View {
        if prominent {
            Button(action: action) { icon }.buttonStyle(.glassProminent).buttonBorderShape(.circle).tint(Theme.accent)
        } else {
            Button(action: action) { icon }.buttonStyle(.glass).buttonBorderShape(.circle)
        }
    }

    private var icon: some View {
        Image(systemName: systemName).font(.body.weight(.semibold)).frame(width: 30, height: 30).accessibilityLabel(label)
    }
}

/// Text field on a glass surface.
struct GlassField: View {
    let title: String
    @Binding var text: String
    var secure = false

    var body: some View {
        Group {
            if secure { SecureField(title, text: $text) } else { TextField(title, text: $text) }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 13)
        .glassEffect(.regular.interactive(), in: .rect(cornerRadius: 18))
    }
}

/// Toggle row inside a form: label on the left, switch on the right.
struct SettingToggle: View {
    let title: String
    @Binding var isOn: Bool
    var body: some View {
        Toggle(title, isOn: $isOn).tint(Theme.accent)
    }
}
