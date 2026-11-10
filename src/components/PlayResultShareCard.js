import { t as translateUI, getLocale } from "../i18n/core";
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Sparkles, Swords, Users, Trophy, Quote, Wand2 } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { FONTS } from "../theme/fonts";
import RetryImage from "./RetryImage";
import { avatarOr } from "../utils/avatar";

// Salon dili (Günün Seansı story kartıyla aynı aile): koyu zemin, üstte soluk altın spot,
// Big Shoulders başlık, DM Mono künye. Paylaşılan görsel olduğu için renkler temadan bağımsız.
const CREAM = "#f3ead8";
const DIM = "#8c8579";
const GOLD = "#c9a44c";

function friendVerdict(percent) {
  if (percent >= 90) return "Neleri sevdiğini ezbere biliyorsun 🏆";
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
  return "Tek bir kutuya sığmıyorsun";
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
  const Icon = isFriend ? Users : isQuote ? Quote : isCharacter ? Wand2 : Swords;

  return (
    <View style={styles.card}>
      <LinearGradient colors={["rgba(201,164,76,0.18)", "rgba(201,164,76,0)"]} style={styles.glowOne} pointerEvents="none" />

      <Text style={styles.logo}>PELLIX PLAY</Text>

      <View style={styles.iconBubble}>
        <Icon size={24} color={GOLD} />
      </View>
      <Text style={styles.eyebrow}>{isFriend ? translateUI("ARKADAŞINI TANIYOR MUSUN?") : isQuote ? translateUI("SAHNEYİ HATIRLA") : isCharacter ? translateUI("HANGİ KARAKTERSİN?") : translateUI("TASTE BATTLE")}</Text>

      {isCharacter ? (
        <>
          {character?.actorPhoto ? (
            <View>
              <RetryImage source={{ uri: character.actorPhoto }} style={styles.avatar} />
              <View style={styles.charEmojiBadge}><Text style={{ fontSize: 14 }}>{character?.emoji}</Text></View>
            </View>
          ) : (
            <Text style={{ fontSize: 44, marginTop: 16 }}>{character?.emoji}</Text>
          )}
          <Text style={styles.resultTitle}>{character?.name}</Text>
          <Text style={styles.meta}>{character?.title}</Text>
          <View style={styles.chip}><Sparkles size={12} color={GOLD} /><Text style={styles.chipText}>{translateUI("%")}{matchPercent}{translateUI(" UYUM")}</Text></View>
          <Text style={styles.verdict}>{character?.blurb}</Text>
        </>
      ) : isFriend ? (
        <>
          <RetryImage source={{ uri: avatarOr(friend?.avatarUrl, friend?.id) }} style={styles.avatar} />
          <Text style={styles.friendName}>{friend?.name || translateUI("Arkadaşım")}</Text>
          <View style={styles.bigNumberWrap}>
            <Text style={styles.bigNumber}>{translateUI("%")}{percent}</Text>
            <Text style={styles.bigLabel}>{translateUI("TANIMA SKORU")}</Text>
          </View>
          <Text style={styles.verdict}>{translateUI(friendVerdict(percent))}</Text>
          <View style={styles.chip}><Trophy size={12} color={GOLD} /><Text style={styles.chipText}>{score}{translateUI("/")}{total}{translateUI(" DOĞRU")}</Text></View>
        </>
      ) : isQuote ? (
        <>
          <View style={styles.bigNumberWrap}>
            <Text style={styles.bigNumber}>{score}{translateUI("/")}{total}</Text>
            <Text style={styles.bigLabel}>{isDaily ? translateUI("GÜNÜN CHALLENGE'I") : translateUI("DOĞRU CEVAP")}</Text>
          </View>
          <Text style={styles.verdict}>{translateUI(quoteVerdict(percent))}</Text>
        </>
      ) : (
        <>
          <Text style={styles.resultTitle}>{translateUI(topGenre || "Karışık")}</Text>
          <Text style={styles.verdict}>{translateUI(tasteVerdict(topGenre))}</Text>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{selectionCount}</Text>
              <Text style={styles.statLabel}>{translateUI("SEÇİM")}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{translateUI("%")}{moviePercent}</Text>
              <Text style={styles.statLabel}>{translateUI("FİLM")}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{translateUI("%")}{Math.max(0, 100 - moviePercent)}</Text>
              <Text style={styles.statLabel}>{translateUI("DİZİ")}</Text>
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

      <Text style={styles.footer}>{translateUI("Seninki ne? · pellix.app")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 320, borderRadius: 20, alignItems: "center", overflow: "hidden", paddingHorizontal: 22, paddingTop: 26, paddingBottom: 24,
    backgroundColor: "#14121a", borderWidth: 1, borderColor: "rgba(201,164,76,0.28)",
  },
  glowOne: { position: "absolute", left: 0, right: 0, top: 0, height: 200 },
  logo: { fontFamily: FONTS.marquee, fontSize: 14, letterSpacing: 3, color: GOLD, marginBottom: 20 },
  iconBubble: { width: 54, height: 54, borderRadius: 27, backgroundColor: "#100e10", borderWidth: 1.5, borderColor: GOLD, alignItems: "center", justifyContent: "center" },
  eyebrow: { color: GOLD, fontFamily: FONTS.monoMedium, fontSize: 9.5, letterSpacing: 1.3, marginTop: 12, textAlign: "center" },
  resultTitle: { color: CREAM, fontFamily: FONTS.marquee, fontSize: 40, lineHeight: 43, textAlign: "center", marginTop: 14 },
  meta: { color: DIM, fontSize: 12, fontWeight: "700", marginTop: 3, textAlign: "center" },
  verdict: { color: CREAM, opacity: 0.9, fontSize: 13.5, lineHeight: 19, fontWeight: "700", textAlign: "center", marginTop: 9, maxWidth: 255 },
  statsRow: { flexDirection: "row", gap: 8, marginTop: 20 },
  statBox: { minWidth: 78, backgroundColor: "rgba(243,234,216,0.05)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 11, alignItems: "center", borderWidth: 1, borderColor: "rgba(243,234,216,0.10)" },
  statValue: { color: CREAM, fontFamily: FONTS.marquee, fontSize: 24 },
  statLabel: { color: DIM, fontFamily: FONTS.monoMedium, fontSize: 8.5, letterSpacing: 1, marginTop: 2 },
  postersRow: { flexDirection: "row", gap: 7, marginTop: 18 },
  poster: { width: 55, height: 82, borderRadius: 6, borderWidth: 1, borderColor: "rgba(243,234,216,0.16)" },
  avatar: { width: 82, height: 82, borderRadius: 41, borderWidth: 2, borderColor: GOLD, marginTop: 18 },
  charEmojiBadge: { position: "absolute", right: -4, bottom: 4, width: 30, height: 30, borderRadius: 15, backgroundColor: "#100e10", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: GOLD },
  friendName: { color: CREAM, fontFamily: FONTS.marquee, fontSize: 26, marginTop: 8, textAlign: "center" },
  bigNumberWrap: { alignItems: "center", marginTop: 14 },
  bigNumber: { color: GOLD, fontFamily: FONTS.marquee, fontSize: 72, lineHeight: 76 },
  bigLabel: { color: DIM, fontFamily: FONTS.monoMedium, fontSize: 9.5, letterSpacing: 1.3 },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 14, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(201,164,76,0.45)" },
  chipText: { color: GOLD, fontFamily: FONTS.monoMedium, fontSize: 9.5, letterSpacing: 0.8 },
  footer: { color: DIM, fontFamily: FONTS.monoMedium, fontSize: 9.5, letterSpacing: 1, marginTop: 22 },
});
