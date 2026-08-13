import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useAppTheme } from "../context/ThemeContext";

// Uygulama genelinde tek, tutarlı boş-durum kalıbı — ikon + başlık + alt metin + (opsiyonel) CTA.
// Eskiden her ekran (Watchlist, Discover, Notifications...) kendi tek satırlık soluk metnini
// yazıyordu; artık hepsi aynı, ChatListScreen'de zaten var olan ikon-daire desenini paylaşıyor.
export default function EmptyState({ icon: Icon, title, text, ctaLabel, onPress, compact }) {
  const { c } = useAppTheme();
  const styles = makeStyles(c);
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      {!!Icon && (
        <View style={styles.iconWrap}>
          <Icon size={26} color={c.accent} />
        </View>
      )}
      {!!title && <Text style={styles.title}>{title}</Text>}
      {!!text && <Text style={styles.text}>{text}</Text>}
      {!!ctaLabel && !!onPress && (
        <TouchableOpacity style={styles.cta} onPress={onPress} activeOpacity={0.85}>
          <Text style={styles.ctaText}>{ctaLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    wrap: { alignItems: "center", paddingVertical: 40, paddingHorizontal: 30 },
    wrapCompact: { paddingVertical: 24 },
    iconWrap: {
      width: 56, height: 56, borderRadius: 999, backgroundColor: c.surface2,
      alignItems: "center", justifyContent: "center", marginBottom: 12,
    },
    title: { fontSize: 14, fontWeight: "700", color: c.text, textAlign: "center" },
    text: { color: c.dim, fontSize: 12, textAlign: "center", marginTop: 6, lineHeight: 18 },
    cta: { marginTop: 16, backgroundColor: c.accent, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10 },
    ctaText: { color: c.bg, fontWeight: "800", fontSize: 12.5 },
  });
}
