import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { THEMES } from "../theme/theme";

const ThemeContext = createContext(null);
const THEME_KEY = "pellix_theme_mode";

export function ThemeProvider({ children }) {
  // ÖNEMLİ: Eskiden tema sadece bellekte (useState) tutuluyordu — uygulama kapanıp
  // açıldığında hep "light" ile başlıyordu, kullanıcının seçimi hiç hatırlanmıyordu.
  // Artık AsyncStorage'a yazılıp okunuyor.
  const [mode, setModeState] = useState("light");

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((saved) => {
      if (saved === "light" || saved === "dark") setModeState(saved);
    }).catch(() => {});
  }, []);

  function setMode(next) {
    setModeState(next);
    AsyncStorage.setItem(THEME_KEY, next).catch(() => {});
  }

  const c = THEMES[mode];
  return (
    <ThemeContext.Provider value={{ mode, setMode, c }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
