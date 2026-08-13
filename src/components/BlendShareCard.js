import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Sparkles, Film } from "lucide-react-native";
import { avatarOr } from "../utils/avatar";
import { verdictFor } from "../utils/blendVerdict";
import RetryImage from "./RetryImage";

// Sadece görsel — yakalanıp paylaşılacak kart. Mantık ShareCardModal'da.
export default function BlendShareCard({
  myAvatar, myId, myName, friendAvatar, friendId, friendName, matchPercent,
  commonCount = 0, topGenre, posters = [],
}) {
  const hasPosters = posters.filter(Boolean).length > 0;

  return (
    <LinearGradient colors={["#0EA5E9", "#6366F1", "#8B5CF6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      {/* Dağınık konfeti dokusu — tek bir soluk ikon yerine, tüm kartı canlandıran bir doku */}
      <Sparkles size={26} color="rgba(255,255,255,0.22)" style={{ position: "absolute", top: 26, left: 22 }} />
      <Sparkles size={16} color="rgba(255,255,255,0.28)" style={{ position: "absolute", top: 74, right: 30 }} />
      <Sparkles size={20} color="rgba(255,255,255,0.18)" style={{ position: "absolute", bottom: 120, left: 18 }} />
      <Film size={70} color="rgba(255,255,255,0.08)" style={{ position: "absolute", bottom: -10, right: -14 }} />

      <Text style={styles.logo}>pell<Text style={{ fontWeight: "900" }}>i</Text>x</Text>

      <View style={styles.avatarRow}>
        <RetryImage source={{ uri: avatarOr(myAvatar, myId) }} style={[styles.avatar, { marginRight: -18, zIndex: 2 }]} />
        <RetryImage source={{ uri: avatarOr(friendAvatar, friendId) }} style={styles.avatar} />
      </View>
      <Text style={styles.names}>{(myName || "").split(" ")[0]} × {(friendName || "").split(" ")[0]}</Text>

      <View style={styles.percentWrap}>
        <Text style={styles.percent}>%{matchPercent}</Text>
        <View style={styles.percentLabelWrap}>
          <Sparkles size={11} color="rgba(255,255,255,0.85)" />
          <Text style={styles.percentLabel}>ZEVK UYUMU</Text>
        </View>
      </View>

      <Text style={styles.verdict}>{verdictFor(matchPercent)}</Text>

      {(commonCount > 0 || topGenre) && (
        <View style={styles.statRow}>
          {commonCount > 0 && (
            <View style={styles.statChip}>
              <Text style={styles.statChipText}>{commonCount} ORTAK FAVORİ</Text>
            </View>
          )}
          {topGenre && (
            <View style={styles.statChip}>
              <Text style={styles.statChipText}>{topGenre.toLocaleUpperCase("tr-TR")}</Text>
            </View>
          )}
        </View>
      )}

      {hasPosters ? (
        <View style={styles.postersRow}>
          {posters.slice(0, 4).map((p, i) => (
            p ? <RetryImage key={i} source={{ uri: p }} style={styles.poster} /> : <View key={i} style={[styles.poster, { backgroundColor: "rgba(255,255,255,0.15)" }]} />
          ))}
        </View>
      ) : (
        <View style={styles.emptyFill}>
          <Text style={styles.emptyText}>Henüz ortak favori yok{"\n"}ama uyumunuz güçlü 💪</Text>
        </View>
      )}

      <Text style={styles.footer}>pellix'te keşfedin 🎬</Text>
    </LinearGradient>
  );
}

const CARD_WIDTH = 320;

const styles = StyleSheet.create({
  // ÖNEMLİ DÜZELTME: Sabit bir yükseklik (CARD_WIDTH * 1.72) veriliyordu — gerçek cihazlarda
  // (özellikle 64px'lik büyük yüzde yazısının gerçek satır yüksekliği font/cihaza göre
  // değişebildiği için) içerik bu sabit yüksekliği aşıp karta sığmıyordu. Sabit yüksekliği
  // kaldırıp kartın içeriğine göre KENDİ boyunu belirlemesine izin verdik — bu, hangi cihazda/
  // fontta render edilirse edilsin içeriğin asla taşmayacağını garanti ediyor.
  card: {
    width: CARD_WIDTH, borderRadius: 28,
    alignItems: "center", paddingTop: 32, paddingBottom: 26, paddingHorizontal: 24,
    overflow: "hidden",
  },
  logo: { fontFamily: "Baloo2_800ExtraBold", fontSize: 17, color: "#fff", opacity: 0.95, marginBottom: 26 },
  avatarRow: { flexDirection: "row" },
  avatar: { width: 68, height: 68, borderRadius: 999, borderWidth: 3, borderColor: "rgba(255,255,255,0.5)" },
  names: { fontSize: 16, fontWeight: "700", color: "#fff", marginTop: 16 },
  percentWrap: { alignItems: "center", marginTop: 26 },
  percent: { fontSize: 64, fontWeight: "800", color: "#fff" },
  percentLabelWrap: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  percentLabel: { fontSize: 12, fontWeight: "800", color: "rgba(255,255,255,0.85)", letterSpacing: 1.5 },
  verdict: { fontSize: 15, fontWeight: "800", color: "#fff", marginTop: 12 },
  statRow: { flexDirection: "row", gap: 8, marginTop: 16, flexWrap: "wrap", justifyContent: "center" },
  statChip: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  statChipText: { fontSize: 10, fontWeight: "800", color: "#fff", letterSpacing: 0.5 },
  postersRow: { flexDirection: "row", gap: 8, marginTop: 24 },
  poster: { width: 54, height: 80, borderRadius: 8 },
  emptyFill: { marginTop: 22, alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: 12, fontWeight: "700", color: "rgba(255,255,255,0.85)", textAlign: "center", lineHeight: 18 },
  footer: { fontFamily: "Baloo2_700Bold", fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 22 },
});
