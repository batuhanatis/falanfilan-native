import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Sparkles, Heart, Users, ListVideo, Star } from "lucide-react-native";
import { avatarOr } from "../utils/avatar";
import RetryImage from "./RetryImage";

// Sadece görsel — yakalanıp paylaşılacak kart. Mantık ShareCardModal'da (Blend/Party
// kartlarıyla aynı desen). Profilin "eğlenceli özeti": avatar, birkaç istatistik ve
// (varsa) favori film/dizi.
export default function ProfileShareCard({
  avatarUrl, userId, name, username, likeCount = 0, friendCount = 0, listCount = 0,
  favoriteMovie, favoriteShow,
}) {
  const hasFavorites = !!(favoriteMovie || favoriteShow);

  return (
    <LinearGradient colors={["#FFC93C", "#F97316", "#7C3AED"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      <Sparkles size={26} color="rgba(255,255,255,0.25)" style={{ position: "absolute", top: 26, left: 22 }} />
      <Sparkles size={16} color="rgba(255,255,255,0.3)" style={{ position: "absolute", top: 80, right: 26 }} />
      <Star size={70} color="rgba(255,255,255,0.08)" style={{ position: "absolute", bottom: -6, right: -16 }} />

      <Text style={styles.logo}>pell<Text style={{ fontWeight: "900" }}>i</Text>x</Text>

      <RetryImage source={{ uri: avatarOr(avatarUrl, userId) }} style={styles.avatar} />
      <Text style={styles.name}>{name}</Text>
      {!!username && <Text style={styles.username}>@{username}</Text>}

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Heart size={16} color="#fff" fill="#fff" />
          <Text style={styles.statNum}>{likeCount}</Text>
          <Text style={styles.statLabel}>Beğeni</Text>
        </View>
        <View style={styles.statBox}>
          <Users size={16} color="#fff" />
          <Text style={styles.statNum}>{friendCount}</Text>
          <Text style={styles.statLabel}>Arkadaş</Text>
        </View>
        <View style={styles.statBox}>
          <ListVideo size={16} color="#fff" />
          <Text style={styles.statNum}>{listCount}</Text>
          <Text style={styles.statLabel}>Liste</Text>
        </View>
      </View>

      {hasFavorites && (
        <View style={styles.favRow}>
          {favoriteMovie && (
            <View style={styles.favCard}>
              {favoriteMovie.poster
                ? <RetryImage source={{ uri: favoriteMovie.poster }} style={styles.favPoster} />
                : <View style={[styles.favPoster, { backgroundColor: "rgba(255,255,255,0.15)" }]} />}
              <Text style={styles.favLabel}>FAVORİ FİLM</Text>
              <Text style={styles.favTitle} numberOfLines={1}>{favoriteMovie.title}</Text>
            </View>
          )}
          {favoriteShow && (
            <View style={styles.favCard}>
              {favoriteShow.poster
                ? <RetryImage source={{ uri: favoriteShow.poster }} style={styles.favPoster} />
                : <View style={[styles.favPoster, { backgroundColor: "rgba(255,255,255,0.15)" }]} />}
              <Text style={styles.favLabel}>FAVORİ DİZİ</Text>
              <Text style={styles.favTitle} numberOfLines={1}>{favoriteShow.title}</Text>
            </View>
          )}
        </View>
      )}

      <Text style={styles.footer}>pellix.app'te profilim 🎬</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: { width: 320, borderRadius: 28, padding: 26, alignItems: "center", overflow: "hidden" },
  logo: { fontFamily: "Baloo2_800ExtraBold", fontSize: 20, color: "#fff", alignSelf: "flex-start", marginBottom: 18 },
  avatar: { width: 84, height: 84, borderRadius: 999, borderWidth: 3, borderColor: "rgba(255,255,255,0.7)", marginBottom: 12 },
  name: { fontFamily: "Baloo2_800ExtraBold", fontSize: 20, color: "#fff" },
  username: { fontSize: 12.5, color: "rgba(255,255,255,0.85)", fontWeight: "700", marginTop: 2 },
  statsRow: { flexDirection: "row", gap: 12, marginTop: 20, width: "100%" },
  statBox: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.16)", borderRadius: 16, paddingVertical: 12,
    alignItems: "center", gap: 3,
  },
  statNum: { fontFamily: "Baloo2_800ExtraBold", fontSize: 18, color: "#fff", marginTop: 2 },
  statLabel: { fontSize: 10, color: "rgba(255,255,255,0.85)", fontWeight: "700" },
  favRow: { flexDirection: "row", gap: 12, marginTop: 20, width: "100%" },
  favCard: { flex: 1, alignItems: "center" },
  favPoster: { width: "100%", aspectRatio: 2 / 3, borderRadius: 12, marginBottom: 6 },
  favLabel: { fontSize: 9, color: "rgba(255,255,255,0.8)", fontWeight: "800", letterSpacing: 0.5 },
  favTitle: { fontSize: 11.5, color: "#fff", fontWeight: "700", marginTop: 2, textAlign: "center" },
  footer: { fontSize: 11, color: "rgba(255,255,255,0.85)", fontWeight: "700", marginTop: 22 },
});
