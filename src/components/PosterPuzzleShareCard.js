import { t as translateUI } from "../i18n/core";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Eye, Trophy } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { FONTS } from "../theme/fonts";

// Salon dili (Günün Seansı story kartıyla aynı aile): koyu zemin, üstte soluk altın spot,
// Big Shoulders başlık, DM Mono künye. Paylaşılan görsel olduğu için renkler temadan bağımsız.
const CREAM = "#f3ead8";
const DIM = "#8c8579";
const GOLD = "#c9a44c";

const MAX_WRONG = 3;

function attemptsLabel(correct, wrongCount) {
  if (!correct) return "BUGÜN OLMADI";
  const attempts = Math.min(MAX_WRONG, Number(wrongCount || 0) + 1);
  return `${attempts}. DENEMEDE BİLDİ`;
}

function dayLabel(date) {
  if (!date) return "BUGÜN";
  const parts = String(date).split("-");
  if (parts.length !== 3) return String(date);
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

export default function PosterPuzzleShareCard({ date, number = null, correct, wrongCount = 0, squares = "" }) {
  const resultText = correct ? "Posteri çözdüm" : "Poster bugün beni yendi";

  return (
    <View style={styles.card}>
      <LinearGradient colors={["rgba(201,164,76,0.18)", "rgba(201,164,76,0)"]} style={styles.glowOne} pointerEvents="none" />

      <View style={styles.brandRow}>
        <Text style={styles.logo}>PELLIX</Text>
        <View style={styles.dailyBadge}>
          <Text style={styles.dailyBadgeText}>{translateUI("GÜNÜN OYUNU")}</Text>
        </View>
      </View>

      <View style={styles.iconBubble}>
        {correct ? <Trophy size={24} color={GOLD} /> : <Eye size={24} color={CREAM} />}
      </View>
      <Text style={styles.eyebrow}>{translateUI("POSTER PUZZLE")}{number ? ` #${number}` : ""}{translateUI(" · ")}{translateUI(dayLabel(date))}</Text>
      <Text style={styles.title}>{resultText}</Text>

      <View style={styles.resultPanel}>
        <Text style={styles.squares}>{squares || (correct ? translateUI("🟩⬛⬛") : translateUI("🟥🟥🟥"))}</Text>
        <Text style={styles.attemptLabel}>{translateUI(attemptsLabel(correct, wrongCount))}</Text>
      </View>

      <Text style={styles.challenge}>{translateUI("Cevabı göstermiyorum. Sen kaçta bulacaksın?")}</Text>

      <View style={styles.footerRow}>
        <Text style={styles.footer}>{translateUI("pellix.app")}</Text>
        <Text style={styles.footerDot}>{translateUI("•")}</Text>
        <Text style={styles.footer}>{translateUI("Her gün yeni poster")}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 320, minHeight: 458, borderRadius: 20, paddingHorizontal: 24, paddingTop: 25, paddingBottom: 24,
    alignItems: "center", overflow: "hidden", backgroundColor: "#14121a", borderWidth: 1, borderColor: "rgba(201,164,76,0.28)",
  },
  glowOne: { position: "absolute", left: 0, right: 0, top: 0, height: 200 },
  brandRow: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  logo: { fontFamily: FONTS.marquee, fontSize: 15, letterSpacing: 3, color: GOLD },
  dailyBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: "rgba(201,164,76,0.45)" },
  dailyBadgeText: { color: GOLD, fontFamily: FONTS.monoMedium, fontSize: 8.5, letterSpacing: 1 },
  iconBubble: { width: 58, height: 58, borderRadius: 29, marginTop: 45, alignItems: "center", justifyContent: "center", backgroundColor: "#100e10", borderWidth: 1.5, borderColor: GOLD },
  eyebrow: { color: GOLD, fontFamily: FONTS.monoMedium, fontSize: 9.5, letterSpacing: 1.3, marginTop: 14 },
  title: { color: CREAM, fontFamily: FONTS.marquee, fontSize: 38, lineHeight: 41, textAlign: "center", marginTop: 6 },
  resultPanel: {
    width: "100%", marginTop: 22, paddingVertical: 20, paddingHorizontal: 15, alignItems: "center", borderRadius: 14,
    backgroundColor: "rgba(243,234,216,0.05)", borderWidth: 1, borderColor: "rgba(243,234,216,0.10)",
  },
  squares: { fontSize: 34, letterSpacing: 6, textAlign: "center" },
  attemptLabel: { color: DIM, fontFamily: FONTS.monoMedium, fontSize: 9.5, letterSpacing: 1.2, marginTop: 12 },
  challenge: { color: CREAM, opacity: 0.88, fontSize: 12.5, lineHeight: 18, fontWeight: "700", textAlign: "center", marginTop: 22, maxWidth: 250 },
  footerRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 28 },
  footer: { color: DIM, fontFamily: FONTS.monoMedium, fontSize: 9.5, letterSpacing: 1 },
  footerDot: { color: DIM, fontSize: 10, opacity: 0.6 },
});
