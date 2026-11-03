import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

// Panonun ekranında oynayan YouTube fragmanı. YouTube, uygulama içi oynatıcılarda isteğin kimden
// geldiğini görmek istiyor; telefondaki gibi paket adını origin olarak veriyoruz (bkz.
// falanfilan-native src/components/TrailerPlayerModal.js). Kontroller kapalı: TV'de kumanda
// pano düğmelerinde kalıyor, fragmanı geri tuşu durduruyor.
const APP_ORIGIN = "https://com.batuhanatis.pellix.tv";

function playerHtml(videoKey) {
  const safeKey = JSON.stringify(String(videoKey)).replace(/</g, "\\u003c");
  const safeOrigin = JSON.stringify(APP_ORIGIN);
  return `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <style>html,body,#player{width:100%;height:100%;margin:0;padding:0;background:#000;overflow:hidden}</style>
</head>
<body>
  <div id="player"></div>
  <script src="https://www.youtube.com/iframe_api"></script>
  <script>
    function send(type, value) { window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, value: value })); }
    function onYouTubeIframeAPIReady() {
      new YT.Player("player", {
        width: "100%", height: "100%", videoId: ${safeKey},
        playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, rel: 0, iv_load_policy: 3, playsinline: 1, origin: ${safeOrigin}, widget_referrer: ${safeOrigin} },
        events: {
          onReady: function (e) { e.target.playVideo(); },
          onStateChange: function (e) { if (e.data === 1) send("playing"); else if (e.data === 0) send("ended"); },
          onError: function (e) { send("error", e.data); }
        }
      });
    }
    window.onerror = function (m) { send("error", String(m || "web")); };
  </script>
</body>
</html>`;
}

export default function TrailerPlayer({ videoKey, onPlaying, onEnded, onError }) {
  const html = useMemo(() => playerHtml(videoKey), [videoKey]);
  const onMessage = (event) => {
    try {
      const m = JSON.parse(event.nativeEvent.data);
      if (m.type === "playing") onPlaying?.();
      else if (m.type === "ended") onEnded?.();
      else if (m.type === "error") onError?.(m.value);
    } catch { /* YouTube dışı mesajlar */ }
  };
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" importantForAccessibility="no-hide-descendants">
      <WebView
        source={{ html, baseUrl: APP_ORIGIN }}
        style={styles.web}
        originWhitelist={["https://*", "about:blank"]}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        setSupportMultipleWindows={false}
        onMessage={onMessage}
        onError={() => onError?.("load")}
        onHttpError={() => onError?.("http")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: "#000" },
});
