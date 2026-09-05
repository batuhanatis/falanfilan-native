import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Star } from "lucide-react-native";

export default function RatingShareCard({ movie, rating, note, onPress }) {
  const score = Number(rating);
  const safeScore = Number.isFinite(score) ? Math.max(1, Math.min(10, Math.round(score))) : null;
  const card = (
    <LinearGradient colors={["#0A0A0F", "#1A1410", "#32230D"]} style={styles.card}>
      <View style={styles.goldGlow} />
      <View style={styles.topRow}>
        <View>
          <Text style={styles.brand}>pellix</Text>
          <Text style={styles.type}>DIARY RATING</Text>
        </View>
        <View style={styles.badge}>
          <Star size={10} color="#FFD76A" fill="#FFD76A" />
          <Text style={styles.badgeText}>İZLEDİM</Text>
        </View>
      </View>

      <View style={styles.movieRow}>
        {movie?.poster ? (
          <Image source={{ uri: movie.poster }} style={styles.poster} />
        ) : (
          <View style={[styles.poster, styles.posterEmpty]} />
        )}
        <View style={styles.copy}>
          <Text style={styles.title} numberOfLines={2}>{movie?.title || "İzlediğim içerik"}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {[movie?.type, movie?.year].filter(Boolean).join(" · ") || "Pellix Diary"}
          </Text>
          <View style={styles.scoreRow}>
            <Text style={styles.score}>{safeScore ?? "—"}</Text>
            <View>
              <Text style={styles.outOf}>/10</Text>
              <Text style={styles.scoreLabel}>PELLIX PUANIM</Text>
            </View>
          </View>
        </View>
      </View>

      {!!note && (
        <View style={styles.noteBox}>
          <Text style={styles.quote}>“</Text>
          <Text style={styles.note} numberOfLines={3}>{note}</Text>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>İzledim. Puanladım. Zevkim biraz daha netleşti.</Text>
        {!!onPress && <Text style={styles.openText}>İçeriği aç →</Text>}
      </View>
    </LinearGradient>
  );

  if (!onPress) return card;
  return <TouchableOpacity onPress={onPress} activeOpacity={0.9}>{card}</TouchableOpacity>;
}

const styles = StyleSheet.create({
  card: { marginTop: 12, borderRadius: 22, padding: 16, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,215,106,0.16)" },
  goldGlow: { position: "absolute", width: 190, height: 190, borderRadius: 999, right: -90, top: -110, backgroundColor: "rgba(240,180,41,0.12)" },
  topRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  brand: { color: "#fff", fontSize: 15, lineHeight: 17, fontWeight: "900" },
  type: { color: "rgba(255,255,255,0.42)", fontSize: 7.2, fontWeight: "900", letterSpacing: 1.1, marginTop: 1 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: "rgba(255,215,106,0.08)", borderWidth: 1, borderColor: "rgba(255,215,106,0.18)" },
  badgeText: { color: "#FFD76A", fontSize: 7, fontWeight: "900", letterSpacing: 0.55 },
  movieRow: { flexDirection: "row", gap: 14, alignItems: "center", marginTop: 16 },
  poster: { width: 74, height: 108, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.06)" },
  posterEmpty: { borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  copy: { flex: 1, minWidth: 0 },
  title: { color: "#fff", fontSize: 18, lineHeight: 22, fontWeight: "900" },
  meta: { color: "rgba(255,255,255,0.48)", fontSize: 9.5, fontWeight: "700", marginTop: 4 },
  scoreRow: { flexDirection: "row", alignItems: "flex-end", gap: 6, marginTop: 12 },
  score: { color: "#FFD76A", fontSize: 42, lineHeight: 44, fontWeight: "900", fontVariant: ["tabular-nums"] },
  outOf: { color: "rgba(255,255,255,0.78)", fontSize: 13, fontWeight: "900", marginBottom: 2 },
  scoreLabel: { color: "rgba(255,255,255,0.34)", fontSize: 6.8, fontWeight: "900", letterSpacing: 0.8, marginBottom: 5 },
  noteBox: { marginTop: 14, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: "rgba(255,255,255,0.045)", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", flexDirection: "row", gap: 7 },
  quote: { color: "#FFD76A", fontSize: 22, lineHeight: 22, fontWeight: "900" },
  note: { flex: 1, color: "rgba(255,255,255,0.74)", fontSize: 10.5, lineHeight: 15, fontWeight: "600" },
  footer: { marginTop: 14, paddingTop: 11, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  footerText: { flex: 1, color: "rgba(255,255,255,0.38)", fontSize: 8.5, fontWeight: "700" },
  openText: { color: "#FFD76A", fontSize: 8.5, fontWeight: "900" },
});
