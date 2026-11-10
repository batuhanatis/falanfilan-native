import { t as translateUI } from "../i18n/core";
import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Star } from "lucide-react-native";
import { FONTS } from "../theme/fonts";

const GOLD = "#c9a44c";
const CREAM = "#f3ead8";
const DIM = "#8c8579";

export default function RatingShareCard({ movie, rating, note, onPress }) {
  const score = Number(rating);
  const safeScore = Number.isFinite(score) ? Math.max(1, Math.min(10, Math.round(score))) : null;
  const card = (
    <View style={styles.card}>
      <LinearGradient colors={["rgba(201,164,76,0.16)", "rgba(201,164,76,0)"]} style={styles.goldGlow} pointerEvents="none" />
      <View style={styles.topRow}>
        <View>
          <Text style={styles.brand}>{translateUI("pellix")}</Text>
          <Text style={styles.type}>{translateUI("DIARY RATING")}</Text>
        </View>
        <View style={styles.badge}>
          <Star size={10} color={GOLD} fill={GOLD} />
          <Text style={styles.badgeText}>{translateUI("İZLEDİM")}</Text>
        </View>
      </View>

      <View style={styles.movieRow}>
        {movie?.poster ? (
          <Image source={{ uri: movie.poster }} style={styles.poster} />
        ) : (
          <View style={[styles.poster, styles.posterEmpty]} />
        )}
        <View style={styles.copy}>
          <Text style={styles.title} numberOfLines={2}>{movie?.title || translateUI("İzlediğim içerik")}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {[movie?.type, movie?.year].filter(Boolean).join(" · ") || translateUI("Pellix Diary")}
          </Text>
          <View style={styles.scoreRow}>
            <Text style={styles.score}>{safeScore ?? translateUI("—")}</Text>
            <View>
              <Text style={styles.outOf}>{translateUI("/10")}</Text>
              <Text style={styles.scoreLabel}>{translateUI("PELLIX PUANIM")}</Text>
            </View>
          </View>
        </View>
      </View>

      {!!note && (
        <View style={styles.noteBox}>
          <Text style={styles.quote}>{translateUI("“")}</Text>
          <Text style={styles.note} numberOfLines={3}>{note}</Text>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>{translateUI("İzledim. Puanladım. Önerilerim biraz daha netleşti.")}</Text>
        {!!onPress && <Text style={styles.openText}>{translateUI("İçeriği aç →")}</Text>}
      </View>
    </View>
  );

  if (!onPress) return card;
  return <TouchableOpacity onPress={onPress} activeOpacity={0.9}>{card}</TouchableOpacity>;
}

const styles = StyleSheet.create({
  card: { marginTop: 12, borderRadius: 20, padding: 16, overflow: "hidden", backgroundColor: "#14121a", borderWidth: 1, borderColor: "rgba(201,164,76,0.3)" },
  goldGlow: { position: "absolute", left: 0, right: 0, top: 0, height: 120 },
  topRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  brand: { color: GOLD, fontFamily: FONTS.marquee, fontSize: 15, lineHeight: 17, letterSpacing: 3 },
  type: { color: DIM, fontFamily: FONTS.monoMedium, fontSize: 7.5, letterSpacing: 1.1, marginTop: 2 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: "rgba(201,164,76,0.45)" },
  badgeText: { color: GOLD, fontFamily: FONTS.monoMedium, fontSize: 7.5, letterSpacing: 0.8 },
  movieRow: { flexDirection: "row", gap: 14, alignItems: "center", marginTop: 16 },
  poster: { width: 74, height: 108, borderRadius: 10, backgroundColor: "rgba(243,234,216,0.06)" },
  posterEmpty: { borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  copy: { flex: 1, minWidth: 0 },
  title: { color: CREAM, fontFamily: FONTS.marquee, fontSize: 24, lineHeight: 26 },
  meta: { color: DIM, fontFamily: FONTS.monoMedium, fontSize: 9, marginTop: 4 },
  scoreRow: { flexDirection: "row", alignItems: "flex-end", gap: 6, marginTop: 12 },
  score: { color: GOLD, fontFamily: FONTS.marquee, fontSize: 48, lineHeight: 48 },
  outOf: { color: CREAM, fontFamily: FONTS.marquee, fontSize: 16, marginBottom: 2 },
  scoreLabel: { color: DIM, fontFamily: FONTS.monoMedium, fontSize: 7, letterSpacing: 0.8, marginBottom: 5 },
  noteBox: { marginTop: 14, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: "rgba(243,234,216,0.04)", borderWidth: 1, borderColor: "rgba(243,234,216,0.08)", flexDirection: "row", gap: 7 },
  quote: { color: GOLD, fontSize: 22, lineHeight: 22, fontWeight: "900" },
  note: { flex: 1, color: CREAM, fontSize: 10.5, lineHeight: 15, fontWeight: "600" },
  footer: { marginTop: 14, paddingTop: 11, borderTopWidth: 1, borderTopColor: "rgba(201,164,76,0.18)", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  footerText: { flex: 1, color: DIM, fontSize: 8.5, fontWeight: "700" },
  openText: { color: GOLD, fontFamily: FONTS.monoMedium, fontSize: 8.5 },
});
