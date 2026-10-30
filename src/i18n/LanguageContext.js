import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLanguage, setLanguageValue } from './core';
const STORAGE_KEY = 'pellix.language.v1';
const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, updateLanguage] = useState(getLanguage());
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY).then(saved => {
      const initial = saved === 'en' ? 'en' : 'tr';
      if (mounted) { setLanguageValue(initial); updateLanguage(initial); }
    }).catch(() => {}).finally(() => { if (mounted) setReady(true); });
    return () => { mounted = false; };
  }, []);
  async function setLanguage(next) {
    if (!['tr', 'en'].includes(next)) return;
    await AsyncStorage.setItem(STORAGE_KEY, next);
    setLanguageValue(next);
    updateLanguage(next);
  }
  if (!ready) return null;
  // Recreate navigation and screen-local labels in the selected language; auth is outside.
  return <LanguageContext.Provider value={{ language, setLanguage }}><React.Fragment key={language}>{children}</React.Fragment></LanguageContext.Provider>;
}
export function useLanguage() { return useContext(LanguageContext); }
