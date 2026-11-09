import ExpoModulesCore
import UIKit

// Instagram "Sharing to Stories": görsel UIPasteboard'a Instagram'ın anahtarlarıyla yazılıyor,
// ardından instagram-stories://share?source_application=<Meta App ID> açılıyor; Instagram story
// düzenleyicisi görselle açılıyor. Info.plist LSApplicationQueriesSchemes'te "instagram-stories"
// zaten var (app.json). Meta App ID JS tarafından geliyor (src/utils/instagramStories.js).
struct StoryOptions: Record {
  @Field var appId: String = ""
  @Field var backgroundImage: String = ""
  @Field var topColor: String = "#100e10"
  @Field var bottomColor: String = "#100e10"
}

public class InstagramStoriesModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PellixInstagramStories")

    AsyncFunction("isAvailable") { () -> Bool in
      guard let url = URL(string: "instagram-stories://share") else { return false }
      return UIApplication.shared.canOpenURL(url)
    }.runOnQueue(.main)

    AsyncFunction("shareToStory") { (options: StoryOptions, promise: Promise) in
      guard !options.appId.isEmpty,
            let url = URL(string: "instagram-stories://share?source_application=\(options.appId)"),
            UIApplication.shared.canOpenURL(url) else {
        promise.resolve(false)
        return
      }
      let raw = options.backgroundImage
      let fileUrl = raw.hasPrefix("file://") ? URL(string: raw) : URL(fileURLWithPath: raw)
      guard let fileUrl = fileUrl, let data = try? Data(contentsOf: fileUrl) else {
        promise.resolve(false)
        return
      }
      let items: [[String: Any]] = [[
        "com.instagram.sharedSticker.backgroundImage": data,
        "com.instagram.sharedSticker.backgroundTopColor": options.topColor,
        "com.instagram.sharedSticker.backgroundBottomColor": options.bottomColor,
      ]]
      // Görsel panoda 5 dakika kalıyor; Instagram açılınca okuyor.
      UIPasteboard.general.setItems(items, options: [.expirationDate: Date().addingTimeInterval(300)])
      UIApplication.shared.open(url, options: [:]) { opened in
        promise.resolve(opened)
      }
    }.runOnQueue(.main)
  }
}
