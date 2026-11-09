package expo.modules.instagramstories

import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import androidx.core.content.FileProvider
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.File

// Ayrı bir alt sınıf: başka kütüphanelerin androidx FileProvider tanımlarıyla manifest çakışmasın.
class InstagramStoriesFileProvider : FileProvider()

class StoryOptions : Record {
  @Field val appId: String = ""
  @Field val backgroundImage: String = ""
  @Field val topColor: String = "#100e10"
  @Field val bottomColor: String = "#100e10"
}

// Instagram "Sharing to Stories" (Android): com.instagram.share.ADD_TO_STORY niyetine görselin
// content:// adresi ve Meta App ID (source_application) veriliyor; Instagram story düzenleyicisi
// görselle açılıyor. Paket görünürlüğü için <queries> com.instagram.android zaten ekli
// (plugins/withAndroidInstagramQueries.js).
class InstagramStoriesModule : Module() {
  private val instagramPackage = "com.instagram.android"

  override fun definition() = ModuleDefinition {
    Name("PellixInstagramStories")

    AsyncFunction("isAvailable") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      try {
        context.packageManager.getPackageInfo(instagramPackage, 0)
        true
      } catch (e: PackageManager.NameNotFoundException) {
        false
      }
    }

    AsyncFunction("shareToStory") { options: StoryOptions ->
      val activity = appContext.currentActivity ?: return@AsyncFunction false
      if (options.appId.isEmpty() || options.backgroundImage.isEmpty()) return@AsyncFunction false
      val path = Uri.parse(options.backgroundImage).path ?: options.backgroundImage
      val file = File(path)
      if (!file.exists()) return@AsyncFunction false
      val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.pellixinstagramstories", file)
      val intent = Intent("com.instagram.share.ADD_TO_STORY").apply {
        putExtra("source_application", options.appId)
        setDataAndType(uri, "image/png")
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        putExtra("top_background_color", options.topColor)
        putExtra("bottom_background_color", options.bottomColor)
        setPackage(instagramPackage)
      }
      activity.grantUriPermission(instagramPackage, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
      if (intent.resolveActivity(activity.packageManager) == null) return@AsyncFunction false
      activity.startActivity(intent)
      true
    }.runOnQueue(Queues.MAIN)
  }
}
