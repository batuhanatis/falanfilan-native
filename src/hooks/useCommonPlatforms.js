import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { COMMON_PLATFORMS } from "../theme/theme";

const PLATFORM_CACHE_KEY = "@pellix/platform-catalog-v1";
let platformMemoryCache = null;

const PLATFORM_ALIASES = {
  netflix: "Netflix",
  "amazon prime video": "Amazon Prime Video",
  "prime video": "Amazon Prime Video",
  "disney+": "Disney Plus",
  "disney plus": "Disney Plus",
  blutv: "BluTV",
  "blu tv": "BluTV",
  exxen: "Exxen",
  gain: "Gain",
  mubi: "MUBI",
  "apple tv+": "Apple TV Plus",
  "apple tv plus": "Apple TV Plus",
  "hbo max": "HBO Max",
  max: "HBO Max",
};

function canonicalPlatformName(name) {
  const normalized = String(name || "").trim().toLocaleLowerCase("tr-TR");
  return PLATFORM_ALIASES[normalized] || String(name || "").trim();
}

function mapCommonPlatforms(results = []) {
  const byName = new Map();
  for (const platform of results) {
    const canonicalName = canonicalPlatformName(platform?.name);
    const canonicalSourceName = canonicalPlatformName(platform?.source_name);
    if (platform?.logo) {
      byName.set(canonicalName, platform.logo);
      byName.set(canonicalSourceName, platform.logo);
    }
  }
  return COMMON_PLATFORMS.map((name) => ({
    name,
    logo: byName.get(canonicalPlatformName(name)) || null,
  }));
}

const EMPTY_PLATFORMS = mapCommonPlatforms();

// Platform kataloğu içerik cache'inden bağımsızdır. İlk başarılı istekten sonra hem bellekte
// hem AsyncStorage'da tutulur; sonraki ekranlarda ve uygulama açılışlarında logolar anında gelir.
// API çağrısı yalnızca arka planda kataloğu tazeler.
export function useCommonPlatforms() {
  const { auth } = useAuth();
  const [platforms, setPlatforms] = useState(platformMemoryCache || EMPTY_PLATFORMS);

  useEffect(() => {
    let cancelled = false;

    async function loadPlatforms() {
      try {
        if (!platformMemoryCache) {
          const cached = await AsyncStorage.getItem(PLATFORM_CACHE_KEY);
          if (cached) {
            const parsed = JSON.parse(cached);
            const mapped = mapCommonPlatforms(parsed?.results);
            if (mapped.some((platform) => platform.logo)) {
              platformMemoryCache = mapped;
              if (!cancelled) setPlatforms(mapped);
            }
          }
        }

        if (!auth.token) return;
        const data = await api.platforms(auth.token);
        const mapped = mapCommonPlatforms(data?.results);
        if (!mapped.some((platform) => platform.logo)) return;

        platformMemoryCache = mapped;
        if (!cancelled) setPlatforms(mapped);
        await AsyncStorage.setItem(
          PLATFORM_CACHE_KEY,
          JSON.stringify({ results: data.results, cachedAt: Date.now() })
        );
      } catch {
        // Ağ veya bozuk cihaz cache'i durumunda bellekteki son başarılı katalog korunur.
      }
    }

    loadPlatforms();
    return () => {
      cancelled = true;
    };
  }, [auth.token]);

  return platforms;
}
