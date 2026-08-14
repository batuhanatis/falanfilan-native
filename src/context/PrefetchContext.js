import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { useAuth } from "./AuthContext";
import { api } from "../api/client";

const PrefetchContext = createContext(null);

const DISCOVER_STOCK_TARGET = 20;

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
        const interactionsData = await api.interactions(token);
        if (!stillCurrent()) return;
        const usedIds = new Set(
          (interactionsData.results || [])
            .filter((r) => r.action === "like" || r.action === "dislike" || r.action === "skip")
            .map((r) => r.movie_id)
        );
        const gathered = [];
        let attempts = 0;
        while (gathered.length < DISCOVER_STOCK_TARGET && attempts < 20 && stillCurrent()) {
          attempts++;
          const type = Math.random() < 0.55 ? "movie" : "tv";
          const page = Math.floor(Math.random() * 15) + 1;
          try {
            const data = await api.movies(token, type, page);
            if (!stillCurrent()) return;
            (data.results || []).forEach((m) => {
              if (!usedIds.has(m.id)) { usedIds.add(m.id); gathered.push(m); }
            });
          } catch { /* bu deneme başarısız oldu, bir sonrakini dene */ }
        }
        if (stillCurrent()) setDiscoverQueue(gathered);
      } catch {
        // Hata durumunda null bırak; ilgili ekran kendi gerçek isteğini atsın.
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
