import React, { useMemo, useState } from "react";
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { RotateCcw, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

const APP_ORIGIN = "https://com.batuhanatis.pellix";

function buildPlayerHtml(videoId) {
  const safeVideoId = JSON.stringify(String(videoId)).replace(/</g, "\\u003c");
  const safeOrigin = JSON.stringify(APP_ORIGIN);

  return `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <style>
    html,body,#player{width:100%;height:100%;margin:0;padding:0;background:#000;overflow:hidden}
  </style>
</head>
<body>
  <div id="player"></div>
  <script src="https://www.youtube.com/iframe_api"></script>
  <script>
    var player;
    function send(type, value) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, value: value }));
    }
    function onYouTubeIframeAPIReady() {
      player = new YT.Player("player", {
        width: "100%",
        height: "100%",
        videoId: ${safeVideoId},
        playerVars: {
          autoplay: 1,
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
          origin: ${safeOrigin},
          widget_referrer: ${safeOrigin}
        },
        events: {
          onReady: function (event) {
            send("ready");
            event.target.playVideo();
          },
          onError: function (event) {
            send("error", event.data);
          }
        }
      });
    }
    window.onerror = function (message) {
      send("web-error", String(message || "unknown"));
    };
  </script>
</body>
</html>`;
}

function playerErrorMessage(code) {
  if (code === 101 || code === 150) {
    return "Bu fragman YouTube tarafından uygulama içinde oynatılmaya kapatılmış.";
  }
  if (code === 100) {
    return "Bu fragman artık YouTube’da bulunamıyor.";
  }
  return "Fragman yüklenirken bir sorun oluştu.";
}

export default function TrailerPlayerModal({ trailer, onClose }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playerKey, setPlayerKey] = useState(0);
  const playerHtml = useMemo(() => buildPlayerHtml(trailer?.key || ""), [trailer?.key]);

  if (!trailer?.key) return null;

  function handleMessage(event) {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.type === "ready") {
        setLoading(false);
        setError(null);
      } else if (message.type === "error") {
        setLoading(false);
        setError(playerErrorMessage(Number(message.value)));
      } else if (message.type === "web-error") {
        setLoading(false);
        setError("Fragman oynatıcısı yüklenemedi.");
      }
    } catch {
      // YouTube dışındaki WebView mesajlarını yok say.
    }
  }

  function retry() {
    setError(null);
    setLoading(true);
    setPlayerKey((value) => value + 1);
  }

  return (
    <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <StatusBar style="light" />
      <View style={[styles.root, { paddingBottom: insets.bottom }]}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <View style={styles.heading}>
            <Text style={styles.title} numberOfLines={1}>{trailer.name || "Fragman"}</Text>
            <Text style={styles.subtitle}>Uygulama içinde oynatılıyor</Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="Fragmanı kapat">
            <X size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.playerShell}>
          <WebView
            key={playerKey}
            source={{ html: playerHtml, baseUrl: APP_ORIGIN }}
            style={styles.webView}
            originWhitelist={["https://*", "about:blank"]}
            javaScriptEnabled
            domStorageEnabled
            allowsFullscreenVideo
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            setSupportMultipleWindows={false}
            onMessage={handleMessage}
            onError={() => {
              setLoading(false);
              setError("Fragman oynatıcısı yüklenemedi.");
            }}
            onHttpError={() => {
              setLoading(false);
              setError("YouTube’a bağlanılamadı.");
            }}
          />

          {loading && !error && (
            <View style={styles.loader} pointerEvents="none">
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}

          {!!error && (
            <View style={styles.error}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={retry} activeOpacity={0.8}>
                <RotateCcw size={15} color="#050505" />
                <Text style={styles.retryText}>Tekrar dene</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#050505", justifyContent: "center" },
  header: {
    position: "absolute", top: 0, left: 0, right: 0, zIndex: 2,
    flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14,
    backgroundColor: "rgba(5,5,5,0.92)",
  },
  heading: { flex: 1, paddingRight: 12 },
  title: { color: "#fff", fontSize: 15, fontWeight: "800" },
  subtitle: { color: "rgba(255,255,255,0.55)", fontSize: 10, marginTop: 2 },
  closeButton: {
    width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  playerShell: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000" },
  webView: { flex: 1, backgroundColor: "#000" },
  loader: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", zIndex: 1 },
  error: {
    ...StyleSheet.absoluteFillObject, zIndex: 2, alignItems: "center", justifyContent: "center",
    backgroundColor: "#090909", paddingHorizontal: 28,
  },
  errorText: { color: "rgba(255,255,255,0.78)", fontSize: 13, lineHeight: 19, textAlign: "center" },
  retryButton: {
    marginTop: 14, minHeight: 38, paddingHorizontal: 16, borderRadius: 999,
    backgroundColor: "#fff", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
  },
  retryText: { color: "#050505", fontSize: 12, fontWeight: "800" },
});
