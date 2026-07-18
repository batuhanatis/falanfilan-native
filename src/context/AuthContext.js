import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../api/client";

const AuthContext = createContext(null);
const TOKEN_KEY = "ff_token";

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(null); // { token, id, name, email, likeCount, onboardingCompleted }
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem(TOKEN_KEY);
        if (!token) { setChecking(false); return; }
        const me = await api.me(token);
        setAuth({ token, id: me.id, name: me.name, email: me.email, likeCount: me.likeCount, onboardingCompleted: me.onboardingCompleted });
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
  }

  async function markOnboardingComplete() {
    setAuth((prev) => (prev ? { ...prev, onboardingCompleted: true } : prev));
    try { await api.onboardingComplete(auth.token); } catch { /* sessizce geç */ }
  }

  return (
    <AuthContext.Provider value={{ auth, setAuth, checking, handleAuthed, logout, markOnboardingComplete }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
