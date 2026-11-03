package expo.modules.platformlauncher

import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Platform uygulamalarını (Netflix, Disney+ ...) TV'de açmak için. Hazır intent paketi linki
// belirli bir uygulamaya yönlendiremiyor ve yalnızca TV'de bulunan uygulamaların (Leanback)
// başlangıç ekranını bulamıyor; ikisini burada yapıyoruz.
class PlatformLauncherModule : Module() {
  private val packageManager: PackageManager
    get() = requireNotNull(appContext.reactContext).packageManager

  override fun definition() = ModuleDefinition {
    Name("PlatformLauncher")

    // Linki yalnızca verilen platform paketlerinde açar. Sistemin seçtiği uygulamaya (tarayıcıya)
    // düşmüyoruz: Google Play TV kuralı tarayıcı açılmasını yasaklıyor (TV-WB); paket linki
    // açamazsa JS tarafı platform uygulamasını ana ekranında açıyor.
    // Dönüş: "package:<ad>" ya da açılamadıysa null.
    Function("openUrl") { url: String, packages: List<String>, extras: Map<String, String> ->
      val activity = appContext.throwingActivity
      for (pkg in packages) {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).setPackage(pkg)
        extras.forEach { (key, value) -> intent.putExtra(key, value) }
        if (intent.resolveActivity(packageManager) != null) {
          activity.startActivity(intent)
          return@Function "package:$pkg"
        }
      }
      null
    }

    // Uygulamayı ana ekranında açar; TV'ye özel uygulamalar için Leanback başlangıcı önce denenir.
    Function("openApp") { packages: List<String> ->
      for (pkg in packages) {
        val intent = packageManager.getLeanbackLaunchIntentForPackage(pkg)
          ?: packageManager.getLaunchIntentForPackage(pkg)
        if (intent != null) {
          appContext.throwingActivity.startActivity(intent)
          return@Function pkg
        }
      }
      null
    }

    // Verilen paketlerden hangilerinin bu cihazda yüklü olduğu.
    Function("installed") { packages: List<String> ->
      packages.filter { pkg ->
        try {
          packageManager.getPackageInfo(pkg, 0)
          true
        } catch (e: PackageManager.NameNotFoundException) {
          false
        }
      }
    }
  }
}
