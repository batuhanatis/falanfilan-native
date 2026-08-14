import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { useAuth } from "./AuthContext";
import { api } from "../api/client";

const PrefetchContext = createContext(null);

const DISCOVER_STOCK_TARGET = 80;

export function PrefetchProvider({ children }) {
  const { auth } = useAuth();
  const [discoverQueue, setDiscoverQueue] = useState(null);
  const [tasteMates, setTasteMates] = useState(null);
  const [friends, setFriends] = useState(null);
  const [activity, setActivity] = useState(null);
  const startedForTokenRef = useRef(null);

  useEffect(() => {
    if (!auth?.token || startedForTokenRef.current === auth.token) return;
    startedForTokenRef.current = auth.token;
    const token = auth.token;
    let cancelled = false;

    const stillCurrent = () => !cancelled && startedForTokenRef.current === token;

    setDiscoverQueue(null);
    setTasteMates(null);
    setFriends(null);
    setActivity(null);

    api.tastemates(token)
      .then((data) => { if (stillCurrent()) setTasteMates(data); })
      .catch(() => {});
    api.friends(token)
      .then((d) => { if (stillCurrent()) setFriends(d.friends || []); })
      .catch(() => {});
    api.activityFeed(token)
      .then((d) => { if (stillCurrent()) setActivity(d.results || []); })
      .catch(() => {});

    (async () => {
      try {
        // Discover açılmadan önce Taste Engine'den geniş bir kişisel kart stoğu hazırla.
        // Rastgele katalog sayfaları yerine kullanıcının zevk skoruna göre sıralanmış cache havuzu gelir.
        const data = await api.recommendations(token, null, DISCOVER_STOCK_TARGET);
        if (!stillCurrent()) return;
        setDiscoverQueue((data.results || []).slice(0, DISCOVER_STOCK_TARGET));
      } catch {
        // Hata durumunda null bırak; Discover kendi öneri isteğini atsın.
      }
    })();

    return () => { cancelled = true; };
  }, [auth?.token]);

  // Logout anında eski hesap verisini render edilebilir halde bırakma.
  useEffect(() => {
    if (auth?.token) return;
    startedForTokenRef.current = null;
    setDiscoverQueue(null);
    setTasteMates(null);
    setFriends(null);
    setActivity(null);
  }, [auth?.token]);

  return (
    <PrefetchContext.Provider value={{ discoverQueue, tasteMates, friends, activity }}>
      {children}
    </PrefetchContext.Provider>
  );
}

export function usePrefetch() {
  return useContext(PrefetchContext) || {};
}
