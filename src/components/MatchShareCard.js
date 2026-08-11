import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { PartyPopper, Star } from "lucide-react-native";
import { avatarOr } from "../utils/avatar";
import RetryImage from "./RetryImage";

// Sadece görsel — yakalanıp paylaşılacak kart. Mantık ShareCardModal'da.
export default function MatchShareCard({ myAvatar, myId, myName, friendAvatar, friendId, friendName, matchCount, topMovie }) {
  return (
    <LinearGradient colors={["#7C3AED", "#DB2777", "#F97316"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      <PartyPopper size={90} color="rgba(255,255,255,0.08)" style={styles.bgIcon} />

      <Text style={styles.logo}>pell<Text style={{ fontWeight: "900" }}>i</Text>x</Text>

      <View style={styles.avatarRow}>
        <RetryImage source={{ uri: avatarOr(myAvatar, myId) }} style={[styles.avatar, { marginRight: -18, zIndex: 2 }]} />
        <RetryImage source={{ uri: avatarOr(friendAvatar, friendId) }} style={styles.avatar} />
      </View>
      <View style={styles.matchRow}>
        <PartyPopper size={16} color="#fff" />
        <Text style={styles.matchText}>EŞLEŞTİK</Text>
      </View>
      <Text style={styles.names}>{(myName || "").split(" ")[0]} × {(friendName || "").split(" ")[0]}</Text>

      {topMovie && (
        <View style={styles.movieBox}>
          {topMovie.poster ? (
            <Image source={{ uri: topMovie.poster }} style={styles.moviePoster} />
          ) : (
            <View style={[styles.moviePoster, { backgroundColor: "rgba(255,255,255,0.15)" }]} />
          )}
          <Text style={styles.movieTitle} numberOfLines={2}>{topMovie.title}</Text>
          {!!topMovie.imdb && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
              <Star size={11} color="#fff" fill="#fff" />
              <Text style={styles.movieMeta}>{topMovie.imdb}</Text>
            </View>
          )}
        </View>
      )}

      <Text style={styles.countText}>
        {matchCount > 1 ? `+${matchCount - 1} ortak eşleşme daha` : "MatchParty'de eşleştiler"}
      </Text>

      <Text style={styles.footer}>pellix'te keşfedin 🎬</Text>
    </LinearGradient>
  );
}

const CARD_WIDTH = 320;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH, height: CARD_WIDTH * 1.72, borderRadius: 28,
    alignItems: "center", paddingTop: 32, paddingBottom: 26, paddingHorizontal: 24,
    overflow: "hidden",
  },
  bgIcon: { position: "absolute", top: -18, right: -18 },
  logo: { fontFamily: "Baloo2_800ExtraBold", fontSize: 17, color: "#fff", opacity: 0.95, marginBottom: 26 },
  avatarRow: { flexDirection: "row" },
  avatar: { width: 62, height: 62, borderRadius: 999, borderWidth: 3, borderColor: "rgba(255,255,255,0.5)" },
  matchRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14, backgroundColor: "rgba(255,255,255,0.22)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  matchText: { fontSize: 11, fontWeight: "800", color: "#fff", letterSpacing: 1 },
  names: { fontSize: 16, fontWeight: "700", color: "#fff", marginTop: 10 },
  movieBox: { alignItems: "center", marginTop: 24 },
  moviePoster: { width: 118, height: 172, borderRadius: 12 },
  movieTitle: { fontSize: 14, fontWeight: "700", color: "#fff", marginTop: 10, textAlign: "center", maxWidth: 200 },
  movieMeta: { fontSize: 11, color: "rgba(255,255,255,0.9)", fontWeight: "600" },
  countText: { fontSize: 11.5, color: "rgba(255,255,255,0.85)", fontWeight: "600", marginTop: 16 },
  footer: { fontFamily: "Baloo2_700Bold", fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: "auto" },
});
