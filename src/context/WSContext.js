import React, { createContext, useContext, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useAuth } from "./AuthContext";
import { WS_BASE } from "../api/client";

const WSContext = createContext(null);

const PING_INTERVAL = 20000; // 20sn'de bir uygulama-katmanı ping
const PONG_TIMEOUT = 12000; // bu süre içinde pong dönmezse bağlantıyı ölü say
// ÖNEMLİ DÜZELTME: Eskiden bağlantı koptuğunda SABİT 3 saniyede bir sonsuza kadar yeniden
// deneniyordu — uzun bir server outage'ında bu, telefon pilini/mobil şebekeyi gereksiz yere
// yoruyordu (ve bir "reconnect storm"a da katkı sağlıyordu). Artık kademeli artan bir gecikme
// kullanıyoruz, art arda gelen denemelerin AYNI ANDA çakışmaması için de küçük bir jitter ekliyoruz.
const RECONNECT_DELAYS = [3000, 5000, 10000, 20000, 30000];

// Web'deki window.dispatchEvent("ff:ws") mekanizmasının native karşılığı — WebSocket'ten
// gelen her mesajı, dinleyen tüm ekranlara (Chat, bildirimler vs.) dağıtır.
export function WSProvider({ children }) {
  const { auth, logout } = useAuth();
  const listenersRef = useRef(new Set());
  const wsRef = useRef(null);

  useEffect(() => {
    if (!auth?.token) return;
    let stopped = false;
    // ÖNEMLİ (ölü bağlantı / çifte-bağlantı düzeltmesi): "generation" sayacı, her connect()
    // çağrısını bir öncekinden ayırt ediyor — eski bir soketin GECİKMELİ onclose'u (ör. biz zaten
    // elle kapatıp yenisini açtıktan SONRA gelirse) yanlışlıkla İKİNCİ bir yeniden bağlanma
    // zincirlemesin diye. Bir callback'in ait olduğu nesil artık güncel değilse sessizce yok sayılıyor.
    let generation = 0;
    let pingTimer = null;
    let pongTimer = null;
    let reconnectAttempts = 0;

    function clearTimers() {
      if (pingTimer) clearInterval(pingTimer);
      if (pongTimer) clearTimeout(pongTimer);
      pingTimer = null;
      pongTimer = null;
    }

    function connect() {
      generation++;
      const myGen = generation;
      const ws = new WebSocket(WS_BASE);
      wsRef.current = ws;

      ws.onopen = () => {
        if (myGen !== generation) return;
        ws.send(JSON.stringify({ type: "auth", token: auth.token }));
        // ÖNEMLİ (ölü bağlantı tespiti — WhatsApp'taki gibi güvenilir canlı bağlantı):
        // readyState'in "OPEN" olması bağlantının GERÇEKTEN canlı olduğu anlamına gelmiyor —
        // özellikle mobil ağ geçişlerinde/arka plandan dönüşte TCP bağlantısı sessizce askıda
        // kalabiliyor, hiçbir "close" olayı hiç tetiklenmeyebiliyor. Periyodik bir uygulama
        // katmanı ping'i atıp makul bir sürede pong dönmezse bağlantıyı ölü sayıp kapatıyoruz —
        // bu da doğal olarak aşağıdaki onclose'daki yeniden bağlanmayı tetikliyor.
        pingTimer = setInterval(() => {
          if (myGen !== generation || ws.readyState !== WebSocket.OPEN) return;
          ws.send(JSON.stringify({ type: "ping" }));
          if (pongTimer) clearTimeout(pongTimer);
          pongTimer = setTimeout(() => { if (myGen === generation) ws.close(); }, PONG_TIMEOUT);
        }, PING_INTERVAL);
      };
      ws.onmessage = (event) => {
        if (myGen !== generation) return;
        let msg;
        try { msg = JSON.parse(event.data); } catch { return; }
        if (msg.type === "pong") {
          if (pongTimer) { clearTimeout(pongTimer); pongTimer = null; }
          return;
        }
        // ÖNEMLİ DÜZELTME: auth_ok/auth_error eskiden sıradan bir olay gibi dinleyicilere
        // dağıtılıyordu — hiçbir ekran bunu özel olarak ele almadığı için sessizce yutuluyordu.
        // Token geçersizse (ör. süresi dolmuş/başka cihazdan iptal edilmiş) soket her 3 saniyede
        // bir AYNI geçersiz token'la sonsuza kadar yeniden bağlanmayı deniyordu. Artık bağlantıyı
        // kapatıp yeniden denemeyi durduruyoruz ve kullanıcıyı gerçek bir logout ile bilgilendiriyoruz.
        if (msg.type === "auth_ok") {
          reconnectAttempts = 0; // gerçekten başarılı bir oturum — kademeli gecikmeyi sıfırla
          return;
        }
        if (msg.type === "auth_error") {
          stopped = true;
          generation++; // onclose'un yeniden bağlanmayı tetiklemesini engelle
          ws.close();
          logout();
          return;
        }
        listenersRef.current.forEach((fn) => fn(msg));
      };
      ws.onclose = () => {
        if (myGen !== generation) return; // artık geçersiz (elle kapatılıp yenisi açılmış) bir bağlantı
        clearTimers();
        if (!stopped) {
          const delay = RECONNECT_DELAYS[Math.min(reconnectAttempts, RECONNECT_DELAYS.length - 1)];
          reconnectAttempts++;
          const jitter = delay * 0.2 * (Math.random() - 0.5); // ±%10 — art arda denemeler çakışmasın
          setTimeout(() => { if (myGen === generation) connect(); }, delay + jitter);
        }
      };
      ws.onerror = () => {};
    }
    connect();

    // ÖNEMLİ (arka plandan dönünce anında yeniden bağlanma): iOS'ta uygulama arka plana
    // alındığında soket genelde "close" olayı hiç tetiklenmeden askıya alınıyor — önceden
    // uygulama öne gelince bağlantının gerçekten kopup kopmadığını hiç kontrol etmiyorduk,
    // sadece bir sonraki ekran odaklanmasında (ör. ChatConversationScreen'in kendi "focus"
    // senkronu) fark ediliyordu. Artık her öne gelişte hemen kontrol edip, açık değilse
    // kademeli gecikme döngüsünü beklemeden anında yeniden bağlanıyoruz (ve sayaç da sıfırlanıyor
    // — arka plandan dönüş, uzun bir outage'ın devamı değil YENİ bir bağlanma denemesi sayılmalı).
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active" && wsRef.current?.readyState !== WebSocket.OPEN) {
        reconnectAttempts = 0;
        clearTimers();
        wsRef.current?.close();
        connect();
      }
    });

    return () => {
      stopped = true;
      generation++; // bekleyen tüm eski callback'leri geçersiz kıl
      clearTimers();
      appStateSub.remove();
      wsRef.current?.close();
    };
  }, [auth?.token]);

  function subscribe(fn) {
    listenersRef.current.add(fn);
    return () => listenersRef.current.delete(fn);
  }

  // "Yazıyor..." göstergesi gibi client'tan sunucuya gönderilmesi gereken olaylar için —
  // bağlantı o an açık değilse (nadiren olur, sorun değil, sadece o anlık gösterge iletilmez)
  // sessizce hiçbir şey yapmıyoruz.
  function send(payload) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }

  return <WSContext.Provider value={{ subscribe, send }}>{children}</WSContext.Provider>;
}

export function useWS() {
  return useContext(WSContext);
}
