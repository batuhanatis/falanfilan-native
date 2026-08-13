import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "./AuthContext";
import { useWS } from "./WSContext";
import { api } from "../api/client";
import { saveChatList } from "../utils/chatListDb";
import { prefetchAllChats, appendPrefetchedMessage } from "../utils/chatMessagesPrefetch";
import { setupForegroundNotificationHandling } from "../utils/pushNotifications";

const UnreadContext = createContext(null);

export function UnreadProvider({ children }) {
  const { auth } = useAuth();
  const { subscribe } = useWS();
  const [chats, setChats] = useState([]);
  const currentTokenRef = useRef(auth?.token || null);

  useEffect(() => {
    currentTokenRef.current = auth?.token || null;
    if (!auth?.token) setChats([]);
  }, [auth?.token]);

  const refresh = useCallback(() => {
    const token = auth?.token;
    if (!token) return Promise.resolve();

    return api.chats(token).then((data) => {
      // Önceki hesaba ait havada kalan istek, hesap değiştirildikten sonra geç dönerse sonucu
      // yeni kullanıcının state/cache'ine yazma.
      if (currentTokenRef.current !== token) return;
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
      if (msg.chat_id != null && msg.message) appendPrefetchedMessage(msg.chat_id, msg.message);
    });
    return unsub;
  }, [subscribe, refresh]);

  // Foreground'da sistem push banner'ı bilinçli olarak kapalı. WebSocket o anda reconnect
  // aşamasındaysa mesaj/rozet güncellemesi kaybolmasın diye push gelince de sohbet listesini tazele.
  useEffect(() => setupForegroundNotificationHandling(() => { refresh(); }), [refresh]);

  const totalUnread = chats.reduce((sum, c) => sum + (c.unread_count || 0), 0);

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
