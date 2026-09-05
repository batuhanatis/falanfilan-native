import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Eye, Sparkles, Trophy } from "lucide-react-native";

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

export default function PosterPuzzleShareCard({ date, correct, wrongCount = 0, squares = "" }) {
  const resultText = correct ? "Posteri çözdüm" : "Poster bugün beni yendi";

  return (
    <LinearGradient
      colors={["#0B0B12", "#17122A", "#2B1760"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.glowOne} />
      <View style={styles.glowTwo} />
      <Sparkles size={22} color="rgba(255,215,106,0.28)" style={styles.sparkleOne} />
      <Eye size={100} color="rgba(167,139,250,0.07)" style={styles.eyeMark} />

      <View style={styles.brandRow}>
        <Text style={styles.logo}>pellix</Text>
        <View style={styles.dailyBadge}>
          <Text style={styles.dailyBadgeText}>GÜNÜN OYUNU</Text>
        </View>
      </View>

      <View style={styles.iconBubble}>
        {correct ? <Trophy size={26} color="#FFD76A" /> : <Eye size={26} color="#C4B5FD" />}
      </View>
      <Text style={styles.eyebrow}>POSTER PUZZLE · {dayLabel(date)}</Text>
      <Text style={styles.title}>{resultText}</Text>

      <View style={styles.resultPanel}>
        <Text style={styles.squares}>{squares || (correct ? "🟩⬛⬛" : "🟥🟥🟥")}</Text>
        <Text style={styles.attemptLabel}>{attemptsLabel(correct, wrongCount)}</Text>
      </View>

      <Text style={styles.challenge}>Cevabı göstermiyorum. Sen kaçta bulacaksın?</Text>

      <View style={styles.footerRow}>
        <Text style={styles.footer}>pellix.app</Text>
        <Text style={styles.footerDot}>•</Text>
        <Text style={styles.footer}>Her gün yeni poster</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 320,
    minHeight: 458,
    borderRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 25,
    paddingBottom: 24,
    alignItems: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  glowOne: {
    position: "absolute", width: 230, height: 230, borderRadius: 999,
    backgroundColor: "rgba(124,58,237,0.22)", top: -145, right: -70,
  },
  glowTwo: {
    position: "absolute", width: 190, height: 190, borderRadius: 999,
    backgroundColor: "rgba(37,99,235,0.13)", bottom: -120, left: -85,
  },
  sparkleOne: { position: "absolute", top: 86, left: 28 },
  eyeMark: { position: "absolute", right: -25, bottom: 48 },
  brandRow: {
    width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  logo: { fontFamily: "Baloo2_800ExtraBold", fontSize: 19, color: "#fff" },
  dailyBadge: {
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: "rgba(255,215,106,0.12)", borderWidth: 1, borderColor: "rgba(255,215,106,0.24)",
  },
  dailyBadgeText: { color: "#FFD76A", fontSize: 8.5, fontWeight: "900", letterSpacing: 0.8 },
  iconBubble: {
    width: 58, height: 58, borderRadius: 20, marginTop: 45,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
  eyebrow: { color: "#A78BFA", fontSize: 9.5, fontWeight: "900", letterSpacing: 1.1, marginTop: 14 },
  title: { color: "#fff", fontSize: 28, lineHeight: 33, fontWeight: "900", textAlign: "center", marginTop: 7 },
  resultPanel: {
    width: "100%", marginTop: 24, paddingVertical: 20, paddingHorizontal: 15,
    alignItems: "center", borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
  },
  squares: { fontSize: 34, letterSpacing: 6, textAlign: "center" },
  attemptLabel: { color: "rgba(255,255,255,0.72)", fontSize: 9.5, fontWeight: "900", letterSpacing: 1, marginTop: 12 },
  challenge: { color: "rgba(255,255,255,0.86)", fontSize: 12, lineHeight: 18, fontWeight: "700", textAlign: "center", marginTop: 22, maxWidth: 240 },
  footerRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 28 },
  footer: { color: "rgba(255,255,255,0.58)", fontSize: 10.5, fontWeight: "700" },
  footerDot: { color: "rgba(255,255,255,0.30)", fontSize: 10 },
});
