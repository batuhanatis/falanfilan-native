import SwiftUI
import WidgetKit

// Blend: son bakılan arkadaşla beğeni uyumu. Perde ışığının altında yan yana iki kadife koltuk.
struct BlendEntry: TimelineEntry {
  let date: Date
  let data: BlendData?
  let posters: [Int: UIImage]
}

struct BlendProvider: TimelineProvider {
  static let sample = BlendData(friendId: 0, me: "Sen", friend: "Arkadaşın", percent: 81, films: [])

  func placeholder(in context: Context) -> BlendEntry {
    BlendEntry(date: Date(), data: Self.sample, posters: [:])
  }

  func getSnapshot(in context: Context, completion: @escaping (BlendEntry) -> Void) {
    Task { completion(await Self.entry(for: context.family, preview: context.isPreview)) }
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<BlendEntry>) -> Void) {
    Task {
      let entry = await Self.entry(for: context.family, preview: false)
      let next = Calendar.current.date(byAdding: .hour, value: 6, to: Date()) ?? Date().addingTimeInterval(21_600)
      completion(Timeline(entries: [entry], policy: .after(next)))
    }
  }

  static func entry(for family: WidgetFamily, preview: Bool) async -> BlendEntry {
    guard let data = PellixStore.blend() else {
      return BlendEntry(date: Date(), data: preview ? sample : nil, posters: [:])
    }
    var posters: [Int: UIImage] = [:]
    if family == .systemMedium {
      for film in data.films.prefix(3) {
        if let image = await PosterLoader.image(film.poster, box: CGSize(width: 120, height: 180)) {
          posters[film.id] = image
        }
      }
    }
    return BlendEntry(date: Date(), data: data, posters: posters)
  }
}

private func initial(_ name: String) -> String {
  L.upper(String(name.prefix(1)))
}

struct BlendScore: View {
  let data: BlendData
  let size: CGFloat
  let glowWidth: CGFloat

  var body: some View {
    VStack(spacing: 0) {
      ScreenGlow(width: glowWidth).padding(.top, 8)
      Text("%\(data.percent)")
        .font(SalonFont.marquee(size))
        .foregroundStyle(Salon.brass)
        .widgetAccentable()
        .padding(.top, 7)
      Text(L.upper("\(data.me) × \(data.friend)"))
        .font(SalonFont.mono(9.5))
        .tracking(1)
        .foregroundStyle(Salon.billing)
        .lineLimit(1)
        .minimumScaleFactor(0.7)
        .padding(.top, 2)
    }
  }
}

struct BlendSmall: View {
  let data: BlendData
  var body: some View {
    VStack(spacing: 0) {
      HStack {
        Text(L.t("blend")).foregroundStyle(Salon.brass)
        Spacer(minLength: 4)
        Text(L.t("blendScore")).foregroundStyle(Salon.billing)
      }
      .font(SalonFont.monoMedium(9))
      .tracking(1)
      .lineLimit(1)
      .frame(height: 11)
      BlendScore(data: data, size: 44, glowWidth: 104)
      Spacer(minLength: 0)
      SeatPair(left: initial(data.me), right: initial(data.friend))
    }
    .padding(12)
    .widgetURL(PellixLinks.blend(data))
  }
}

struct BlendMedium: View {
  let data: BlendData
  let posters: [Int: UIImage]

  var body: some View {
    HStack(alignment: .top, spacing: 14) {
      VStack(spacing: 0) {
        Text(L.t("blend"))
          .font(SalonFont.monoMedium(9))
          .tracking(1)
          .foregroundStyle(Salon.brass)
          .frame(maxWidth: .infinity, minHeight: 11, maxHeight: 11, alignment: .leading)
        BlendScore(data: data, size: 48, glowWidth: 96)
        Spacer(minLength: 0)
        SeatPair(left: initial(data.me), right: initial(data.friend))
      }
      .frame(width: 118)

      VStack(alignment: .leading, spacing: 0) {
        Text(L.t("together"))
          .font(SalonFont.monoMedium(9))
          .tracking(1)
          .foregroundStyle(Salon.brass)
          .frame(height: 11)
        HStack(alignment: .top, spacing: 7) {
          ForEach(data.films.prefix(3)) { film in
            Link(destination: PellixLinks.film(film.id)) {
              VStack(alignment: .leading, spacing: 5) {
                PosterView(image: posters[film.id], size: CGSize(width: 56, height: 84), border: Salon.velvetBorder)
                Text(film.title)
                  .font(.system(size: 9.5))
                  .foregroundStyle(Salon.billing)
                  .lineLimit(1)
                  .frame(width: 56, alignment: .leading)
              }
            }
          }
        }
        .padding(.top, 10)
        Spacer(minLength: 0)
        Text(L.t("togetherNote"))
          .font(.system(size: 10.5))
          .foregroundStyle(Salon.billing)
          .lineLimit(2)
      }
    }
    .padding(12)
    .widgetURL(PellixLinks.blend(data))
  }
}

struct BlendEmpty: View {
  @Environment(\.widgetFamily) private var family
  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      Text(L.t("blend"))
        .font(SalonFont.monoMedium(9))
        .tracking(1)
        .foregroundStyle(Salon.brass)
        .frame(height: 11)
      ScreenGlow(width: family == .systemSmall ? 104 : 200).padding(.top, 8).frame(maxWidth: .infinity)
      Text(L.t("blendEmpty"))
        .font(.system(size: family == .systemSmall ? 11 : 12))
        .foregroundStyle(Salon.billing)
        .lineLimit(3)
        .padding(.top, 10)
      Spacer(minLength: 0)
      SeatPair(left: "?", right: "?").frame(maxWidth: .infinity)
    }
    .padding(12)
    .widgetURL(PellixLinks.blends)
  }
}

struct BlendWidgetView: View {
  let entry: BlendEntry
  @Environment(\.widgetFamily) private var family

  var body: some View {
    content
      .containerBackground(for: .widget) {
        if family == .accessoryCircular { Color.clear } else { VelvetBackground() }
      }
  }

  @ViewBuilder private var content: some View {
    if family == .accessoryCircular {
      if let data = entry.data {
        Gauge(value: Double(min(max(data.percent, 0), 100)), in: 0...100) {
          Text(L.t("blend"))
        } currentValueLabel: {
          Text("%\(data.percent)").font(SalonFont.marquee(17))
        }
        .gaugeStyle(.accessoryCircular)
        .widgetURL(PellixLinks.blend(data))
      } else {
        ZStack {
          AccessoryWidgetBackground()
          Image(systemName: "person.2").font(.system(size: 18))
        }
        .widgetURL(PellixLinks.blends)
      }
    } else if let data = entry.data {
      if family == .systemMedium {
        BlendMedium(data: data, posters: entry.posters)
      } else {
        BlendSmall(data: data)
      }
    } else {
      BlendEmpty()
    }
  }
}

struct BlendWidget: Widget {
  let kind = "PellixBlend"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: BlendProvider()) { entry in
      BlendWidgetView(entry: entry)
    }
    .configurationDisplayName("Blend")
    .description("Arkadaşınla beğeni uyumunuz ve birlikte izleyebilecekleriniz.")
    .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular])
    .contentMarginsDisabled()
  }
}

@main
struct PellixWidgets: WidgetBundle {
  var body: some Widget {
    SeansWidget()
    BlendWidget()
  }
}
