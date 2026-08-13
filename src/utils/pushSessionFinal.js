import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { api } from "../api/client";

const KEY = "ff_expo_push_token";
const LOGOUT_UNREGISTER_WAIT_MS = 2500;

async function resolvePushToken() {
  const cached = await AsyncStorage.getItem(KEY);
  if (cached) return cached;
  if (!Device.isDevice) return null;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return null;
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data || null;
  } catch {
    return null;
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function clearPushSession(sessionToken) {
  try {
    const value = await resolvePushToken();
    if (sessionToken && value) {
      await Promise.race([
        api.unregisterPushToken(sessionToken, value).catch(() => {}),
        delay(LOGOUT_UNREGISTER_WAIT_MS),
      ]);
    }
  } finally {
    // Offline logoutta backend'e ulaşamasak bile cihazın APNs/FCM kaydını keserek eski hesaba
    // ait push'ların bu telefonda görünmesini engelliyoruz. Sonraki login normal register akışını
    // yeniden çalıştırır.
    await Notifications.unregisterForNotificationsAsync().catch(() => {});
    await AsyncStorage.removeItem(KEY).catch(() => {});
    await Notifications.dismissAllNotificationsAsync().catch(() => {});
    await Notifications.setBadgeCountAsync(0).catch(() => {});
  }
}
