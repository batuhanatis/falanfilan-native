import { t as translateUI } from "../i18n/core";
import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { PartyPopper, Star } from "lucide-react-native";
import { avatarOr } from "../utils/avatar";
import RetryImage from "./RetryImage";
import { FONTS } from "../theme/fonts";

// Sadece görsel — yakalanıp paylaşılacak kart. Mantık ShareCardModal'da.
// Salon: koyu kart, üstten altın ışık, Big Shoulders isimler, DM Mono künye.
const GOLD = "#c9a44c";
const CREAM = "#f3ead8";
const DIM = "#8c8579";

export default function MatchShareCard({ myAvatar, myId, myName, friendAvatar, friendId, friendName, matchCount, topMovie }) {
  return (
    <View style={styles.card}>
      <LinearGradient colors={["rgba(201,164,76,0.22)", "rgba(201,164,76,0)"]} style={styles.wash} pointerEvents="none" />

      <Text style={styles.logo}>{translateUI("PELLIX")}</Text>

      <View style={styles.avatarRow}>
        <RetryImage source={{ uri: avatarOr(myAvatar, myId) }} style={[styles.avatar, { marginRight: -18, zIndex: 2 }]} />
        <RetryImage source={{ uri: avatarOr(friendAvatar, friendId) }} style={styles.avatar} />
      </View>
      <View style={styles.matchRow}>
        <PartyPopper size={13} color={GOLD} />
        <Text style={styles.matchText}>{translateUI("EŞLEŞTİK")}</Text>
      </View>
      <Text style={styles.names}>{(myName || "").split(" ")[0]}{translateUI(" × ")}{(friendName || "").split(" ")[0]}</Text>

      {topMovie && (
        <View style={styles.movieBox}>
          {topMovie.poster ? (
            <Image source={{ uri: topMovie.poster }} style={styles.moviePoster} />
          ) : (
            <View style={[styles.moviePoster, { backgroundColor: "rgba(243,234,216,0.06)" }]} />
          )}
          <Text style={styles.movieTitle} numberOfLines={2}>{topMovie.title}</Text>
          {!!topMovie.imdb && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
              <Star size={11} color={GOLD} fill={GOLD} />
              <Text style={styles.movieMeta}>{topMovie.imdb}</Text>
            </View>
          )}
        </View>
      )}

      <Text style={styles.countText}>
        {matchCount > 1 ? translateUI("+{0} ortak eşleşme daha", {0: matchCount - 1}) : translateUI("MatchParty'de eşleştiler")}
      </Text>

      <Text style={styles.footer}>{translateUI("PELLIX.APP")}</Text>
    </View>
  );
}

const CARD_WIDTH = 320;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH, height: CARD_WIDTH * 1.72, borderRadius: 24,
    alignItems: "center", paddingTop: 30, paddingBottom: 24, paddingHorizontal: 24,
    overflow: "hidden", backgroundColor: "#14121a", borderWidth: 1, borderColor: "rgba(201,164,76,0.3)",
  },
  wash: { position: "absolute", left: 0, right: 0, top: 0, height: 240 },
  logo: { fontFamily: FONTS.marquee, fontSize: 15, letterSpacing: 4, color: GOLD, marginBottom: 24 },
  avatarRow: { flexDirection: "row" },
  avatar: { width: 64, height: 64, borderRadius: 999, borderWidth: 2, borderColor: GOLD },
  matchRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14, borderWidth: 1, borderColor: "rgba(201,164,76,0.45)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  matchText: { fontFamily: FONTS.monoMedium, fontSize: 10, color: GOLD, letterSpacing: 1.4 },
  names: { fontFamily: FONTS.marquee, fontSize: 30, lineHeight: 32, color: CREAM, marginTop: 10, textAlign: "center" },
  movieBox: { alignItems: "center", marginTop: 20 },
  moviePoster: { width: 118, height: 172, borderRadius: 10, borderWidth: 1, borderColor: "rgba(201,164,76,0.3)" },
  movieTitle: { fontFamily: FONTS.marquee, fontSize: 19, lineHeight: 21, color: CREAM, marginTop: 10, textAlign: "center", maxWidth: 220 },
  movieMeta: { fontSize: 11, color: DIM, fontWeight: "700" },
  countText: { fontFamily: FONTS.monoMedium, fontSize: 9.5, color: DIM, letterSpacing: 0.6, marginTop: 14, textAlign: "center" },
  footer: { fontFamily: FONTS.monoMedium, fontSize: 9.5, color: GOLD, letterSpacing: 2, marginTop: "auto" },
});
