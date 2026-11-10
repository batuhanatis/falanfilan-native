import { requireOptionalNativeModule } from "expo";

// Instagram Story'ye doğrudan paylaşım. Asıl iş yerel modülde (modules/instagram-stories):
// iOS'ta görsel Instagram'ın pano anahtarlarına yazılıp instagram-stories:// açılıyor, Android'de
// com.instagram.share.ADD_TO_STORY gönderiliyor; Instagram story düzenleyicisi kartla açılıyor.
// Modül yalnızca onu içeren mağaza sürümlerinde var; eski sürümlerde null döner ve çağıran
// genel paylaşım menüsüne düşer.
//
// Instagram bu paylaşım için bir Meta (Facebook) App ID istiyor; gizli bir değer değil.
// Boşken doğrudan paylaşım kapalı (Instagram ID'siz isteği hata ile reddediyor).
export const FACEBOOK_APP_ID = "2384410689040251";

let cached;
function nativeModule() {
  if (cached !== undefined) return cached;
  try {
    cached = requireOptionalNativeModule("PellixInstagramStories");
  } catch {
    cached = null;
  }
  return cached;
}

// Doğrudan paylaşım bu cihazda mümkün mü (modül var, App ID tanımlı, Instagram yüklü)?
// Yerel taraf ana iş parçacığında baktığı için asenkron.
export async function canShareToStoryDirect() {
  const mod = nativeModule();
  if (!mod || !FACEBOOK_APP_ID) return false;
  try {
    return !!(await mod.isAvailable());
  } catch {
    return false;
  }
}

// imageUri: ViewShot'un yazdığı yerel PNG (file://). true: Instagram açıldı.
export async function shareToStoryDirect(imageUri, { topColor = "#100e10", bottomColor = "#100e10" } = {}) {
  const mod = nativeModule();
  if (!mod || !FACEBOOK_APP_ID) return false;
  return !!(await mod.shareToStory({ appId: FACEBOOK_APP_ID, backgroundImage: imageUri, topColor, bottomColor }));
}
