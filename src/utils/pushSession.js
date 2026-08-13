import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { api } from "../api/client";

const KEY = "ff_expo_push_token";

export async function rememberPushToken(value) {
  if (value) await AsyncStorage.setItem(KEY, value);
}

export async function clearPushSession(sessionToken) {
  try {
    const value = await AsyncStorage.getItem(KEY);
    if (sessionToken && value) await api.unregisterPushToken(sessionToken, value).catch(() => {});
  } finally {
    await AsyncStorage.removeItem(KEY).catch(() => {});
    await Notifications.dismissAllNotificationsAsync().catch(() => {});
    await Notifications.setBadgeCountAsync(0).catch(() => {});
  }
}
