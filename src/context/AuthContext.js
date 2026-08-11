import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../api/client";
import { clearPrefetchCache } from "../utils/chatMessagesPrefetch";

const AuthContext = createContext(null);
const TOKEN_KEY = "ff_token";

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(null); // { token, id, name, username, email, likeCount, onboardingCompleted }
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem(TOKEN_KEY);
        if (!token) { setChecking(false); return; }
        const me = await api.me(token);
        setAuth({ token, id: me.id, name: me.name, username: me.username, email: me.email, likeCount: me.likeCount, onboardingCompleted: me.onboardingCompleted, tutorialSeen: me.tutorialSeen, tasteSurveySeen: me.tasteSurveySeen });
      } catch {
        await AsyncStorage.removeItem(TOKEN_KEY);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  async function handleAuthed(a) {
    setAuth(a);
    await AsyncStorage.setItem(TOKEN_KEY, a.token);
  }

  async function logout() {
    setAuth(null);
    await AsyncStorage.removeItem(TOKEN_KEY);
    clearPrefetchCache(); // önceki hesabın hafızadaki sohbet ön yükleme verisi kalmasın
  }

  // Backend, onboarding tamamlanırken taste_survey_seen'i de true yapıyor (2 adımlı onboarding
  // zaten anketi içeriyor) — burada da aynı şekilde optimistik olarak işaretliyoruz, yoksa
  // kullanıcı onboarding'i bitirir bitirmez geriye dönük anket hatırlatması hemen tekrar açılırdı.
  async function markOnboardingComplete() {
    setAuth((prev) => (prev ? { ...prev, onboardingCompleted: true, tasteSurveySeen: true } : prev));
    try { await api.onboardingComplete(auth.token); } catch { /* sessizce geç */ }
  }

  // Özellik tanıtım turu (spotlight tutorial) bitince/atlanınca çağrılıyor — bir daha
  // gösterilmesin diye kalıcı olarak (backend'de) işaretliyor.
  async function markTutorialSeen() {
    setAuth((prev) => (prev ? { ...prev, tutorialSeen: true } : prev));
    try { await api.tutorialSeen(auth.token); } catch { /* sessizce geç */ }
  }

  // Geriye dönük zevk anketi hatırlatması (bu özellik eklenmeden önce onboarding'i tamamlamış
  // kullanıcılara gösteriliyor, bkz. App.js) bitince/atlanınca çağrılıyor.
  async function markTasteSurveySeen() {
    setAuth((prev) => (prev ? { ...prev, tasteSurveySeen: true } : prev));
    try { await api.tasteSurveySeen(auth.token); } catch { /* sessizce geç */ }
  }

  return (
    <AuthContext.Provider value={{ auth, setAuth, checking, handleAuthed, logout, markOnboardingComplete, markTutorialSeen, markTasteSurveySeen }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
