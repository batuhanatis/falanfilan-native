import React, { createContext, useContext, useEffect, useRef } from "react";
import { useAuth } from "./AuthContext";
import { WS_BASE } from "../api/client";

const WSContext = createContext(null);

// Web'deki window.dispatchEvent("ff:ws") mekanizmasının native karşılığı — WebSocket'ten
// gelen her mesajı, dinleyen tüm ekranlara (Chat, bildirimler vs.) dağıtır.
export function WSProvider({ children }) {
  const { auth } = useAuth();
  const listenersRef = useRef(new Set());
  const wsRef = useRef(null);

  useEffect(() => {
    if (!auth?.token) return;
    let closedByUs = false;

    function connect() {
      const ws = new WebSocket(WS_BASE);
      wsRef.current = ws;
      ws.onopen = () => ws.send(JSON.stringify({ type: "auth", token: auth.token }));
      ws.onmessage = (event) => {
        let msg;
        try { msg = JSON.parse(event.data); } catch { return; }
        listenersRef.current.forEach((fn) => fn(msg));
      };
      ws.onclose = () => { if (!closedByUs) setTimeout(connect, 3000); };
      ws.onerror = () => {};
    }
    connect();

    return () => { closedByUs = true; wsRef.current?.close(); };
  }, [auth?.token]);

  function subscribe(fn) {
    listenersRef.current.add(fn);
    return () => listenersRef.current.delete(fn);
  }

  return <WSContext.Provider value={{ subscribe }}>{children}</WSContext.Provider>;
}

export function useWS() {
  return useContext(WSContext);
}
