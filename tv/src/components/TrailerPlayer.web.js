import React, { useEffect, useRef } from "react";

// Tarayıcı ön izlemesi için: aynı YouTube oynatıcısı, WebView yerine sayfanın içinde.
// (Cihazdaki sürüm TrailerPlayer.js.) Tarayıcılar sesli otomatik oynatmayı engellediği için sessiz.
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

export default function TrailerPlayer({ videoKey, onPlaying, onEnded, onError }) {
  const host = useRef(null);
  const cb = useRef({});
  cb.current = { onPlaying, onEnded, onError };

  useEffect(() => {
    let player = null;
    let cancelled = false;
    loadYouTubeApi().then((YT) => {
      if (cancelled || !host.current) return;
      const el = document.createElement("div");
      host.current.appendChild(el);
      player = new YT.Player(el, {
        width: "100%", height: "100%", videoId: videoKey,
        playerVars: { autoplay: 1, mute: 1, controls: 0, disablekb: 1, fs: 0, rel: 0, iv_load_policy: 3, playsinline: 1 },
        events: {
          onReady: (e) => e.target.playVideo(),
          onStateChange: (e) => { if (e.data === 1) cb.current.onPlaying?.(); else if (e.data === 0) cb.current.onEnded?.(); },
          onError: (e) => cb.current.onError?.(e.data),
        },
      });
    });
    return () => { cancelled = true; try { player?.destroy(); } catch { /* yok */ } };
  }, [videoKey]);

  return React.createElement("div", {
    ref: host,
    style: { position: "absolute", inset: 0, background: "#000", pointerEvents: "none" },
  });
}
