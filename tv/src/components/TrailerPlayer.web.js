import React, { useEffect, useRef } from "react";

// Tarayıcı ön izlemesi için: aynı YouTube oynatıcısı, WebView yerine sayfanın içinde.
// (Cihazdaki sürüm TrailerPlayer.js.) Tarayıcılar sesli otomatik oynatmayı engellediği için sessiz.
// Cihazdaki gibi kendiliğinden oynamıyor: "ready" der, play=true gelince başlar.
let apiReady = null;
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiReady) {
    apiReady = new Promise((resolve) => {
      window.onYouTubeIframeAPIReady = () => resolve(window.YT);
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    });
  }
  return apiReady;
}

export default function TrailerPlayer({ videoKey, play, onReady, onPlaying, onEnded, onError }) {
  const host = useRef(null);
  const cb = useRef({});
  cb.current = { onReady, onPlaying, onEnded, onError };
  const playerRef = useRef(null);
  const readyRef = useRef(false);
  const playProp = useRef(play);
  playProp.current = play;
  useEffect(() => { if (play && readyRef.current) playerRef.current?.playVideo(); }, [play]);

  useEffect(() => {
    let player = null;
    let cancelled = false;
    loadYouTubeApi().then((YT) => {
      if (cancelled || !host.current) return;
      // 16:9 videoyu alanı dolduracak kadar büyütüp ortala (cihazdaki sürümle aynı kırpma).
      const wrap = document.createElement("div");
      wrap.style.cssText = "position:absolute;left:50%;top:50%;width:max(100cqw,177.78cqh);height:max(56.25cqw,100cqh);transform:translate(-50%,-50%)";
      const el = document.createElement("div");
      wrap.appendChild(el);
      host.current.appendChild(wrap);
      player = playerRef.current = new YT.Player(el, {
        width: "100%", height: "100%", videoId: videoKey,
        playerVars: { autoplay: 0, mute: 1, controls: 0, disablekb: 1, fs: 0, rel: 0, iv_load_policy: 3, playsinline: 1 },
        events: {
          onReady: (e) => { readyRef.current = true; cb.current.onReady?.(); if (playProp.current) e.target.playVideo(); },
          onStateChange: (e) => { if (e.data === 1) cb.current.onPlaying?.(); else if (e.data === 0) cb.current.onEnded?.(); },
          onError: (e) => cb.current.onError?.(e.data),
        },
      });
    });
    return () => { cancelled = true; try { player?.destroy(); } catch { /* yok */ } };
  }, [videoKey]);

  return React.createElement("div", {
    ref: host,
    style: { position: "absolute", inset: 0, background: "#000", pointerEvents: "none", overflow: "hidden", containerType: "size" },
  });
}
