import { t as translateUI } from "../i18n/core";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Film, HeartHandshake, Sparkles } from "lucide-react-native";
import { avatarOr } from "../utils/avatar";
import { verdictFor } from "../utils/blendVerdict";
import RetryImage from "./RetryImage";
import { FONTS } from "../theme/fonts";

// Salon: koyu kart, üstten altın ışık, Big Shoulders yüzde, DM Mono künye.
const GOLD = "#c9a44c";
const CREAM = "#f3ead8";
const DIM = "#8c8579";

function firstName(value) {
  return String(value || "").trim().split(/\s+/)[0] || "Pellix";
}

export default function BlendShareCard({
  myAvatar,
  myId,
  myName,
  friendAvatar,
  friendId,
  friendName,
  matchPercent,
  commonCount = 0,
  topGenre,
  posters = [],
}) {
  const percent = Math.max(0, Math.min(100, Math.round(Number(matchPercent || 0))));
  const visiblePosters = posters.filter(Boolean).slice(0, 4);

  return (
    <View style={styles.card}>
      <LinearGradient colors={["rgba(201,164,76,0.2)", "rgba(201,164,76,0)"]} style={styles.wash} pointerEvents="none" />
      <Film size={88} color="rgba(201,164,76,0.06)" style={styles.filmMark} />

      <View style={styles.topRow}>
        <View>
          <Text style={styles.logo}>PELLIX</Text>
          <Text style={styles.cardType}>{translateUI("TASTE BLEND")}</Text>
        </View>
        <View style={styles.liveBadge}>
          <HeartHandshake size={11} color={GOLD} />
          <Text style={styles.liveBadgeText}>{translateUI("İKİ İZLEYİCİ · TEK SKOR")}</Text>
        </View>
      </View>

      <View style={styles.avatarArea}>
        <RetryImage source={{ uri: avatarOr(myAvatar, myId) }} style={[styles.avatar, styles.avatarLeft]} />
        <View style={styles.linkBadge}>
          <Text style={styles.linkBadgeText}>{translateUI("×")}</Text>
        </View>
        <RetryImage source={{ uri: avatarOr(friendAvatar, friendId) }} style={[styles.avatar, styles.avatarRight]} />
      </View>

      <Text style={styles.names} numberOfLines={1}>{firstName(myName)}{translateUI(" × ")}{firstName(friendName)}</Text>
      <Text style={styles.subline}>{translateUI("Pellix ortak beğenilerinizi ölçtü")}</Text>

      <View style={styles.scoreBlock}>
        <Text style={styles.percent}>{translateUI("%")}{percent}</Text>
        <Text style={styles.percentLabel}>{translateUI("UYUM")}</Text>
        <View style={styles.scoreTrack}>
          <View style={[styles.scoreFill, { width: `${Math.max(3, percent)}%` }]} />
        </View>
      </View>

      <View style={styles.verdictBox}>
        <Sparkles size={13} color={GOLD} />
        <Text style={styles.verdict}>{verdictFor(percent)}</Text>
      </View>

      <View style={styles.signalRow}>
        <View style={styles.signalCard}>
          <Text style={styles.signalValue}>{Number(commonCount || 0)}</Text>
          <Text style={styles.signalLabel}>{translateUI("ORTAK FAVORİ")}</Text>
        </View>
        <View style={styles.signalCard}>
          <Text style={styles.signalValue} numberOfLines={1}>{topGenre || translateUI("Karışık")}</Text>
          <Text style={styles.signalLabel}>{translateUI("ORTAK DAMAR")}</Text>
        </View>
      </View>

      {visiblePosters.length > 0 && (
        <View style={styles.posterSection}>
          <Text style={styles.posterEyebrow}>{translateUI("ORTAK EVRENİNİZDEN")}</Text>
          <View style={styles.postersRow}>
            {visiblePosters.map((poster, index) => (
              <RetryImage key={`${poster}-${index}`} source={{ uri: poster }} style={styles.poster} />
            ))}
          </View>
        </View>
      )}

      <View style={styles.footerRow}>
        <Text style={styles.footer}>{translateUI("pellix.app")}</Text>
        <Text style={styles.footerAccent}>{translateUI("Sen kiminle aynı frekanstasın?")}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 320,
    minHeight: 528,
    borderRadius: 24,
    paddingHorizontal: 23,
    paddingTop: 24,
    paddingBottom: 23,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(201,164,76,0.3)",
    backgroundColor: "#14121a",
  },
  wash: { position: "absolute", left: 0, right: 0, top: 0, height: 260 },
  filmMark: { position: "absolute", left: -18, bottom: 40 },
  topRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  logo: { fontFamily: FONTS.marquee, fontSize: 18, lineHeight: 20, letterSpacing: 3, color: GOLD },
  cardType: { color: DIM, fontFamily: FONTS.monoMedium, fontSize: 8, letterSpacing: 1.5, marginTop: 2 },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(201,164,76,0.45)" },
  liveBadgeText: { color: GOLD, fontFamily: FONTS.monoMedium, fontSize: 7.2, letterSpacing: 0.5 },
  avatarArea: { height: 90, marginTop: 27, alignItems: "center", justifyContent: "center", flexDirection: "row" },
  avatar: { width: 76, height: 76, borderRadius: 999, borderWidth: 2, borderColor: GOLD },
  avatarLeft: { marginRight: -10, zIndex: 2 },
  avatarRight: { marginLeft: -10, zIndex: 1 },
  linkBadge: { width: 27, height: 27, borderRadius: 999, marginHorizontal: -4, zIndex: 4, backgroundColor: GOLD, borderWidth: 2, borderColor: "#14121a", alignItems: "center", justifyContent: "center" },
  linkBadgeText: { color: "#1a150c", fontSize: 14, fontWeight: "900", lineHeight: 16 },
  names: { color: CREAM, fontFamily: FONTS.marquee, fontSize: 26, lineHeight: 28, textAlign: "center", marginTop: 10 },
  subline: { color: DIM, fontSize: 9.5, textAlign: "center", marginTop: 3 },
  scoreBlock: { alignItems: "center", marginTop: 19 },
  percent: { color: GOLD, fontFamily: FONTS.marquee, fontSize: 72, lineHeight: 74 },
  percentLabel: { color: DIM, fontFamily: FONTS.monoMedium, fontSize: 9, letterSpacing: 1.6 },
  scoreTrack: { width: "78%", height: 5, borderRadius: 999, overflow: "hidden", backgroundColor: "rgba(243,234,216,0.08)", marginTop: 10 },
  scoreFill: { height: 5, borderRadius: 999, backgroundColor: GOLD },
  verdictBox: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, marginTop: 15, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: "rgba(201,164,76,0.4)" },
  verdict: { color: CREAM, fontSize: 10.5, fontWeight: "800", maxWidth: 205, textAlign: "center" },
  signalRow: { flexDirection: "row", gap: 8, marginTop: 17 },
  signalCard: { flex: 1, minHeight: 59, borderRadius: 15, alignItems: "center", justifyContent: "center", paddingHorizontal: 8, backgroundColor: "rgba(243,234,216,0.04)", borderWidth: 1, borderColor: "rgba(243,234,216,0.08)" },
  signalValue: { color: CREAM, fontFamily: FONTS.marquee, fontSize: 19, maxWidth: "100%" },
  signalLabel: { color: DIM, fontFamily: FONTS.monoMedium, fontSize: 7.2, letterSpacing: 0.6, marginTop: 3 },
  posterSection: { marginTop: 17 },
  posterEyebrow: { color: GOLD, fontFamily: FONTS.monoMedium, fontSize: 7.5, letterSpacing: 1, marginBottom: 8 },
  postersRow: { flexDirection: "row", gap: 7, justifyContent: "center" },
  poster: { width: 56, height: 82, borderRadius: 8, borderWidth: 1, borderColor: "rgba(201,164,76,0.28)" },
  footerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 20 },
  footer: { color: GOLD, fontFamily: FONTS.monoMedium, fontSize: 9, letterSpacing: 1.2 },
  footerAccent: { color: DIM, fontSize: 8.7, fontWeight: "700" },
});
