import React from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Heart, X, Bookmark, Star, Send, Sparkles } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { platformName, platformLogo } from "../utils/platform";

// Web'deki TicketCard ile birebir aynı: tam ekran poster, üstte IMDB rozeti,
// sağda dikey yüzen aksiyon butonları, altta başlık + platform rozetleri.
export default function MovieCard({ movie, liked, disliked, watchlisted, onLike, onDislike, onWatchlist, onSend, onPress, reason }) {
  const { c } = useAppTheme();
  const styles = makeStyles(c);

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress?.(movie)} activeOpacity={0.92}>
      {movie.poster ? (
        <Image source={{ uri: movie.poster }} style={StyleSheet.absoluteFillObject} />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, styles.posterFallback]} />
      )}

      <LinearGradient
        colors={["rgba(0,0,0,0.85)", "rgba(0,0,0,0.05)", "rgba(0,0,0,0.25)"]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      <View style={styles.ratingBadge}>
        <Star size={10} color={c.accent} fill={c.accent} />
        <Text style={styles.ratingText}>{movie.imdb}</Text>
      </View>

      {!!reason && (
        <View style={styles.reasonBadge}>
          <Sparkles size={9} color={c.accent2} />
          <Text style={styles.reasonText} numberOfLines={1}>{reason}</Text>
        </View>
      )}

      <View style={styles.actionsCol}>
        <ActionBtn icon={X} active={disliked} activeColor={c.danger} onPress={() => onDislike(movie.id)} />
        <ActionBtn icon={Heart} active={liked} activeColor={c.accent2} filled={liked} onPress={() => onLike(movie.id)} />
        <ActionBtn icon={Bookmark} active={watchlisted} activeColor={c.accent} filled={watchlisted} onPress={() => onWatchlist(movie.id)} />
        {!!onSend && <ActionBtn icon={Send} onPress={() => onSend(movie)} />}
      </View>

      <View style={styles.bottomInfo} pointerEvents="none">
        <Text style={styles.title} numberOfLines={1}>{movie.title}</Text>
        <Text style={styles.meta}>{movie.year} · {movie.type}</Text>
        {Array.isArray(movie.platforms) && movie.platforms.length > 0 && (
          <View style={styles.platformsRow}>
            {movie.platforms.slice(0, 4).map((p, i) => {
              const logo = platformLogo(p);
              const name = platformName(p);
              return logo ? (
                <Image key={i} source={{ uri: logo }} style={styles.platformLogo} />
              ) : (
                <View key={i} style={styles.platformFallback}>
                  <Text style={styles.platformFallbackText} numberOfLines={1}>{name}</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function ActionBtn({ icon: Icon, active, activeColor, filled, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[actionStyles.btn, { backgroundColor: active ? activeColor : "rgba(0,0,0,0.5)" }]}
    >
      <Icon size={15} color="#fff" fill={filled ? "#fff" : "none"} />
    </TouchableOpacity>
  );
}

const actionStyles = StyleSheet.create({
  btn: { width: 34, height: 34, borderRadius: 999, alignItems: "center", justifyContent: "center" },
});

function makeStyles(c) {
  return StyleSheet.create({
    card: {
      width: "100%",
      aspectRatio: 2 / 3,
      borderRadius: 20,
      overflow: "hidden",
      backgroundColor: c.surface2,
      marginBottom: 16,
    },
    posterFallback: { backgroundColor: c.surface2 },
    ratingBadge: {
      position: "absolute", top: 10, left: 10,
      flexDirection: "row", alignItems: "center", gap: 4,
      backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
    },
    ratingText: { fontSize: 11, fontWeight: "800", color: "#fff" },
    reasonBadge: {
      position: "absolute", top: 10, right: 10, maxWidth: "56%",
      flexDirection: "row", alignItems: "center", gap: 4,
      backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
    },
    reasonText: { fontSize: 8, fontWeight: "700", color: "#fff" },
    actionsCol: { position: "absolute", right: 8, bottom: 62, gap: 8 },
    bottomInfo: { position: "absolute", left: 0, right: 50, bottom: 0, padding: 10 },
    title: { fontSize: 15, fontWeight: "700", color: "#fff" },
    meta: { fontSize: 10, color: "rgba(255,255,255,0.7)", marginTop: 2 },
    platformsRow: { flexDirection: "row", gap: 5, marginTop: 6, flexWrap: "wrap" },
    platformLogo: { width: 20, height: 20, borderRadius: 6, backgroundColor: "#fff" },
    platformFallback: { backgroundColor: "rgba(255,255,255,0.18)", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 },
    platformFallbackText: { fontSize: 9, color: "#fff" },
  });
}
