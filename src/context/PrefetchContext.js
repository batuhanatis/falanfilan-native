import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { useAuth } from "./AuthContext";
import { api } from "../api/client";

const PrefetchContext = createContext(null);

// DiscoverScreen'deki STOCK_TARGET ile aynı — kullanıcı sekmeye girdiğinde kartların hepsi hazır olsun.
const DISCOVER_STOCK_TARGET = 20;

// Kullanıcı bir sekmeye HİÇ girmeden, oturum açılır açılmaz arka planda o sekmenin ilk verisini
// çekip burada bekletiyoruz. İlgili ekranlar mount olduğunda önce buraya bakıyor — veri hazırsa
// kendi isteğini hiç atmadan direkt kullanıyor, hazır değilse (nadir, çok hızlı sekme değişimi
// gibi durumlarda) normal şekilde kendi isteğini atıyor. Yani bu sadece bir HIZLANDIRMA katmanı,
// hiçbir ekranın çalışma mantığını değiştirmiyor.
export function PrefetchProvider({ children }) {
  const { auth } = useAuth();
  const [discoverQueue, setDiscoverQueue] = useState(null);
  const [tasteMates, setTasteMates] = useState(null);
  const [friends, setFriends] = useState(null);
  const [activity, setActivity] = useState(null);
  // ÖNEMLİ DÜZELTME: Eskiden "startedRef" bir kez true olduktan sonra asla sıfırlanmıyordu —
  // bir hesaptan çıkıp FARKLI bir hesapla girince (token değişince), bu ön yükleme bir daha HİÇ
  // çalışmıyordu; önceki kullanıcı için toplanmış TasteMate/Discover/arkadaş verisi olduğu gibi
  // kalıyor, yeni kullanıcıya "hazır veri" diye sunuluyordu. Artık HANGİ token için ön yükleme
  // yapıldığını takip ediyoruz — token gerçekten DEĞİŞTİĞİNDE (aynı token'ın tekrar render
  // tetiklemesiyle karışmasın diye) hem eski veriyi hemen temizliyor hem yeni kullanıcı için
  // baştan topluyoruz.
  const startedForTokenRef = useRef(null);

  useEffect(() => {
    if (!auth?.token || startedForTokenRef.current === auth.token) return;
    startedForTokenRef.current = auth.token;
    const token = auth.token;

    // Önceki kullanıcıya ait olabilecek veriyi ANINDA temizliyoruz — yeni prefetch bitene kadar
    // ekranlar "hazır" diye eski veriyi kullanmasın, kendi taze isteklerini atsınlar.
    setDiscoverQueue(null);
    setTasteMates(null);
    setFriends(null);
    setActivity(null);

    api.tastemates(token).then(setTasteMates).catch(() => setTasteMates({ results: [] }));
    api.friends(token).then((d) => setFriends(d.friends || [])).catch(() => setFriends([]));
    api.activityFeed(token).then((d) => setActivity(d.results || [])).catch(() => setActivity([]));

    // Discover: DiscoverScreen'in kendi kuyruk oluşturma mantığının aynısı — daha önce oy
    // verilmiş içerikleri dışlayarak, varsayılan "Hepsi" filtresi için rastgele bir başlangıç
    // kümesi topluyor.
    (async () => {
      try {
        const interactionsData = await api.interactions(token);
        const usedIds = new Set(
          (interactionsData.results || [])
            .filter((r) => r.action === "like" || r.action === "dislike" || r.action === "skip")
            .map((r) => r.movie_id)
        );
        const gathered = [];
        let attempts = 0;
        while (gathered.length < DISCOVER_STOCK_TARGET && attempts < 20) {
          attempts++;
          const type = Math.random() < 0.55 ? "movie" : "tv";
          const page = Math.floor(Math.random() * 15) + 1;
          try {
            const data = await api.movies(token, type, page);
            (data.results || []).forEach((m) => {
              if (!usedIds.has(m.id)) { usedIds.add(m.id); gathered.push(m); }
            });
          } catch { /* bu deneme başarısız oldu, bir sonrakini dene */ }
        }
        setDiscoverQueue(gathered);
      } catch {
        setDiscoverQueue([]);
      }
    })();
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
