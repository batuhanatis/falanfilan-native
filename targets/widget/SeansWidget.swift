import AppIntents
import SwiftUI
import WidgetKit

// "Sıradaki": uygulamayı açmadan panoyu bir sonraki seçime çevirir. Son seçimden sonra
// "pano bitti" durumu, ondan sonra yeniden ilk seçim gelir.
struct NextPickIntent: AppIntent {
  static let title: LocalizedStringResource = "Sıradaki seçim"
  static let description = IntentDescription("Bu akşamın panosunu sıradaki filme çevirir.")
  static let isDiscoverable: Bool = false

  init() {}

  func perform() async throws -> some IntentResult {
    let count = PellixStore.seans()?.items.count ?? 0
    if count > 0 {
      let current = min(max(PellixStore.seansIndex, 0), count)
      PellixStore.seansIndex = (current + 1) % (count + 1)
    }
    return .result()
  }
}

struct SeansPick {
  let item: SeansItem
  let index: Int
  let count: Int
  let poster: UIImage?
  let upcoming: [SeansItem]

  var position: String { String(format: "%02d/%02d", index + 1, count) }
}

struct SeansEntry: TimelineEntry {
  enum Kind {
    case empty
    case done(Int)
    case pick(SeansPick)
  }
  let date: Date
  let kind: Kind
}

struct SeansProvider: TimelineProvider {
  func placeholder(in context: Context) -> SeansEntry {
    SeansEntry(date: Date(), kind: .pick(SeansPick(item: .sample, index: 0, count: 10, poster: nil, upcoming: [])))
  }

  func getSnapshot(in context: Context, completion: @escaping (SeansEntry) -> Void) {
    Task { completion(await Self.entry(for: context.family, preview: context.isPreview)) }
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<SeansEntry>) -> Void) {
    Task {
      let entry = await Self.entry(for: context.family, preview: false)
      let next = Calendar.current.date(byAdding: .hour, value: 3, to: Date()) ?? Date().addingTimeInterval(10_800)
      completion(Timeline(entries: [entry], policy: .after(next)))
    }
  }

  static func entry(for family: WidgetFamily, preview: Bool) async -> SeansEntry {
    guard let data = PellixStore.seans(), !data.items.isEmpty else {
      if preview {
        return SeansEntry(date: Date(), kind: .pick(SeansPick(item: .sample, index: 0, count: 10, poster: nil, upcoming: [])))
      }
      return SeansEntry(date: Date(), kind: .empty)
    }
    let count = data.items.count
    let index = min(max(PellixStore.seansIndex, 0), count)
    if index == count { return SeansEntry(date: Date(), kind: .done(count)) }
    let item = data.items[index]
    let wantsPoster = family == .systemMedium || family == .systemLarge
    let poster = wantsPoster ? await PosterLoader.image(item.poster) : nil
    let upcoming = (1...3).compactMap { step -> SeansItem? in
      let next = index + step
      return next < count ? data.items[next] : nil
    }
    return SeansEntry(date: Date(), kind: .pick(SeansPick(item: item, index: index, count: count, poster: poster, upcoming: upcoming)))
  }
}

// MARK: - Görünümler

struct SeansSmall: View {
  let pick: SeansPick
  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      BoardHeader(left: L.t("tonightShort"), right: pick.position)
      FlapBoard(text: pick.item.board, cols: 9, rows: 2, maxCellWidth: 13, cellHeight: 17, fontSize: 12)
        .padding(.top, 8)
      Text(pick.item.meta)
        .font(SalonFont.mono(9))
        .foregroundStyle(Salon.boardDim)
        .lineLimit(1)
        .padding(.top, 8)
      if let reason = pick.item.reason {
        Text(reason)
          .font(.system(size: 10.5))
          .foregroundStyle(Salon.reasonInk)
          .lineLimit(2)
          .padding(.top, 5)
      }
      Spacer(minLength: 0)
      if let imdb = pick.item.imdb {
        Text("IMDb \(imdb)").font(SalonFont.mono(9)).foregroundStyle(Salon.boardDim)
      }
    }
    .padding(12)
    .widgetURL(PellixLinks.film(pick.item.id))
  }
}

struct SeansMedium: View {
  let pick: SeansPick
  var body: some View {
    HStack(alignment: .top, spacing: 12) {
      PosterView(image: pick.poster, size: CGSize(width: 89, height: 134))
      VStack(alignment: .leading, spacing: 0) {
        BoardHeader(left: L.t("tonight"), right: pick.position)
        FlapBoard(text: pick.item.board, cols: 11, rows: 2, maxCellWidth: 16, cellHeight: 18, fontSize: 13)
          .padding(.top, 6)
        Text(pick.item.meta)
          .font(SalonFont.mono(9.5))
          .foregroundStyle(Salon.boardDim)
          .lineLimit(1)
          .padding(.top, 6)
        if let reason = pick.item.reason {
          Text(reason)
            .font(.system(size: 11))
            .foregroundStyle(Salon.reasonInk)
            .lineLimit(2)
            .padding(.top, 5)
        }
        Spacer(minLength: 2)
        HStack(spacing: 6) {
          if let imdb = pick.item.imdb {
            Text("IMDb \(imdb)").font(SalonFont.mono(9.5)).foregroundStyle(Salon.boardDim)
          }
          Spacer(minLength: 0)
          NextButton()
        }
      }
    }
    .padding(12)
    .widgetURL(PellixLinks.film(pick.item.id))
  }
}

struct SeansLarge: View {
  let pick: SeansPick

  private var dateLabel: String {
    let formatter = DateFormatter()
    formatter.locale = L.locale
    formatter.dateFormat = "EEEE d MMM"
    return L.upper(formatter.string(from: Date())).replacingOccurrences(of: ".", with: "")
  }

  private var heroText: String {
    [pick.item.reason, pick.item.overview].compactMap { $0 }.joined(separator: " ")
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      BoardHeader(left: L.t("tonight"), right: dateLabel)
      HStack(alignment: .top, spacing: 12) {
        PosterView(image: pick.poster, size: CGSize(width: 96, height: 144))
        VStack(alignment: .leading, spacing: 0) {
          FlapBoard(text: pick.item.board, cols: 12, rows: 2, maxCellWidth: 15, cellHeight: 19, fontSize: 13.5)
          Text(pick.item.imdb.map { "\(pick.item.meta) · IMDb \($0)" } ?? pick.item.meta)
            .font(SalonFont.mono(9.5))
            .foregroundStyle(Salon.boardDim)
            .lineLimit(1)
            .padding(.top, 8)
          Text(heroText)
            .font(.system(size: 11.5))
            .foregroundStyle(Salon.reasonInk)
            .lineLimit(5)
            .padding(.top, 6)
        }
      }
      .padding(.top, 10)

      if !pick.upcoming.isEmpty {
        Text(L.t("upcoming"))
          .font(SalonFont.monoMedium(9))
          .tracking(1)
          .foregroundStyle(Salon.brass)
          .padding(.top, 14)
        VStack(spacing: 0) {
          ForEach(Array(pick.upcoming.enumerated()), id: \.element.id) { offset, item in
            Link(destination: PellixLinks.film(item.id)) {
              HStack(spacing: 10) {
                Text(String(format: "%02d", pick.index + offset + 2))
                  .font(SalonFont.monoMedium(10.5))
                  .foregroundStyle(Salon.brass)
                  .frame(width: 18, alignment: .leading)
                Text(item.title)
                  .font(SalonFont.marqueeBold(17))
                  .foregroundStyle(Salon.ink)
                  .lineLimit(1)
                Spacer(minLength: 6)
                Text(item.shortMeta)
                  .font(SalonFont.mono(9))
                  .foregroundStyle(Salon.boardDim)
                  .lineLimit(1)
              }
              .frame(height: 32)
              .overlay(alignment: .bottom) { Salon.rowLine.frame(height: 1) }
            }
          }
        }
        .padding(.top, 4)
      }

      Spacer(minLength: 4)
      HStack {
        Text(L.t("ofCount", String(pick.count), String(pick.index + 1)))
          .font(SalonFont.mono(9))
          .foregroundStyle(Salon.boardDim)
        Spacer(minLength: 0)
        NextButton()
      }
    }
    .padding(14)
    .widgetURL(PellixLinks.film(pick.item.id))
  }
}

// Boş pano (yeni kullanıcı) ve günün seçkisi bitti durumları.
struct SeansMessage: View {
  let board: String
  let meta: String
  let text: String
  let finished: Bool
  let count: Int
  @Environment(\.widgetFamily) private var family

  var body: some View {
    let small = family == .systemSmall
    HStack(alignment: .top, spacing: 12) {
      if !small {
        ZStack {
          RoundedRectangle(cornerRadius: 6)
            .stroke(Salon.boardBorder, style: StrokeStyle(lineWidth: 1, dash: finished ? [] : [3, 3]))
          if finished {
            VStack(spacing: 4) {
              Text("\(count)/\(count)").font(SalonFont.marquee(24)).foregroundStyle(Salon.brass)
              Text(L.t("seans")).font(SalonFont.mono(8)).tracking(1).foregroundStyle(Salon.boardDim)
            }
          } else {
            Image(systemName: "film").font(.system(size: 20)).foregroundStyle(Salon.boardDim)
          }
        }
        .frame(width: 89, height: 134)
      }
      VStack(alignment: .leading, spacing: 0) {
        BoardHeader(left: small ? L.t("tonightShort") : L.t("tonight"), right: finished ? "\(count)/\(count)" : nil)
        FlapBoard(text: board, cols: small ? 9 : 11, rows: 2, maxCellWidth: small ? 13 : 16,
                  cellHeight: small ? 17 : 18, fontSize: small ? 12 : 13)
          .padding(.top, small ? 8 : 6)
        Text(meta)
          .font(SalonFont.mono(9.5))
          .foregroundStyle(Salon.boardDim)
          .lineLimit(1)
          .padding(.top, 6)
        Text(text)
          .font(.system(size: small ? 10.5 : 11))
          .foregroundStyle(Salon.reasonInk)
          .lineLimit(small ? 4 : 3)
          .padding(.top, 5)
        Spacer(minLength: 0)
        if !small {
          HStack {
            Spacer(minLength: 0)
            if finished {
              NextButton(label: L.t("restart"))
            } else {
              Text(L.t("discover"))
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Salon.onBrass)
                .padding(.horizontal, 11)
                .frame(height: 24)
                .background(Capsule().fill(Salon.brass))
            }
          }
        }
      }
    }
    .padding(12)
    .widgetURL(PellixLinks.discover)
  }
}

// Kilit ekranı (sistem tek renkle çizer).
struct SeansAccessory: View {
  let entry: SeansEntry
  @Environment(\.widgetFamily) private var family

  var body: some View {
    switch family {
    case .accessoryInline:
      if case .pick(let pick) = entry.kind {
        Label(L.t("inline", pick.item.title), systemImage: "film")
          .widgetURL(PellixLinks.film(pick.item.id))
      } else {
        Label(L.t("inlineEmpty"), systemImage: "film")
      }
    case .accessoryCircular:
      ZStack {
        AccessoryWidgetBackground()
        if case .pick(let pick) = entry.kind {
          VStack(spacing: 2) {
            HStack(spacing: 2) {
              ForEach(Array(String(format: "%02d", pick.index + 1).enumerated()), id: \.offset) { _, digit in
                Text(String(digit))
                  .font(SalonFont.marquee(14))
                  .frame(width: 15, height: 19)
                  .background(RoundedRectangle(cornerRadius: 3).fill(Color.white.opacity(0.2)))
              }
            }
            Text("/\(pick.count) \(L.t("seans"))").font(SalonFont.mono(7.5)).opacity(0.75)
          }
          .widgetURL(PellixLinks.film(pick.item.id))
        } else {
          Image(systemName: "film").font(.system(size: 22))
        }
      }
    default:
      VStack(alignment: .leading, spacing: 1) {
        if case .pick(let pick) = entry.kind {
          Text("\(L.t("tonightShort")) · \(pick.position)").font(SalonFont.monoMedium(9)).tracking(1).opacity(0.75)
          Text(pick.item.board)
            .font(SalonFont.marquee(19))
            .lineLimit(1)
            .minimumScaleFactor(0.6)
            .widgetAccentable()
          Text(pick.item.shortMeta).font(.system(size: 11)).opacity(0.75).lineLimit(1)
        } else {
          Text(L.t("tonightShort")).font(SalonFont.monoMedium(9)).tracking(1).opacity(0.75)
          Text(L.t("emptyMeta")).font(SalonFont.marquee(17)).lineLimit(1).minimumScaleFactor(0.6)
          Text(L.t("discover")).font(.system(size: 11)).opacity(0.75)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .widgetURL(entry.pickID.map(PellixLinks.film) ?? PellixLinks.discover)
    }
  }
}

extension SeansEntry {
  var pickID: Int? {
    if case .pick(let pick) = kind { return pick.item.id }
    return nil
  }
}

struct SeansWidgetView: View {
  let entry: SeansEntry
  @Environment(\.widgetFamily) private var family

  private var isAccessory: Bool {
    family == .accessoryInline || family == .accessoryCircular || family == .accessoryRectangular
  }

  var body: some View {
    content
      .containerBackground(for: .widget) {
        if isAccessory { Color.clear } else { BoardBackground() }
      }
  }

  @ViewBuilder private var content: some View {
    if isAccessory {
      SeansAccessory(entry: entry)
    } else {
      switch entry.kind {
      case .empty:
        SeansMessage(board: L.t("emptyBoard"), meta: L.t("emptyMeta"), text: L.t("emptyText"), finished: false, count: 0)
      case .done(let count):
        SeansMessage(board: L.t("doneBoard"), meta: L.t("doneMeta"), text: L.t("doneText", String(count)), finished: true, count: count)
      case .pick(let pick):
        switch family {
        case .systemSmall: SeansSmall(pick: pick)
        case .systemLarge: SeansLarge(pick: pick)
        default: SeansMedium(pick: pick)
        }
      }
    }
  }
}

struct SeansWidget: Widget {
  let kind = "PellixSeans"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SeansProvider()) { entry in
      SeansWidgetView(entry: entry)
    }
    .configurationDisplayName("Bu akşamın seansı")
    .description("Günün seçkisi ana ekranında. Sıradaki ile panoyu çevir.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryInline, .accessoryRectangular, .accessoryCircular])
    .contentMarginsDisabled()
  }
}
