import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Film, HeartHandshake, Sparkles } from "lucide-react-native";
import { avatarOr } from "../utils/avatar";
import { verdictFor } from "../utils/blendVerdict";
import RetryImage from "./RetryImage";

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
    <LinearGradient
      colors={["#090A11", "#11152B", "#24143D"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.blueGlow} />
      <View style={styles.purpleGlow} />
      <Sparkles size={24} color="rgba(96,165,250,0.22)" style={styles.sparkleOne} />
      <Film size={88} color="rgba(167,139,250,0.055)" style={styles.filmMark} />

      <View style={styles.topRow}>
        <View>
          <Text style={styles.logo}>pellix</Text>
          <Text style={styles.cardType}>TASTE BLEND</Text>
        </View>
        <View style={styles.liveBadge}>
          <HeartHandshake size={11} color="#C4B5FD" />
          <Text style={styles.liveBadgeText}>İKİ ZEVK · TEK SKOR</Text>
        </View>
      </View>

      <View style={styles.avatarArea}>
        <View style={styles.avatarHaloLeft} />
        <View style={styles.avatarHaloRight} />
        <RetryImage source={{ uri: avatarOr(myAvatar, myId) }} style={[styles.avatar, styles.avatarLeft]} />
        <View style={styles.linkBadge}>
          <Text style={styles.linkBadgeText}>×</Text>
        </View>
        <RetryImage source={{ uri: avatarOr(friendAvatar, friendId) }} style={[styles.avatar, styles.avatarRight]} />
      </View>

      <Text style={styles.names} numberOfLines={1}>{firstName(myName)} × {firstName(friendName)}</Text>
      <Text style={styles.subline}>Pellix zevklerinizin kesişimini ölçtü</Text>

      <View style={styles.scoreBlock}>
        <Text style={styles.percent}>%{percent}</Text>
        <Text style={styles.percentLabel}>ZEVK UYUMU</Text>
        <View style={styles.scoreTrack}>
          <LinearGradient
            colors={["#38BDF8", "#8B5CF6", "#F472B6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.scoreFill, { width: `${Math.max(3, percent)}%` }]}
          />
        </View>
      </View>

      <View style={styles.verdictBox}>
        <Sparkles size={13} color="#FFD76A" />
        <Text style={styles.verdict}>{verdictFor(percent)}</Text>
      </View>

      <View style={styles.signalRow}>
        <View style={styles.signalCard}>
          <Text style={styles.signalValue}>{Number(commonCount || 0)}</Text>
          <Text style={styles.signalLabel}>ORTAK FAVORİ</Text>
        </View>
        <View style={styles.signalCard}>
          <Text style={styles.signalValue} numberOfLines={1}>{topGenre || "Karışık"}</Text>
          <Text style={styles.signalLabel}>ORTAK DAMAR</Text>
        </View>
      </View>

      {visiblePosters.length > 0 && (
        <View style={styles.posterSection}>
          <Text style={styles.posterEyebrow}>ORTAK EVRENİNİZDEN</Text>
          <View style={styles.postersRow}>
            {visiblePosters.map((poster, index) => (
              <RetryImage key={`${poster}-${index}`} source={{ uri: poster }} style={styles.poster} />
            ))}
          </View>
        </View>
      )}

      <View style={styles.footerRow}>
        <Text style={styles.footer}>pellix.app</Text>
        <Text style={styles.footerAccent}>Sen kiminle aynı frekanstasın?</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 320,
    minHeight: 528,
    borderRadius: 30,
    paddingHorizontal: 23,
    paddingTop: 24,
    paddingBottom: 23,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  blueGlow: {
    position: "absolute", width: 220, height: 220, borderRadius: 999,
    backgroundColor: "rgba(14,165,233,0.14)", top: -135, left: -95,
  },
  purpleGlow: {
    position: "absolute", width: 230, height: 230, borderRadius: 999,
    backgroundColor: "rgba(139,92,246,0.16)", bottom: -155, right: -95,
  },
  sparkleOne: { position: "absolute", right: 26, top: 92 },
  filmMark: { position: "absolute", left: -18, bottom: 40 },
  topRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  logo: { fontFamily: "Baloo2_800ExtraBold", fontSize: 20, lineHeight: 22, color: "#fff" },
  cardType: { color: "rgba(255,255,255,0.42)", fontSize: 8, fontWeight: "900", letterSpacing: 1.5, marginTop: 1 },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: "rgba(167,139,250,0.10)", borderWidth: 1, borderColor: "rgba(167,139,250,0.20)" },
  liveBadgeText: { color: "#C4B5FD", fontSize: 7.2, fontWeight: "900", letterSpacing: 0.5 },
  avatarArea: { height: 90, marginTop: 27, alignItems: "center", justifyContent: "center", flexDirection: "row" },
  avatarHaloLeft: { position: "absolute", left: 50, width: 79, height: 79, borderRadius: 999, backgroundColor: "rgba(56,189,248,0.12)" },
  avatarHaloRight: { position: "absolute", right: 50, width: 79, height: 79, borderRadius: 999, backgroundColor: "rgba(244,114,182,0.10)" },
  avatar: { width: 76, height: 76, borderRadius: 999, borderWidth: 3, borderColor: "rgba(255,255,255,0.72)" },
  avatarLeft: { marginRight: -10, zIndex: 2 },
  avatarRight: { marginLeft: -10, zIndex: 1 },
  linkBadge: { width: 27, height: 27, borderRadius: 999, marginHorizontal: -4, zIndex: 4, backgroundColor: "#141627", borderWidth: 2, borderColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  linkBadgeText: { color: "#fff", fontSize: 14, fontWeight: "900", lineHeight: 16 },
  names: { color: "#fff", fontSize: 18, fontWeight: "900", textAlign: "center", marginTop: 10 },
  subline: { color: "rgba(255,255,255,0.48)", fontSize: 9.5, textAlign: "center", marginTop: 3 },
  scoreBlock: { alignItems: "center", marginTop: 19 },
  percent: { color: "#fff", fontSize: 58, lineHeight: 62, fontWeight: "900", letterSpacing: -2 },
  percentLabel: { color: "rgba(255,255,255,0.60)", fontSize: 8.5, fontWeight: "900", letterSpacing: 1.4 },
  scoreTrack: { width: "78%", height: 5, borderRadius: 999, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.08)", marginTop: 10 },
  scoreFill: { height: 5, borderRadius: 999 },
  verdictBox: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, marginTop: 15, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: "rgba(255,215,106,0.08)", borderWidth: 1, borderColor: "rgba(255,215,106,0.17)" },
  verdict: { color: "#FFE8A3", fontSize: 10.5, fontWeight: "800", maxWidth: 205, textAlign: "center" },
  signalRow: { flexDirection: "row", gap: 8, marginTop: 17 },
  signalCard: { flex: 1, minHeight: 59, borderRadius: 15, alignItems: "center", justifyContent: "center", paddingHorizontal: 8, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  signalValue: { color: "#fff", fontSize: 13, fontWeight: "900", maxWidth: "100%" },
  signalLabel: { color: "rgba(255,255,255,0.40)", fontSize: 7.1, fontWeight: "900", letterSpacing: 0.55, marginTop: 3 },
  posterSection: { marginTop: 17 },
  posterEyebrow: { color: "rgba(255,255,255,0.40)", fontSize: 7.5, fontWeight: "900", letterSpacing: 0.9, marginBottom: 8 },
  postersRow: { flexDirection: "row", gap: 7, justifyContent: "center" },
  poster: { width: 56, height: 82, borderRadius: 9, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" },
  footerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 20 },
  footer: { color: "rgba(255,255,255,0.42)", fontSize: 9.5, fontWeight: "700" },
  footerAccent: { color: "rgba(255,255,255,0.68)", fontSize: 8.7, fontWeight: "800" },
});
