import React, { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

// Panonun sağ tarafındaki fragman oynatıcısı (YouTube). Tek bir WebView bir kez açılıp hep
// kullanılıyor: film değişince yalnızca video değişiyor (cueVideoById), oynatıcı yeniden
// kurulmuyor (TV'de en ağır iş buydu). Kendiliğinden oynamıyor: önce "cued" diyor, pano görseli
// kalkıp oynatıcı tamamen görününce play() geliyor (YouTube otomatik oynatma kuralı). Oynatıcının
// önüne hiçbir şey çizilmiyor; kontroller kapalı.
// YouTube, uygulama içi oynatıcılarda isteğin kimden geldiğini görmek istiyor; telefondaki gibi
// paket adını origin olarak veriyoruz.
const APP_ORIGIN = "https://com.batuhanatis.pellix.tv";

const HTML = `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <style>html,body,#player{width:100%;height:100%;margin:0;padding:0;background:#000;overflow:hidden}</style>
</head>
<body>
  <div id="player"></div>
  <script>
    var ORIGIN = ${JSON.stringify(APP_ORIGIN)};
    function send(type, value) { window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, value: value })); }
    var player = null, apiReady = false, pendingKey = null, currentKey = null, wantPlay = false;
    function create(key) {
      currentKey = key;
      player = new YT.Player("player", {
        width: "100%", height: "100%", videoId: key,
        playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, rel: 0, iv_load_policy: 3, playsinline: 1, origin: ORIGIN, widget_referrer: ORIGIN },
        events: {
          onReady: function () { send("cued", currentKey); if (wantPlay) player.playVideo(); },
          onStateChange: function (e) {
            if (e.data === 1) send("playing", currentKey);
            else if (e.data === 0) send("ended", currentKey);
            else if (e.data === 5) send("cued", currentKey);
          },
          onError: function (e) { send("error", { code: e.data, key: currentKey }); }
        }
      });
    }
    window.__cue = function (key) {
      wantPlay = false;
      if (!apiReady) { pendingKey = key; return; }
      if (!player) { create(key); return; }
      currentKey = key;
      player.cueVideoById(key);
    };
    window.__play = function () { wantPlay = true; if (player && player.playVideo) player.playVideo(); };
    window.__stop = function () { wantPlay = false; if (player && player.stopVideo) player.stopVideo(); };
    function onYouTubeIframeAPIReady() {
      apiReady = true;
      if (pendingKey) { var k = pendingKey; pendingKey = null; create(k); }
    }
    window.onerror = function (m) { send("error", { code: String(m || "web") }); };
  </script>
  <script src="https://www.youtube.com/iframe_api"></script>
</body>
</html>`;

// onEvent({ type: "cued" | "playing" | "ended" | "error", value }). ref: warm(), cue(key), play(), stop().
const TrailerHost = forwardRef(function TrailerHost({ onEvent }, ref) {
  const [mounted, setMounted] = useState(false);
  const web = useRef(null);
  const loaded = useRef(false);
  const queue = useRef([]);
  const eventRef = useRef(onEvent);
  eventRef.current = onEvent;

  const run = (js) => {
    if (loaded.current && web.current) web.current.injectJavaScript(`${js}; true;`);
    else queue.current.push(js);
  };
  useImperativeHandle(ref, () => ({
    warm() { setMounted(true); },
    cue(key) {
      setMounted(true);
      queue.current = queue.current.filter((js) => !js.startsWith("window.__cue"));
      run(`window.__cue(${JSON.stringify(String(key))})`);
    },
    play() { run("window.__play()"); },
    stop() { run("window.__stop()"); },
  }), []);

  if (!mounted) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" importantForAccessibility="no-hide-descendants">
      <WebView
        ref={web}
        source={{ html: HTML, baseUrl: APP_ORIGIN }}
        style={styles.web}
        originWhitelist={["https://*", "about:blank"]}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        setSupportMultipleWindows={false}
        androidLayerType="hardware"
        onLoadEnd={() => {
          loaded.current = true;
          const pending = queue.current;
          queue.current = [];
          pending.forEach((js) => web.current?.injectJavaScript(`${js}; true;`));
        }}
        onMessage={(event) => {
          try { eventRef.current?.(JSON.parse(event.nativeEvent.data)); } catch { /* YouTube dışı mesajlar */ }
        }}
        onError={() => eventRef.current?.({ type: "error", value: { code: "load" } })}
        onHttpError={() => eventRef.current?.({ type: "error", value: { code: "http" } })}
      />
    </View>
  );
});

export default TrailerHost;

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: "#000" },
});
