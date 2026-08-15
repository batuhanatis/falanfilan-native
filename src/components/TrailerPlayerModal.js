import React, { useState } from "react";
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

export default function TrailerPlayerModal({ trailer, onClose }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);

  if (!trailer?.key) return null;

  const embedUrl = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(trailer.key)}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;

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
          {loading && (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}
          <WebView
            source={{ uri: embedUrl }}
            style={styles.webView}
            javaScriptEnabled
            domStorageEnabled
            allowsFullscreenVideo
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            onLoadEnd={() => setLoading(false)}
            setSupportMultipleWindows={false}
          />
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
});
