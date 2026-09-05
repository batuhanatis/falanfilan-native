from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)

# Auth: restore the cached session first, then validate it in the background.
auth_path = Path("src/context/AuthContext.js")
auth = auth_path.read_text()
old_boot = '''  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (!token) { setChecking(false); return; }

      let cached = null;
      try {
        const raw = await AsyncStorage.getItem(USER_CACHE_KEY);
        cached = raw ? JSON.parse(raw) : null;
      } catch { /* bozuk cache varsa ağ doğrulamasına devam et */ }

      try {
        const me = await api.me(token);
        const next = toAuth(token, me, { offline: false });
        setAuth(next);
        await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(snapshotOf(next)));
      } catch (e) {
        if (e?.status === 401 || e?.status === 403) {
          await AsyncStorage.multiRemove([TOKEN_KEY, USER_CACHE_KEY]);
        } else if (cached?.id) {
          setAuth({ ...cached, token, offline: true });
        }
      } finally {
        setChecking(false);
      }
    })();
  }, []);
'''
new_boot = '''  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Cold start must not wait for Render/network. Read token + user snapshot in a single
      // AsyncStorage bridge roundtrip and restore the last known session immediately.
      let token = null;
      let cached = null;
      try {
        const [[, storedToken], [, rawSnapshot]] = await AsyncStorage.multiGet([TOKEN_KEY, USER_CACHE_KEY]);
        token = storedToken || null;
        cached = rawSnapshot ? JSON.parse(rawSnapshot) : null;
      } catch {
        // Local storage itself failed: fall through to the signed-out screen rather than
        // trapping the user behind a boot loader.
      }

      if (cancelled) return;
      if (!token) {
        setChecking(false);
        return;
      }

      if (cached?.id) {
        // Stale-while-revalidate: the cached identity is enough to mount the real app. Network
        // validation happens behind the already-visible UI, so a slow/cold backend can no longer
        // create a second splash/loading screen after the intro animation.
        setAuth({ ...cached, token, offline: false });
        setChecking(false);

        try {
          const me = await api.me(token);
          if (cancelled) return;
          const next = toAuth(token, me, { offline: false });
          setAuth(next);
          AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(snapshotOf(next))).catch(() => {});
        } catch (e) {
          if (cancelled) return;
          if (e?.status === 401 || e?.status === 403) {
            await AsyncStorage.multiRemove([TOKEN_KEY, USER_CACHE_KEY]);
            if (!cancelled) setAuth(null);
          } else {
            setAuth((current) => current?.token === token ? { ...current, offline: true } : current);
          }
        }
        return;
      }

      // Migration/edge case: a token exists but an older install has no snapshot yet. There is no
      // safe route to mount without knowing onboarding flags, so validate once and then create the
      // snapshot. Normal subsequent launches use the instant cache-first path above.
      try {
        const me = await api.me(token);
        if (cancelled) return;
        const next = toAuth(token, me, { offline: false });
        setAuth(next);
        AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(snapshotOf(next))).catch(() => {});
      } catch (e) {
        if (e?.status === 401 || e?.status === 403) {
          await AsyncStorage.multiRemove([TOKEN_KEY, USER_CACHE_KEY]);
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);
'''
auth = replace_once(auth, old_boot, new_boot, "AuthContext boot effect")
auth_path.write_text(auth)

# App: the 1.6s branded intro is the only startup cover. Fonts load in parallel and no pulsing
# logo is allowed to appear after the intro.
app_path = Path("App.js")
app = app_path.read_text()
app = replace_once(
    app,
    'import { View, AppState, Animated, Easing, Image, StyleSheet } from "react-native";',
    'import { View, AppState, StyleSheet } from "react-native";',
    "App react-native imports",
)
loading_start = app.index('// İçerik/oturum kontrolü sürerken gösterilen logo')
loading_end = app.index('const PUSH_PRIMER_DISMISSED_KEY', loading_start)
app = app[:loading_start] + app[loading_end:]
app = replace_once(app, 'function Gate({ fontsLoaded }) {', 'function Gate() {', 'Gate props')
app = replace_once(app, '  const appReady = fontsLoaded && !checking;', '  const appReady = !checking;', 'appReady gate')
app = replace_once(
    app,
    '''      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.bg }}>
          <LoadingLogo />
        </View>
      )}''',
    '''      ) : (
        <View style={{ flex: 1, backgroundColor: c.bg }} />
      )}''',
    "loading logo fallback",
)
app = replace_once(
    app,
    '''  // "pellix" markasının her yerde kullandığı eğlenceli, yuvarlak font (Baloo 2) — logo,
  // giriş ekranı gibi marka gösterimlerinde kullanılıyor. Splash artık font yüklenmesini
  // beklemiyor; Gate fontlar hazır olana kadar gerçek ekranı altta LoadingLogo ile tutuyor.
  const [fontsLoaded] = useFonts({ Baloo2_700Bold, Baloo2_800ExtraBold });''',
    '''  // Baloo 2 uygulamayla birlikte yüklenmeye devam ediyor ama cold-start kritik yolunu
  // bloklamıyor. Intro bittiğinde navigasyon açılır; font hazır değilse o ilk karede sistem
  // fontu kullanılır ve hook tamamlandığında normal marka fontuna geçilir.
  useFonts({ Baloo2_700Bold, Baloo2_800ExtraBold });''',
    "font loading comment",
)
app = replace_once(app, '<Gate fontsLoaded={fontsLoaded} />', '<Gate />', 'Gate call')
app_path.write_text(app)

print("startup boot patch applied")
