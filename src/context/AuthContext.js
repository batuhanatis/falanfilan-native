import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../api/client";
import { clearPrefetchCache } from "../utils/chatMessagesPrefetch";
import { clearAllLocalMessages } from "../utils/chatDb";
import { clearLocalChatList } from "../utils/chatListDb";
import { logoutPurchases } from "../utils/purchases";

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
      } catch (e) {
        // ÖNEMLİ DÜZELTME: Eskiden api.me() HANGİ sebeple hata verirse versin (network hatası,
        // 500, timeout, telefon internetsiz açıldı) token siliniyordu — yani geçici bir bağlantı
        // sorununda bile kullanıcı sessizce logout oluyordu. Token'ı SADECE backend açıkça
        // 401/403 (geçersiz/süresi dolmuş session) dediğinde siliyoruz; diğer tüm hatalarda
        // token'a dokunmuyoruz, kullanıcı bağlantı düzelince aynı oturumda kalmaya devam ediyor.
        if (e?.status === 401 || e?.status === 403) {
          await AsyncStorage.removeItem(TOKEN_KEY);
        }
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
    // ÖNEMLİ (privacy — hesap değiştirme sızıntısı düzeltmesi): Yerel sohbet SQLite'ları
    // (mesajlar + sohbet listesi önbelleği) user_id namespace'i taşımıyor — aynı cihazda başka
    // bir hesapla girildiğinde ağ isteği tamamlanana kadar bu hesabın sohbetleri kısa süreliğine
    // görünebiliyordu. Logout'ta tamamen temizliyoruz.
    clearAllLocalMessages().catch(() => {});
    clearLocalChatList().catch(() => {});
    logoutPurchases(); // RevenueCat'in cihazda önbelleklediği entitlement bilgisi de sıfırlansın
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
