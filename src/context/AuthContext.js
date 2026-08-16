import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { api } from "../api/client";
import { clearPrefetchCache } from "../utils/chatMessagesPrefetch";
import { clearAllLocalMessages } from "../utils/chatDb";
import { clearLocalChatList } from "../utils/chatListDb";
import { logoutPurchases } from "../utils/purchases";
import { clearPushSession } from "../utils/pushSessionFinal";
import { subscribeLocalEvents } from "../utils/localEvents";

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
  // Logout temizliği sürerken çok hızlı başka hesapla login olunursa eski cleanup yeni hesabın
  // SQLite/RevenueCat/push state'ini silmesin; yeni login bu promise'i bekler.
  const logoutCleanupRef = useRef(Promise.resolve());

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
          setAuth({ ...cached, token, offline: true });
        }
      } finally {
        setChecking(false);
      }
    })();
  }, []);

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
    await logoutCleanupRef.current.catch(() => {});
    const next = { ...a, offline: false };
    setAuth(next);
    await Promise.all([
      AsyncStorage.setItem(TOKEN_KEY, a.token),
      AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(snapshotOf(next))),
    ]);
  }

  async function updateAuthProfile(patch) {
    setAuth((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(snapshotOf(next))).catch(() => {});
      return next;
    });
  }

  useEffect(() => subscribeLocalEvents((event) => {
    if (event?.type === "profile_updated" && event.patch) updateAuthProfile(event.patch);
  }), []);

  async function logout() {
    const sessionToken = auth?.token;
    setAuth(null);
    clearPrefetchCache();
    const cleanup = (async () => {
      await Promise.allSettled([
        clearAllLocalMessages(),
        clearLocalChatList(),
        logoutPurchases(),
        clearPushSession(sessionToken),
        // ÖNEMLİ: Bunu çağırmazsak native Google SDK'sı hesabı "hatırlamaya" devam ediyor —
        // çıkış yapıp tekrar "Google ile Devam Et" dendiğinde bazen gerçekten taze bir oturum
        // yerine önceki oturumdan kalma, artık SÜRESİ GEÇMİŞ bir idToken dönebiliyor; backend
        // bunu Google'a doğrulatınca "Geçersiz Google jetonu" hatasıyla reddediyor. Google ile
        // hiç giriş yapılmamışsa bu çağrı zaten sessizce no-op.
        GoogleSignin.signOut().catch(() => {}),
      ]);
      await AsyncStorage.multiRemove([TOKEN_KEY, USER_CACHE_KEY]);
    })();
    logoutCleanupRef.current = cleanup;
    await cleanup;
  }

  async function markOnboardingComplete() {
    updateAuthProfile({ onboardingCompleted: true, tasteSurveySeen: true });
    try { await api.onboardingComplete(auth.token); } catch { /* sessizce geç */ }
  }

  async function markTutorialSeen() {
    updateAuthProfile({ tutorialSeen: true });
    try { await api.tutorialSeen(auth.token); } catch { /* sessizce geç */ }
  }

  async function markTasteSurveySeen() {
    updateAuthProfile({ tasteSurveySeen: true });
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
