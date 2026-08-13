import Purchases from "react-native-purchases";
import { Platform } from "react-native";

// ÖNEMLİ: Şu an sadece iOS (App Store) anahtarımız var — Android/Play Store tarafını
// kurduğumuzda buraya EXPO_PUBLIC_REVENUECAT_ANDROID_KEY eklenecek. iOS DIŞINDA bir platformda
// hiç yapılandırma yapmadan devam ediyoruz (çökmesin diye) — o platformda satın alma ekranı
// "şu an kullanılamıyor" gösterecek.
const REVENUECAT_API_KEYS = {
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
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

// ÖNEMLİ: configurePurchases hiçbir zaman bir karşılığı (logOut) olmadan sadece logIn
// çağırıyordu — hesap değiştirildiğinde RevenueCat SDK'sının cihazda önbellekte tuttuğu bir
// önceki kullanıcının entitlement bilgisi kısa süreliğine yeni kullanıcıya sızabiliyordu.
// Logout sırasında çağrılır.
export function logoutPurchases() {
  if (!configured) return;
  Purchases.logOut().catch(() => {});
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
