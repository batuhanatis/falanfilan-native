import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../api/client";
import { clearPrefetchCache } from "../utils/chatMessagesPrefetch";
import { clearAllLocalMessages } from "../utils/chatDb";
import { clearLocalChatList } from "../utils/chatListDb";
import { logoutPurchases } from "../utils/purchases";
import { clearPushSession } from "../utils/pushSession";

const AuthContext = createContext(null);
const TOKEN_KEY = "ff_token";
const USER_CACHE_KEY = "ff_user_snapshot";

function toAuth(token, me, extra = {}) {
  return {
    token,
    id: me.id,
    name: me.name,
    username: me.username,
    email: me.email,
    likeCount: me.likeCount,
    onboardingCompleted: me.onboardingCompleted,
    tutorialSeen: me.tutorialSeen,
    tasteSurveySeen: me.tasteSurveySeen,
    ...extra,
  };
}

function snapshotOf(value) {
  if (!value) return null;
  const { token, offline, ...snapshot } = value;
  return snapshot;
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
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
          // Geçici ağ/500/timeout durumunda kullanıcıyı login ekranına atmak yerine son doğrulanmış
          // kimlik snapshot'ıyla uygulamayı aç. Sunucu gerektiren işlemler doğal olarak bağlantı
          // düzelene kadar hata verebilir; aşağıdaki effect oturumu arka planda yeniden doğrular.
          setAuth({ ...cached, token, offline: true });
        }
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  // Offline snapshot ile açıldıysak bağlantı geri geldiğinde /api/me'yi sessizce yeniden dene.
  useEffect(() => {
    if (!auth?.offline || !auth?.token) return;
    let stopped = false;
    const timer = setInterval(async () => {
      try {
        const me = await api.me(auth.token);
        if (stopped) return;
        const next = toAuth(auth.token, me, { offline: false });
        setAuth(next);
        await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(snapshotOf(next)));
      } catch (e) {
        if (!stopped && (e?.status === 401 || e?.status === 403)) {
          await AsyncStorage.multiRemove([TOKEN_KEY, USER_CACHE_KEY]);
          setAuth(null);
        }
      }
    }, 15000);
    return () => { stopped = true; clearInterval(timer); };
  }, [auth?.offline, auth?.token]);

  async function handleAuthed(a) {
    const next = { ...a, offline: false };
    setAuth(next);
    await Promise.all([
      AsyncStorage.setItem(TOKEN_KEY, a.token),
      AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(snapshotOf(next))),
    ]);
  }

  // Profil düzenleme sonrası yalnız ProfileScreen değil, auth.name/auth.username kullanan paylaşım
  // ve sohbet akışları da aynı anda güncel değeri görsün.
  async function updateAuthProfile(patch) {
    let nextSnapshot = null;
    setAuth((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      nextSnapshot = snapshotOf(next);
      return next;
    });
    if (nextSnapshot) {
      await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(nextSnapshot)).catch(() => {});
    }
  }

  async function logout() {
    const sessionToken = auth?.token;
    setAuth(null);
    clearPrefetchCache();

    // Temizliklerin bitmesini gerçekten bekliyoruz; hızlı hesap değiştirmede eski SQLite/
    // entitlement/push state'inin yeni hesaba yetişip karışması engellenir.
    await Promise.allSettled([
      clearAllLocalMessages(),
      clearLocalChatList(),
      logoutPurchases(),
      clearPushSession(sessionToken),
    ]);
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_CACHE_KEY]);
  }

  async function markOnboardingComplete() {
    setAuth((prev) => (prev ? { ...prev, onboardingCompleted: true, tasteSurveySeen: true } : prev));
    try { await api.onboardingComplete(auth.token); } catch { /* sessizce geç */ }
  }

  async function markTutorialSeen() {
    setAuth((prev) => (prev ? { ...prev, tutorialSeen: true } : prev));
    try { await api.tutorialSeen(auth.token); } catch { /* sessizce geç */ }
  }

  async function markTasteSurveySeen() {
    setAuth((prev) => (prev ? { ...prev, tasteSurveySeen: true } : prev));
    try { await api.tasteSurveySeen(auth.token); } catch { /* sessizce geç */ }
  }

  return (
    <AuthContext.Provider value={{
      auth, setAuth, checking, handleAuthed, logout, updateAuthProfile,
      markOnboardingComplete, markTutorialSeen, markTasteSurveySeen,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
