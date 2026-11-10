import AppIntents
import SwiftUI
import WidgetKit

// Pellix Salon tokenları (fiziksel nesneler iki temada da aynı renkte kalır).
extension Color {
  init(hex: UInt32) {
    self.init(.sRGB,
              red: Double((hex >> 16) & 0xff) / 255,
              green: Double((hex >> 8) & 0xff) / 255,
              blue: Double(hex & 0xff) / 255,
              opacity: 1)
  }
}

enum Salon {
  static let boardBg = Color(hex: 0x0d0b0a)
  static let boardBorder = Color(hex: 0x3a332b)
  static let flapTop = Color(hex: 0x2e2924)
  static let flapBottom = Color(hex: 0x26221d)
  static let flapSeam = Color(hex: 0x070606)
  static let ink = Color(hex: 0xf2ede2)
  static let reasonInk = Color(hex: 0xe6dfd1)
  static let boardDim = Color(hex: 0xa39684)
  static let brass = Color(hex: 0xd4a94a)
  static let onBrass = Color(hex: 0x1a140b)
  static let rowLine = Color(hex: 0x241f1a)
  static let velvetDeep = Color(hex: 0x3f1214)
  static let velvetBorder = Color(hex: 0x5a1d20)
  static let velvet = Color(hex: 0x7a2428)
  static let velvetSeat = Color(hex: 0x651d21)
  static let seatArm = Color(hex: 0x3a2a22)
  static let glow = Color(hex: 0xffe3a3)
  static let billing = Color(hex: 0xe9d8b9)
}

enum SalonFont {
  static func marquee(_ size: CGFloat) -> Font { .custom("BigShoulders-ExtraBold", fixedSize: size) }
  static func marqueeBold(_ size: CGFloat) -> Font { .custom("BigShoulders-Bold", fixedSize: size) }
  static func mono(_ size: CGFloat) -> Font { .custom("DMMono-Regular", fixedSize: size) }
  static func monoMedium(_ size: CGFloat) -> Font { .custom("DMMono-Medium", fixedSize: size) }
}

// Uygulamadaki SeansBoard ile aynı satır kırma: kelimeler sütuna sığdığı kadar yan yana.
enum FlapLayout {
  static func lines(_ text: String, cols: Int, rows: Int) -> [[Character]] {
    var lines: [String] = [""]
    for word in text.split(separator: " ").map(String.init) {
      let current = lines[lines.count - 1]
      let joined = current.isEmpty ? word : current + " " + word
      if joined.count <= cols {
        lines[lines.count - 1] = joined
      } else if word.count <= cols {
        lines.append(word)
      } else {
        var rest = joined
        lines[lines.count - 1] = String(rest.prefix(cols))
        rest = String(rest.dropFirst(cols))
        while !rest.isEmpty {
          lines.append(String(rest.prefix(cols)))
          rest = String(rest.dropFirst(cols))
        }
      }
    }
    if lines.count > rows {
      lines = Array(lines.prefix(rows))
      var last = lines[rows - 1]
      if last.count >= cols { last = String(last.prefix(cols - 1)) }
      lines[rows - 1] = last + "…"
    }
    while lines.count < rows { lines.append("") }
    return lines.map { line -> [Character] in
      var chars = Array(line.prefix(cols))
      while chars.count < cols { chars.append(" ") }
      return chars
    }
  }
}

struct FlapCell: View {
  let char: Character
  let size: CGSize
  let fontSize: CGFloat
  @Environment(\.widgetRenderingMode) private var renderingMode

  var body: some View {
    ZStack {
      if renderingMode == .fullColor {
        VStack(spacing: 0) {
          Salon.flapTop
          Salon.flapBottom
        }
        Salon.flapSeam.frame(height: 1)
      } else {
        RoundedRectangle(cornerRadius: 3).stroke(Color.white.opacity(0.35), lineWidth: 1)
      }
      Text(String(char))
        .font(SalonFont.marquee(fontSize))
        .foregroundStyle(Salon.ink)
        .widgetAccentable()
        .id(char)
        .transition(.push(from: .top))
    }
    .frame(width: size.width, height: size.height)
    .clipShape(RoundedRectangle(cornerRadius: 3))
  }
}

// Harf kutucuklu pano. Hücre genişliği widget'ın gerçek genişliğine göre küçülür (küçük iPhone'lar).
struct FlapBoard: View {
  let text: String
  let cols: Int
  let rows: Int
  let maxCellWidth: CGFloat
  let cellHeight: CGFloat
  let fontSize: CGFloat

  var body: some View {
    GeometryReader { geo in
      let width = max(8, min(maxCellWidth, floor((geo.size.width - CGFloat(cols - 1) * 2) / CGFloat(cols))))
      let lines = FlapLayout.lines(text, cols: cols, rows: rows)
      VStack(alignment: .leading, spacing: 2) {
        ForEach(0..<rows, id: \.self) { r in
          HStack(spacing: 2) {
            ForEach(0..<cols, id: \.self) { c in
              FlapCell(char: lines[r][c], size: CGSize(width: width, height: cellHeight), fontSize: min(fontSize, width * 0.82))
            }
          }
        }
      }
    }
    .frame(height: CGFloat(rows) * cellHeight + CGFloat(rows - 1) * 2)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(text)
  }
}

struct BoardHeader: View {
  let left: String
  let right: String?

  var body: some View {
    HStack(spacing: 4) {
      Text(left)
        .font(SalonFont.monoMedium(9))
        .tracking(1)
        .foregroundStyle(Salon.brass)
        .lineLimit(1)
      Spacer(minLength: 4)
      if let right {
        Text(right)
          .font(SalonFont.monoMedium(9))
          .tracking(1)
          .foregroundStyle(Salon.boardDim)
          .lineLimit(1)
      }
    }
    .frame(height: 11)
  }
}

struct NextButton: View {
  var label: String = L.t("next")

  var body: some View {
    Button(intent: NextPickIntent()) {
      HStack(spacing: 2) {
        Text(label).font(.system(size: 11, weight: .bold))
        Image(systemName: "chevron.right").font(.system(size: 9, weight: .bold))
      }
      .foregroundStyle(Salon.ink)
      .padding(.leading, 11)
      .padding(.trailing, 8)
      .frame(height: 24)
      .overlay(Capsule().stroke(Salon.boardBorder, lineWidth: 1))
      .contentShape(Capsule())
    }
    .buttonStyle(.plain)
  }
}

struct PosterView: View {
  let image: UIImage?
  let size: CGSize
  var radius: CGFloat = 6
  var border: Color = Salon.boardBorder

  var body: some View {
    Group {
      if let image {
        if #available(iOS 18.0, *) {
          Image(uiImage: image)
            .resizable()
            .widgetAccentedRenderingMode(.desaturated)
            .aspectRatio(contentMode: .fill)
        } else {
          Image(uiImage: image)
            .resizable()
            .aspectRatio(contentMode: .fill)
        }
      } else {
        ZStack {
          Salon.flapBottom
          Image(systemName: "film").font(.system(size: 18)).foregroundStyle(Salon.boardDim)
        }
      }
    }
    .frame(width: size.width, height: size.height)
    .clipShape(RoundedRectangle(cornerRadius: radius))
    .overlay(RoundedRectangle(cornerRadius: radius).stroke(border, lineWidth: 1))
  }
}

struct BoardBackground: View {
  var body: some View {
    ZStack {
      Salon.boardBg
      ContainerRelativeShape().stroke(Salon.boardBorder, lineWidth: 2)
    }
  }
}

struct VelvetBackground: View {
  var body: some View {
    ZStack {
      Salon.velvetDeep
      ContainerRelativeShape().stroke(Salon.velvetBorder, lineWidth: 2)
    }
  }
}

// Perde ışığı: uyum yüzdesinin üstündeki ince parlak çizgi.
struct ScreenGlow: View {
  let width: CGFloat
  var body: some View {
    Capsule()
      .fill(Salon.glow)
      .frame(width: width, height: 3)
      .shadow(color: Salon.glow.opacity(0.45), radius: 7)
      .accessibilityHidden(true)
  }
}

struct Seat: View {
  let initial: String
  var body: some View {
    VStack(spacing: -1) {
      UnevenRoundedRectangle(topLeadingRadius: 10, bottomLeadingRadius: 3, bottomTrailingRadius: 3, topTrailingRadius: 10)
        .fill(Salon.velvet)
        .frame(width: 46, height: 24)
        .overlay(Text(initial).font(SalonFont.marqueeBold(14)).foregroundStyle(Salon.billing))
      RoundedRectangle(cornerRadius: 3).fill(Salon.velvetSeat).frame(width: 50, height: 8)
    }
  }
}

struct SeatPair: View {
  let left: String
  let right: String
  var body: some View {
    HStack(alignment: .bottom, spacing: 4) {
      Seat(initial: left)
      RoundedRectangle(cornerRadius: 3).fill(Salon.seatArm).frame(width: 6, height: 18)
      Seat(initial: right)
    }
    .accessibilityHidden(true)
  }
}
