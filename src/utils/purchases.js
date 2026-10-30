import Purchases from "react-native-purchases";
import { Platform } from "react-native";

// ÖNEMLİ: Android anahtarı eas.json'daki build profillerinin "env" alanında duruyor — ama
// "eas update" (OTA) build profilinin env'ini OKUMUYOR, sadece --environment ile EAS'taki
// ortam değişkenlerini alıyor. Android anahtarı orada olmadığı için her OTA paketinde
// undefined kalıyor, RevenueCat hiç yapılandırılmıyor ve Android'de Premium ekranı
// "Şu an kullanılamıyor" gösteriyordu. RevenueCat'in "goog_" SDK anahtarı uygulamaya gömülmek
// için tasarlanmış herkese açık bir anahtar (gizli değil, zaten eas.json'da da açık), bu yüzden
// env gelmezse buradaki değere düşüyoruz. Anahtar olmayan bir platformda yine yapılandırma
// yapmadan devam ediyoruz (çökmesin diye) — orada satın alma ekranı "şu an kullanılamıyor" gösterir.
const REVENUECAT_API_KEYS = {
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || "goog_onoNWVFZmxVZzlZSlBBWatYEfXn",
};

let configured = false;

// ÖNEMLİ: appUserID'yi bizim kendi kullanıcı ID'mize (backend'deki users.id) eşitliyoruz —
// RevenueCat webhook'u bize olay gönderirken bu ID'yi "app_user_id" olarak geri veriyor, backend
// bununla HANGİ kullanıcının premium_until'ını güncelleyeceğini biliyor. Bu eşleşme olmazsa
// webhook hiçbir işe yaramaz.
export function configurePurchases(userId) {
  const apiKey = REVENUECAT_API_KEYS[Platform.OS];
  if (!apiKey || !userId) return;
  if (configured) {
    Purchases.logIn(String(userId)).catch(() => {});
    return;
  }
  Purchases.configure({ apiKey, appUserID: String(userId) });
  configured = true;
}

// Hesap değiştirirken eski RevenueCat kimliğinin/entitlement önbelleğinin yeni kullanıcıya
// kısa süreliğine taşınmaması için logout'un gerçekten tamamlanmasını bekleyebiliyoruz.
export async function logoutPurchases() {
  if (!configured) return;
  try {
    await Purchases.logOut();
  } catch {
    // Satın alma SDK'sındaki temizlik hatası, uygulamanın çıkış yapmasını engellememeli.
  }
}

export async function getCurrentOffering() {
  const offerings = await Purchases.getOfferings();
  return offerings.current || null;
}

export async function purchasePackage(pkg) {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

export async function restorePurchases() {
  const customerInfo = await Purchases.restorePurchases();
  return customerInfo;
}

// "premium" Entitlement'ının o an aktif olup olmadığını RevenueCat'in kendi (cihazda
// önbelleklenen) verisinden anında kontrol ediyor — backend'e gitmeden hızlı bir ön kontrol için.
export function hasActivePremiumEntitlement(customerInfo) {
  return !!customerInfo?.entitlements?.active?.premium;
}
