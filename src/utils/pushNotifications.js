import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { api } from "../api/client";

// Uygulama açıkken sistem banner'ı göstermiyoruz; aynı olay normalde WebSocket üzerinden
// uygulama-içi UI'a düşüyor. WebSocket kısa süreli kopuksa verinin tamamen kaçmaması için
// aşağıda ayrıca foreground notification listener'ı sunuyoruz.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Sistem izin diyaloğunu TETİKLEMEDEN mevcut durumu okur — "granted" | "denied" | "undetermined"
// | "unsupported" (simülatör/emülatör). Gate() bunu, kullanıcıya önce KENDİ ekranımızda
// (NotificationPrimerModal) sorup sorulmayacağına karar vermek için kullanıyor: "undetermined"
// dışındaki durumlarda sistem diyaloğu zaten ya cevaplanmış ya da bu cihazda mümkün değil,
// gösterecek bir şey yok.
export async function getPushPermissionStatus() {
  if (!Device.isDevice) return "unsupported";
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

export async function clearDeliveredNotifications() {
  try {
    await Notifications.dismissAllNotificationsAsync();
    await Notifications.setBadgeCountAsync(0);
  } catch { /* kritik değil */ }
}

export async function registerForPushNotifications(authToken) {
  try {
    if (!Device.isDevice) return;

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

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.warn("[push] EAS projectId bulunamadı — push jetonu alınamadı.");
      return;
    }

    const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (expoPushToken) {
      await api.registerPushToken(authToken, expoPushToken);
      console.log("[push] Jeton kaydedildi.");
    }
  } catch (e) {
    console.warn("[push] Kayıt başarısız:", e.message);
  }
}

// Uygulama foreground'dayken gelen push'ı dinlemek için. Sistem banner'ı kapalı olduğu için bu
// listener WebSocket'in o anda kopuk olduğu durumda veriyi tazelemek için güvenlik ağı görevi görür.
export function setupForegroundNotificationHandling(onNotification) {
  const subscription = Notifications.addNotificationReceivedListener((notification) => {
    const data = notification?.request?.content?.data || {};
    onNotification?.(data);
  });
  return () => subscription.remove();
}

export function setupNotificationTapHandling(onNavTarget) {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification?.request?.content?.data;
    if (data?.screen) onNavTarget(data);
  });

  Notifications.getLastNotificationResponseAsync().then((response) => {
    const data = response?.notification?.request?.content?.data;
    if (data?.screen) onNavTarget(data);
  }).catch(() => {});

  return () => subscription.remove();
}
