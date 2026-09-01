import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Sparkles, Swords, Users, Trophy, Film, Quote, Wand2 } from "lucide-react-native";
import RetryImage from "./RetryImage";
import { avatarOr } from "../utils/avatar";

function friendVerdict(percent) {
  if (percent >= 90) return "Zevkini ezbere biliyorsun 🏆";
  if (percent >= 70) return "Aynı frekanstasınız ✨";
  if (percent >= 50) return "Fena değil, biraz daha keşif 🎬";
  return "Sürprizlerle dolu bir arkadaşlık 👀";
}

function quoteVerdict(percent) {
  if (percent >= 90) return "Sinema hafızan efsane 🧠";
  if (percent >= 70) return "Gözün kulağın sahnelerde ✨";
  if (percent >= 50) return "Fena değil, biraz daha pratik 🎬";
  return "Yeniden izleme zamanı 👀";
}

function tasteVerdict(topGenre) {
  const g = String(topGenre || "").toLocaleLowerCase("tr-TR");
  if (g.includes("bilim") || g.includes("sci")) return "Zihin büken dünyaların peşindesin";
  if (g.includes("gerilim") || g.includes("thrill")) return "Gerilim yükseldikçe keyfin artıyor";
  if (g.includes("aksiyon") || g.includes("action")) return "Tempo düşmesin diyorsun";
  if (g.includes("dram")) return "Karakter ve hikâye senin için önde";
  if (g.includes("komedi") || g.includes("comedy")) return "İyi hissettiren seçimler baskın";
  if (g.includes("korku") || g.includes("horror")) return "Karanlık tarafa göz kırpıyorsun";
  if (g.includes("suç") || g.includes("crime")) return "Gri karakterler tam senlik";
  return "Zevkin tek bir kutuya sığmıyor";
}

export default function PlayResultShareCard({
  mode = "taste",
  topGenre,
  moviePercent = 0,
  selectionCount = 0,
  posters = [],
  friend,
  score = 0,
  total = 0,
  isDaily = false,
  character,
  matchPercent = 0,
}) {
  const isFriend = mode === "friend";
  const isQuote = mode === "quote";
  const isCharacter = mode === "character";
  const percent = total > 0 ? Math.round((score / total) * 100) : 0;
  const colors = isFriend
    ? ["#EC4899", "#F97316", "#F59E0B"]
    : isQuote
    ? ["#F97316", "#DB2777", "#7C3AED"]
    : isCharacter
    ? [character?.color || "#9333EA", "#DB2777", "#111827"]
    : ["#7C3AED", "#2563EB", "#0891B2"];
  const Icon = isFriend ? Users : isQuote ? Quote : isCharacter ? Wand2 : Swords;

  return (
    <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      <View style={styles.glowOne} />
      <View style={styles.glowTwo} />
      <Sparkles size={24} color="rgba(255,255,255,0.24)" style={styles.sparkleOne} />
      <Sparkles size={16} color="rgba(255,255,255,0.20)" style={styles.sparkleTwo} />
      <Film size={84} color="rgba(255,255,255,0.07)" style={styles.filmMark} />

      <Text style={styles.logo}>pellix play</Text>

      <View style={styles.iconBubble}>
        <Icon size={26} color="#fff" />
      </View>
      <Text style={styles.eyebrow}>{isFriend ? "ARKADAŞINI TANIYOR MUSUN?" : isQuote ? "SAHNEYİ HATIRLA" : isCharacter ? "HANGİ KARAKTERSİN?" : "TASTE BATTLE"}</Text>

      {isCharacter ? (
        <>
          <Text style={{ fontSize: 44, marginTop: 16 }}>{character?.emoji}</Text>
          <Text style={styles.resultTitle}>{character?.name}</Text>
          <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 12.5, fontWeight: "800", marginTop: 3 }}>{character?.title}</Text>
          <View style={styles.chip}><Sparkles size={12} color="#fff" /><Text style={styles.chipText}>%{matchPercent} UYUM</Text></View>
          <Text style={styles.verdict}>{character?.blurb}</Text>
        </>
      ) : isFriend ? (
        <>
          <RetryImage source={{ uri: avatarOr(friend?.avatarUrl, friend?.id) }} style={styles.avatar} />
          <Text style={styles.friendName}>{friend?.name || "Arkadaşım"}</Text>
          <View style={styles.bigNumberWrap}>
            <Text style={styles.bigNumber}>%{percent}</Text>
            <Text style={styles.bigLabel}>TANIMA SKORU</Text>
          </View>
          <Text style={styles.verdict}>{friendVerdict(percent)}</Text>
          <View style={styles.chip}><Trophy size={12} color="#fff" /><Text style={styles.chipText}>{score}/{total} DOĞRU</Text></View>
        </>
      ) : isQuote ? (
        <>
          <View style={styles.bigNumberWrap}>
            <Text style={styles.bigNumber}>{score}/{total}</Text>
            <Text style={styles.bigLabel}>{isDaily ? "GÜNÜN CHALLENGE'I" : "DOĞRU CEVAP"}</Text>
          </View>
          <Text style={styles.verdict}>{quoteVerdict(percent)}</Text>
        </>
      ) : (
        <>
          <Text style={styles.resultTitle}>{topGenre || "Karışık Zevk"}</Text>
          <Text style={styles.verdict}>{tasteVerdict(topGenre)}</Text>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{selectionCount}</Text>
              <Text style={styles.statLabel}>SEÇİM</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>%{moviePercent}</Text>
              <Text style={styles.statLabel}>FİLM</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>%{Math.max(0, 100 - moviePercent)}</Text>
              <Text style={styles.statLabel}>DİZİ</Text>
            </View>
          </View>

          {posters.filter(Boolean).length > 0 && (
            <View style={styles.postersRow}>
              {posters.filter(Boolean).slice(0, 4).map((poster, index) => (
                <RetryImage key={`${poster}-${index}`} source={{ uri: poster }} style={styles.poster} />
              ))}
            </View>
          )}
        </>
      )}

      <Text style={styles.footer}>Seninki ne? · pellix.app</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 320, borderRadius: 28, alignItems: "center", overflow: "hidden",
    paddingHorizontal: 22, paddingTop: 28, paddingBottom: 24,
  },
  glowOne: { position: "absolute", width: 210, height: 210, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.10)", top: -130, right: -45 },
  glowTwo: { position: "absolute", width: 150, height: 150, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.07)", bottom: -90, left: -50 },
  sparkleOne: { position: "absolute", top: 28, left: 22 },
  sparkleTwo: { position: "absolute", top: 90, right: 30 },
  filmMark: { position: "absolute", right: -14, bottom: 24 },
  logo: { fontFamily: "Baloo2_800ExtraBold", fontSize: 17, color: "#fff", marginBottom: 22 },
  iconBubble: { width: 52, height: 52, borderRadius: 18, backgroundColor: "rgba(8,9,20,0.20)", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" },
  eyebrow: { color: "rgba(255,255,255,0.82)", fontSize: 10, fontWeight: "900", letterSpacing: 1.2, marginTop: 12 },
  resultTitle: { color: "#fff", fontSize: 30, lineHeight: 36, fontWeight: "900", textAlign: "center", marginTop: 18 },
  verdict: { color: "#fff", fontSize: 14, lineHeight: 20, fontWeight: "800", textAlign: "center", marginTop: 9, maxWidth: 250 },
  statsRow: { flexDirection: "row", gap: 8, marginTop: 22 },
  statBox: { minWidth: 76, backgroundColor: "rgba(8,9,20,0.18)", borderRadius: 16, paddingHorizontal: 10, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.13)" },
  statValue: { color: "#fff", fontSize: 19, fontWeight: "900" },
  statLabel: { color: "rgba(255,255,255,0.70)", fontSize: 8.5, fontWeight: "900", letterSpacing: 0.8, marginTop: 3 },
  postersRow: { flexDirection: "row", gap: 7, marginTop: 20 },
  poster: { width: 55, height: 82, borderRadius: 9, borderWidth: 1, borderColor: "rgba(255,255,255,0.22)" },
  avatar: { width: 82, height: 82, borderRadius: 999, borderWidth: 3, borderColor: "rgba(255,255,255,0.52)", marginTop: 19 },
  friendName: { color: "#fff", fontSize: 20, fontWeight: "900", marginTop: 10, textAlign: "center" },
  bigNumberWrap: { alignItems: "center", marginTop: 18 },
  bigNumber: { color: "#fff", fontSize: 58, lineHeight: 64, fontWeight: "900" },
  bigLabel: { color: "rgba(255,255,255,0.78)", fontSize: 9.5, fontWeight: "900", letterSpacing: 1.2 },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 14, backgroundColor: "rgba(8,9,20,0.18)", borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  chipText: { color: "#fff", fontSize: 9.5, fontWeight: "900", letterSpacing: 0.6 },
  footer: { fontFamily: "Baloo2_700Bold", color: "rgba(255,255,255,0.78)", fontSize: 12, marginTop: 22 },
});
