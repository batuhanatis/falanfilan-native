import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { useWS } from "./WSContext";
import { api } from "../api/client";
import { saveChatList, eagerChatListResult, eagerChatListPromise } from "../utils/chatListDb";
import { prefetchAllChats, appendPrefetchedMessage } from "../utils/chatMessagesPrefetch";

const UnreadContext = createContext(null);

// Sohbetleri (ve her birinin okunmamış mesaj sayısını) TEK bir yerden çekip, hem alt sekme
// çubuğundaki Chat ikonunun rozeti hem de sohbet listesindeki her arkadaşın yanındaki sayı
// AYNI veriyi paylaşsın diye — ayrı ayrı çekmek yerine.
export function UnreadProvider({ children }) {
  const { auth } = useAuth();
  const { subscribe } = useWS();
  // ÖNEMLİ (mümkün olan en erken/sıfıra yakın gecikme): chatListDb.js modülü, App.js daha ilk
  // render'ını yapmadan SQLite okumasını ÇOKTAN başlatmıştı. Eğer o okuma bu an itibariyle
  // çözülmüşse (SQLite genelde bir modül-yükleme süresi kadar hızlı olduğu için çoğu zaman
  // öyle oluyor), state'i doğrudan o veriyle, SENKRON olarak başlatıyoruz — hiçbir bekleme
  // hissedilmiyor. Henüz çözülmediyse (gerçekten soğuk, ilk milisaniyelerde), aşağıdaki
  // useEffect onu bekleyip geldiği an state'e yazıyor — bu da SQLite'ın kendi gerçek okuma
  // süresi kadar (genelde birkaç ms) bir gecikme, teknik olarak sıfıra indiremediğimiz tek kısım.
  const [chats, setChats] = useState(() => eagerChatListResult || []);

  useEffect(() => {
    if (eagerChatListResult == null) {
      eagerChatListPromise.then((cached) => { if (cached) setChats(cached); });
    }
  }, []);

  const refresh = useCallback(() => {
    if (!auth?.token) return Promise.resolve();
    // ÖNEMLİ: Promise'i DÖNDÜRÜYORUZ — bu sayede çağıran taraf (ör. sohbet listesindeki
    // "aşağı çekince yenile" özelliği) gerçekten veri gelene kadar bekleyebiliyor, sadece
    // isteği ateşleyip anında dönmüyoruz.
    return api.chats(auth.token).then((data) => {
      const results = data.results || [];
      setChats(results);
      saveChatList(results).catch(() => {});
    }).catch(() => {});
  }, [auth?.token]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const unsub = subscribe((msg) => {
      if (msg.type !== "message") return;
      refresh();
      // Bu sohbet önceden önbelleğe alınmışsa (bkz. prefetchAllChats), önbelleği de canlı
      // tutuyoruz — yoksa o sohbete tıklayınca ilk karede az önce gelen bu mesaj eksik görünüp
      // bir an sonra beliriyordu.
      if (msg.chat_id != null && msg.message) appendPrefetchedMessage(msg.chat_id, msg.message);
    });
    return unsub;
  }, [subscribe, refresh]);

  const totalUnread = chats.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  // Sohbet listesi her elimize geçtiğinde (yerelden ya da ağdan), her sohbetin mesajlarını
  // arka planda, kullanıcı henüz tıklamadan hafızaya çekiyoruz — böylece bir sohbete
  // tıklandığında mesajlar SIFIR gecikmeyle, ilk render'da hazır oluyor.
  useEffect(() => {
    if (chats.length > 0) prefetchAllChats(chats.map((c) => c.chat_id));
  }, [chats]);

  return (
    <UnreadContext.Provider value={{ chats, totalUnread, refresh }}>
      {children}
    </UnreadContext.Provider>
  );
}

export function useUnread() {
  return useContext(UnreadContext);
}
