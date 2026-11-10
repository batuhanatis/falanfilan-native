import Foundation
import SwiftUI
import UIKit

// Uygulama (src/widgets/homeWidgets.js) App Group'taki UserDefaults'a JSON metinleri yazıyor:
//   "seans"      günün seçkisi (en çok 10 içerik)
//   "seansIndex" panoda gösterilen sıra (Sıradaki düğmesi artırır; sayıya eşitse "pano bitti")
//   "blend"      son bakılan Blend (arkadaş, uyum, birlikte izlenebilecekler)
//   "labels"     uygulamanın dilinde etiketler (yoksa Türkçe varsayılanlar)
let pellixAppGroup = "group.com.batuhanatis.pellix"

struct SeansItem: Codable, Hashable, Identifiable {
  let id: Int
  let title: String
  let board: String
  let meta: String
  let reason: String?
  let overview: String?
  let imdb: String?
  let poster: String?

  var shortMeta: String {
    meta.components(separatedBy: " · ").prefix(2).joined(separator: " · ")
  }

  static let sample = SeansItem(
    id: 0, title: "Bu akşamın filmi", board: "BU AKŞAMIN FİLMİ", meta: "DRAM · 106 DK · 2024",
    reason: "Beğendiklerine göre seçilir; her gün yenilenir.", overview: nil, imdb: nil, poster: nil)
}

struct SeansData: Codable {
  let dayKey: String?
  let items: [SeansItem]
}

struct BlendFilm: Codable, Hashable, Identifiable {
  let id: Int
  let title: String
  let poster: String?
}

struct BlendData: Codable {
  let friendId: Int
  let me: String
  let friend: String
  let percent: Int
  let films: [BlendFilm]
}

enum PellixStore {
  static var defaults: UserDefaults? { UserDefaults(suiteName: pellixAppGroup) }

  static func decode<T: Decodable>(_ key: String, as type: T.Type) -> T? {
    guard let text = defaults?.string(forKey: key), let data = text.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(T.self, from: data)
  }

  static func seans() -> SeansData? { decode("seans", as: SeansData.self) }
  static func blend() -> BlendData? { decode("blend", as: BlendData.self) }

  static var seansIndex: Int {
    get { defaults?.integer(forKey: "seansIndex") ?? 0 }
    set { defaults?.set(newValue, forKey: "seansIndex") }
  }
}

// Etiketler: uygulama kendi dilinde yazıyor; ilk kurulumda (veri yokken) Türkçe kalıyor.
enum L {
  private static let defaults: [String: String] = [
    "tonight": "BU AKŞAM SENİN İÇİN",
    "tonightShort": "BU AKŞAM",
    "upcoming": "SIRADAKİ SEANSLAR",
    "next": "Sıradaki",
    "restart": "Baştan",
    "discover": "Keşfet'e git",
    "emptyBoard": "5 AFİŞ BEĞEN",
    "emptyMeta": "PANO HENÜZ BOŞ",
    "emptyText": "Panon beğendiklerinle kurulur. Keşfet'te 5 afiş beğen, ilk seansın gelsin.",
    "doneBoard": "YARIN YENİ PANO",
    "doneMeta": "BUGÜNÜN PANOSU TAMAM",
    "doneText": "{0} seçimin hepsine baktın. Yeni pano yarın hazır.",
    "ofCount": "{0} SEÇİMDEN {1}.",
    "inline": "Bu akşam: {0}",
    "inlineEmpty": "Pellix: panon hazırlanıyor",
    "seans": "SEANS",
    "blend": "BLEND",
    "blendScore": "BEĞENİ UYUMU",
    "together": "BİRLİKTE İZLEYİN",
    "togetherNote": "İkinizin beğendiklerinden; henüz izlemediğiniz.",
    "blendEmpty": "Bir arkadaşınla Blend'e bak; uyumunuz burada dursun.",
    "lang": "tr",
  ]
  // Her çizimde yeniden okunuyor: eklenti süreci uzun yaşayabilir, dil değişince eski kalmasın.
  private static var stored: [String: String] {
    guard let text = PellixStore.defaults?.string(forKey: "labels"), let data = text.data(using: .utf8),
          let map = try? JSONDecoder().decode([String: String].self, from: data) else { return [:] }
    return map
  }

  static func t(_ key: String, _ args: String...) -> String {
    var text = stored[key] ?? defaults[key] ?? key
    for (i, arg) in args.enumerated() { text = text.replacingOccurrences(of: "{\(i)}", with: arg) }
    return text
  }

  static var locale: Locale { Locale(identifier: t("lang") == "en" ? "en_US" : "tr_TR") }
  static func upper(_ text: String) -> String { text.uppercased(with: locale) }
}

enum PellixLinks {
  static func film(_ id: Int) -> URL { URL(string: "pellix://film/\(id)") ?? discover }
  static let discover = URL(string: "pellix://kesfet")!
  static let blends = URL(string: "pellix://widget/blendler")!
  static func blend(_ data: BlendData) -> URL {
    var parts = URLComponents()
    parts.scheme = "pellix"
    parts.host = "widget"
    parts.path = "/blend/\(data.friendId)"
    parts.queryItems = [URLQueryItem(name: "ad", value: data.friend)]
    return parts.url ?? blends
  }
}

// Afişler widget içinde eşzamanlı indirilemiyor: zaman çizelgesi kurulurken indirip küçültüyor,
// App Group'ta önbelleğe alıyoruz (widget belleği sınırlı).
enum PosterLoader {
  private static var folder: URL? {
    guard let base = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: pellixAppGroup) else { return nil }
    let dir = base.appendingPathComponent("widget-posters", isDirectory: true)
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    return dir
  }

  private static func cacheFile(for url: URL) -> URL? {
    let name = (url.host ?? "") + url.path.replacingOccurrences(of: "/", with: "_")
    return folder?.appendingPathComponent(name)
  }

  static func image(_ string: String?, box: CGSize = CGSize(width: 220, height: 330)) async -> UIImage? {
    guard let string, let url = URL(string: string) else { return nil }
    if let file = cacheFile(for: url), let data = try? Data(contentsOf: file), let cached = UIImage(data: data) {
      return cached
    }
    var request = URLRequest(url: url)
    request.timeoutInterval = 8
    guard let response = try? await URLSession.shared.data(for: request), let image = UIImage(data: response.0) else { return nil }
    let small = image.preparingThumbnail(of: fit(image.size, in: box)) ?? image
    if let file = cacheFile(for: url), let jpeg = small.jpegData(compressionQuality: 0.85) {
      try? jpeg.write(to: file)
      prune()
    }
    return small
  }

  private static func fit(_ size: CGSize, in box: CGSize) -> CGSize {
    guard size.width > 0, size.height > 0 else { return box }
    let scale = min(box.width / size.width, box.height / size.height, 1)
    return CGSize(width: (size.width * scale).rounded(), height: (size.height * scale).rounded())
  }

  // Önbellek en çok 60 afiş; en eskiler silinir.
  private static func prune() {
    guard let folder, let files = try? FileManager.default.contentsOfDirectory(
      at: folder, includingPropertiesForKeys: [.contentModificationDateKey]) else { return }
    guard files.count > 60 else { return }
    let sorted = files.sorted {
      let a = (try? $0.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast
      let b = (try? $1.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast
      return a < b
    }
    for file in sorted.prefix(files.count - 60) { try? FileManager.default.removeItem(at: file) }
  }
}
