import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

// Tarayıcı ön izlemesi için aynı oynatıcı (cihazdaki sürüm TrailerHost.js): WebView yerine
// sayfanın içinde YouTube IFrame API. Tarayıcılar sesli otomatik oynatmayı engellediği için sessiz.
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

const TrailerHost = forwardRef(function TrailerHost({ onEvent }, ref) {
  const host = useRef(null);
  const player = useRef(null);
  const current = useRef(null);
  const wantPlay = useRef(false);
  const eventRef = useRef(onEvent);
  eventRef.current = onEvent;
  const send = (type, value) => eventRef.current?.({ type, value });

  useImperativeHandle(ref, () => ({
    warm() { loadYouTubeApi(); },
    cue(key) {
      wantPlay.current = false;
      current.current = key;
      loadYouTubeApi().then((YT) => {
        if (!host.current) return;
        if (player.current) { player.current.cueVideoById(key); return; }
        const el = document.createElement("div");
        host.current.appendChild(el);
        player.current = new YT.Player(el, {
          width: "100%", height: "100%", videoId: key,
          playerVars: { autoplay: 0, mute: 1, controls: 0, disablekb: 1, fs: 0, rel: 0, iv_load_policy: 3, playsinline: 1 },
          events: {
            onReady: () => { send("cued", current.current); if (wantPlay.current) player.current.playVideo(); },
            onStateChange: (e) => {
              if (e.data === 1) send("playing", current.current);
              else if (e.data === 0) send("ended", current.current);
              else if (e.data === 5) send("cued", current.current);
            },
            onError: (e) => send("error", { code: e.data, key: current.current }),
          },
        });
      });
    },
    play() { wantPlay.current = true; player.current?.playVideo?.(); },
    stop() { wantPlay.current = false; player.current?.stopVideo?.(); },
  }), []);

  useEffect(() => () => { try { player.current?.destroy?.(); } catch { /* yok */ } }, []);

  return React.createElement("div", {
    ref: host,
    style: { position: "absolute", inset: 0, background: "#000", pointerEvents: "none", overflow: "hidden" },
  });
});

export default TrailerHost;
