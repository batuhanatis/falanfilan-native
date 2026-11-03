import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";

// Android dışında (ör. önizleme) modül yok; çağıranlar null dönüşü "açılamadı" sayıyor.
const Native = Platform.OS === "android" ? requireOptionalNativeModule("PlatformLauncher") : null;

export function openUrl(url, packages = [], extras = {}) {
  return Native ? Native.openUrl(url, packages, extras) : null;
}

export function openApp(packages = []) {
  return Native ? Native.openApp(packages) : null;
}

export function installed(packages = []) {
  return Native ? Native.installed(packages) : [];
}
