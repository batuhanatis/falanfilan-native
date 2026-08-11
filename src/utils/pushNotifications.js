import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { api } from "../api/client";

// Bildirim uygulama AÇIKKEN gelirse sistem bildirimi (banner) GÖSTERME — bunun yerine
// WebSocket üzerinden gelen aynı olayı kendi uygulama-içi popup'larımızla gösteriyoruz
// (bkz. GlobalPopups.js). Uygulama arka plandayken/kapalıyken normal push bildirimi
// gösterilmeye devam ediyor, bu sadece "uygulama zaten açık" durumunu kapsıyor.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Uygulama her açıldığında, daha önce cihaza gönderilmiş (henüz görülmemiş) bildirimleri
// bildirim merkezinden ve rozet sayacından temizliyoruz — kullanıcı uygulamayı açtığı an
// zaten en güncel bilgiyi (bildirimler ekranı, sohbetler vb.) görüyor, eski push'ların
// bildirim merkezinde birikmesine gerek yok.
export async function clearDeliveredNotifications() {
  try {
    await Notifications.dismissAllNotificationsAsync();
    await Notifications.setBadgeCountAsync(0);
  } catch { /* sessizce geç — kritik değil */ }
}

// Uygulama açılışında (giriş yapılmışken) çağrılır — izin ister, Expo push jetonunu alır,
// backend'e kaydeder. Kritik değil, başarısız olursa uygulama akışını bozmaz — ama artık
// hatayı en azından konsola yazıyoruz (eskiden tamamen sessizce yutuluyordu, bu yüzden
// "projectId bulunamadı" gibi bir sorun fark edilmeden geçiyordu).
export async function registerForPushNotifications(authToken) {
  try {
    if (!Device.isDevice) return; // simülatörde push jetonu alınamaz

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      console.warn("[push] Kullanıcı bildirim iznini reddetti.");
      return;
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    // Expo push jetonu almak için bir EAS proje kimliği gerekiyor — henüz "eas init"
    // çalıştırılmadıysa (EAS Build'e başlamadan önce bile bu adım gerekiyor) bu değer boş
    // olur ve jeton alınamaz.
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.warn("[push] EAS projectId bulunamadı — önce 'eas init' çalıştırman gerekiyor, push jetonu alınamadı.");
      return;
    }

    const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (expoPushToken) {
      await api.registerPushToken(authToken, expoPushToken);
      console.log("[push] Jeton kaydedildi:", expoPushToken);
    }
  } catch (e) {
    console.warn("[push] Kayıt başarısız:", e.message);
  }
}

// Bir push bildirimine TIKLANINCA (uygulama açık/arka planda/tamamen kapalıyken hepsi dahil)
// doğru ekrana yönlendirmek için — backend'in her bildirime eklediği data.screen/data.params'ı
// okuyup verilen callback'e iletiyor, geri kalan (hangi ekran, hangi parametre) mantığı
// tamamen backend'de (pushNavTarget fonksiyonu) merkezi olarak tutuluyor.
export function setupNotificationTapHandling(onNavTarget) {
  // Uygulama açık/arka plandayken bir bildirime tıklanması.
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification?.request?.content?.data;
    if (data?.screen) onNavTarget(data);
  });

  // Uygulama TAMAMEN KAPALIYKEN bir bildirime dokunularak açılması (soğuk başlangıç) — canlı
  // dinleyici bunu YAKALAYAMIYOR, ayrıca kontrol etmek gerekiyor.
  Notifications.getLastNotificationResponseAsync().then((response) => {
    const data = response?.notification?.request?.content?.data;
    if (data?.screen) onNavTarget(data);
  }).catch(() => {});

  return () => subscription.remove();
}
