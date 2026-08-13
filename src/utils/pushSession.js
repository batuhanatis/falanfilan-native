import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { api } from "../api/client";

const KEY = "ff_expo_push_token";

export async function rememberPushToken(value) {
  if (value) await AsyncStorage.setItem(KEY, value);
}

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

export async function clearPushSession(sessionToken) {
  try {
    const value = await resolvePushToken();
    if (sessionToken && value) await api.unregisterPushToken(sessionToken, value).catch(() => {});
  } finally {
    await AsyncStorage.removeItem(KEY).catch(() => {});
    await Notifications.dismissAllNotificationsAsync().catch(() => {});
    await Notifications.setBadgeCountAsync(0).catch(() => {});
  }
}
