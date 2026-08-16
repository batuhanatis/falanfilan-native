import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { X } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { avatarOr } from "../utils/avatar";
import RetryImage from "./RetryImage";

// Bilerek normal akış kartlarından FARKLI görünüyor (gradyan/altın çerçeve, poster+CTA satırı,
// kişi başlığı yok) — bu bir kullanıcının paylaşımı değil, "arkadaşların aynı şeyi beğendi"
// pasif sinyalini akışa aktif bir davete çeviren sistem kartı. Kapatma (X) SADECE bu cihazda
// bu oturumda gizler — sunucu, kartı akışa dahil ettiği anda zaten kısa süreliğine bastırıyor
// (bkz. backend nudge_dismissals), o yüzden burada ayrı bir ağ isteği gerekmiyor.
export default function NudgeCard({ item, navigation, onOpenPicker, onDismiss }) {
  const { c } = useAppTheme();
  const styles = makeStyles(c);
  const { movie, friends = [], friendCount = 0 } = item;

  if (!movie) return null;

  const title = `${friendCount} arkadaşın “${movie.title}” sevdi`;

  return (
    <View style={styles.card}>
      <TouchableOpacity onPress={() => navigation.navigate("Detail", { movie })} activeOpacity={0.85}>
        {movie.poster ? (
          <Image source={{ uri: movie.poster }} style={styles.poster} />
        ) : (
          <View style={[styles.poster, { backgroundColor: c.surface2 }]} />
        )}
      </TouchableOpacity>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        {friends.length > 0 && (
          <View style={styles.avatarsRow}>
            {friends.map((f, idx) => (
              <RetryImage
                key={f.id}
                source={{ uri: avatarOr(f.avatar_url, f.id) }}
                style={[styles.avatar, idx > 0 && { marginLeft: -8 }]}
              />
            ))}
          </View>
        )}
        <Text style={styles.subtitle}>Zevkiniz ne kadar örtüşüyor bir bak.</Text>
      </View>

      <TouchableOpacity style={styles.cta} onPress={() => onOpenPicker(item)} activeOpacity={0.85}>
        <Text style={styles.ctaText}>Blend Yap</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <X size={13} color={c.dim} />
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    card: {
      flexDirection: "row", alignItems: "center", gap: 12, padding: 14,
      backgroundColor: c.surface, borderWidth: 1, borderColor: "rgba(201,164,76,0.35)",
      borderRadius: 18, marginBottom: 12, position: "relative",
    },
    poster: { width: 46, height: 66, borderRadius: 10 },
    body: { flex: 1, minWidth: 0 },
    title: { color: c.text, fontSize: 13, fontWeight: "800", lineHeight: 17 },
    avatarsRow: { flexDirection: "row", marginTop: 7 },
    avatar: { width: 20, height: 20, borderRadius: 999, borderWidth: 2, borderColor: c.surface, backgroundColor: c.surface2 },
    subtitle: { color: c.dim, fontSize: 10.5, marginTop: 6 },
    cta: { flexShrink: 0, backgroundColor: c.accent, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
    ctaText: { color: c.bg, fontSize: 11, fontWeight: "800" },
    dismissBtn: { position: "absolute", top: 8, right: 8, width: 20, height: 20, alignItems: "center", justifyContent: "center" },
  });
}
