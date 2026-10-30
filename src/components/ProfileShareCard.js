import React from "react";
import { View, Text, ImageBackground, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Crown, Flame, Heart, ListVideo, Sparkles, Users } from "lucide-react-native";
import { avatarOr } from "../utils/avatar";
import RetryImage from "./RetryImage";

function clampPercent(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

export default function ProfileShareCard({
  avatarUrl,
  userId,
  name,
  username,
  likeCount = 0,
  friendCount = 0,
  listCount = 0,
  favoriteMovie,
  favoriteShow,
  isPremium,
  backgroundUrl,
  forceDefault,
  tasteDNA,
  streak = 0,
}) {
  const hasFavorites = !!(favoriteMovie || favoriteShow);
  const showPremiumBackground = !!(isPremium && backgroundUrl && !forceDefault);
  const genres = Array.isArray(tasteDNA?.genres) ? tasteDNA.genres.slice(0, 3) : [];
  const filmPercent = clampPercent(tasteDNA?.filmPercent, 50);
  const showPercent = clampPercent(tasteDNA?.showPercent, 100 - filmPercent);
  const signalCount = Math.max(0, Number(tasteDNA?.signalCount || 0));

  const content = (
    <>
      <View style={styles.ambientOne} />
      <View style={styles.ambientTwo} />
      <Sparkles size={23} color="rgba(255,215,106,0.22)" style={styles.sparkleOne} />
      <Sparkles size={15} color="rgba(167,139,250,0.22)" style={styles.sparkleTwo} />

      <View style={styles.topRow}>
        <View>
          <Text style={styles.logo}>pellix</Text>
          <Text style={styles.cardType}>TASTE ID</Text>
        </View>
        <View style={styles.badgeRow}>
          {Number(streak) > 0 && (
            <View style={styles.streakBadge}>
              <Flame size={10} color="#FDBA74" />
              <Text style={styles.streakText}>{streak} HAFTA</Text>
            </View>
          )}
          {isPremium && (
            <View style={styles.premiumBadge}>
              <Crown size={10} color="#17120A" fill="#17120A" />
              <Text style={styles.premiumBadgeText}>PREMIUM</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.identityRow}>
        <RetryImage source={{ uri: avatarOr(avatarUrl, userId) }} style={styles.avatar} />
        <View style={styles.identityCopy}>
          <Text style={styles.name} numberOfLines={1}>{name || "Pellix kullanıcısı"}</Text>
          {!!username && <Text style={styles.username}>@{username}</Text>}
          <Text style={styles.signalText}>
            {signalCount > 0 ? `${signalCount} zevk sinyalinden oluşuyor` : "Zevk profili oluşuyor"}
          </Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Sparkles size={12} color="#A78BFA" />
          <Text style={styles.sectionTitle}>ZEVK DNA</Text>
        </View>
        <Text style={styles.sectionHint}>Pellix seni böyle tanıyor</Text>
      </View>

      {genres.length > 0 ? (
        <View style={styles.genreList}>
          {genres.map((genre, index) => {
            const percent = clampPercent(genre?.percent);
            return (
              <View key={`${genre?.name || "genre"}-${index}`} style={styles.genreRow}>
                <Text style={styles.genreName} numberOfLines={1}>{genre?.name || "Karışık"}</Text>
                <View style={styles.genreTrack}>
                  <LinearGradient
                    colors={["#FFD76A", "#A78BFA"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.genreFill, { width: `${Math.max(8, percent)}%` }]}
                  />
                </View>
                <Text style={styles.genrePercent}>%{percent}</Text>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyTaste}>
          <Text style={styles.emptyTasteText}>Birkaç seçim daha yaptıkça zevk imzan burada belirginleşecek.</Text>
        </View>
      )}

      <View style={styles.formatBlock}>
        <View style={styles.formatLabels}>
          <Text style={styles.formatLabel}>FİLM %{filmPercent}</Text>
          <Text style={styles.formatLabel}>DİZİ %{showPercent}</Text>
        </View>
        <View style={styles.formatTrack}>
          <View style={[styles.formatFilm, { width: `${filmPercent}%` }]} />
        </View>
      </View>

      <View style={styles.statsRow}>
        <Stat icon={Heart} value={likeCount} label="BEĞENİ" />
        <Stat icon={Users} value={friendCount} label="ARKADAŞ" />
        <Stat icon={ListVideo} value={listCount} label="LİSTE" />
      </View>

      {hasFavorites && (
        <View style={styles.favoriteSection}>
          <Text style={styles.favoriteEyebrow}>İMZA SEÇİMLERİ</Text>
          <View style={styles.favoriteRow}>
            {favoriteMovie && <FavoriteItem item={favoriteMovie} label="FAVORİ FİLM" />}
            {favoriteShow && <FavoriteItem item={favoriteShow} label="FAVORİ DİZİ" />}
          </View>
        </View>
      )}

      <View style={styles.footerRow}>
        <Text style={styles.footer}>{username ? `pellix.app/@${username}` : "pellix.app"}</Text>
        <Text style={styles.footerAccent}>Zevkini keşfet</Text>
      </View>
    </>
  );

  if (showPremiumBackground) {
    return (
      <ImageBackground source={{ uri: backgroundUrl }} style={styles.card} imageStyle={styles.cardImage}>
        <LinearGradient
          colors={["rgba(7,7,12,0.88)", "rgba(10,9,18,0.64)", "rgba(8,8,14,0.83)"]}
          locations={[0, 0.48, 1]}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        {content}
      </ImageBackground>
    );
  }

  return (
    <LinearGradient
      colors={["#0A0A0F", "#171326", "#2B1845"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      {content}
    </LinearGradient>
  );
}

function Stat({ icon: Icon, value, label }) {
  return (
    <View style={styles.statBox}>
      <Icon size={13} color="rgba(255,255,255,0.66)" />
      <Text style={styles.statNum}>{Number(value || 0)}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function FavoriteItem({ item, label }) {
  return (
    <View style={styles.favoriteItem}>
      {item?.poster ? (
        <RetryImage source={{ uri: item.poster }} style={styles.favoritePoster} />
      ) : (
        <View style={[styles.favoritePoster, styles.posterFallback]} />
      )}
      <View style={styles.favoriteCopy}>
        <Text style={styles.favoriteLabel}>{label}</Text>
        <Text style={styles.favoriteTitle} numberOfLines={2}>{item?.title || "—"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 320,
    minHeight: 555,
    borderRadius: 30,
    padding: 23,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  cardImage: { borderRadius: 30 },
  ambientOne: {
    position: "absolute", width: 230, height: 230, borderRadius: 999,
    backgroundColor: "rgba(124,58,237,0.15)", top: -150, right: -85,
  },
  ambientTwo: {
    position: "absolute", width: 180, height: 180, borderRadius: 999,
    backgroundColor: "rgba(240,180,41,0.08)", bottom: -125, left: -70,
  },
  sparkleOne: { position: "absolute", right: 30, top: 92 },
  sparkleTwo: { position: "absolute", left: 18, bottom: 150 },
  topRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  logo: { fontFamily: "Baloo2_800ExtraBold", fontSize: 20, color: "#fff", lineHeight: 22 },
  cardType: { color: "rgba(255,255,255,0.42)", fontSize: 8, fontWeight: "900", letterSpacing: 1.6, marginTop: 1 },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  streakBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: "rgba(249,115,22,0.13)", borderWidth: 1, borderColor: "rgba(249,115,22,0.24)" },
  streakText: { color: "#FDBA74", fontSize: 7.5, fontWeight: "900", letterSpacing: 0.5 },
  premiumBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FFD76A", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  premiumBadgeText: { fontSize: 7.5, fontWeight: "900", color: "#17120A", letterSpacing: 0.5 },
  identityRow: { flexDirection: "row", alignItems: "center", gap: 13, marginTop: 22 },
  avatar: { width: 67, height: 67, borderRadius: 999, borderWidth: 2.5, borderColor: "rgba(255,215,106,0.72)" },
  identityCopy: { flex: 1, minWidth: 0 },
  name: { fontFamily: "Baloo2_800ExtraBold", fontSize: 20, lineHeight: 23, color: "#fff" },
  username: { color: "rgba(255,255,255,0.64)", fontSize: 11.5, fontWeight: "700", marginTop: 1 },
  signalText: { color: "rgba(255,255,255,0.46)", fontSize: 9.5, marginTop: 5 },
  sectionHeader: { marginTop: 23 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionTitle: { color: "#E9DDFF", fontSize: 9, fontWeight: "900", letterSpacing: 1.1 },
  sectionHint: { color: "rgba(255,255,255,0.48)", fontSize: 9.5, marginTop: 3 },
  genreList: { gap: 9, marginTop: 12 },
  genreRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  genreName: { width: 68, color: "rgba(255,255,255,0.88)", fontSize: 10.5, fontWeight: "800" },
  genreTrack: { flex: 1, height: 5, borderRadius: 999, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.09)" },
  genreFill: { height: 5, borderRadius: 999 },
  genrePercent: { width: 29, textAlign: "right", color: "rgba(255,255,255,0.55)", fontSize: 9, fontWeight: "800" },
  emptyTaste: { marginTop: 12, borderRadius: 13, padding: 11, backgroundColor: "rgba(255,255,255,0.05)" },
  emptyTasteText: { color: "rgba(255,255,255,0.55)", fontSize: 10, lineHeight: 15 },
  formatBlock: { marginTop: 16 },
  formatLabels: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  formatLabel: { color: "rgba(255,255,255,0.55)", fontSize: 8.5, fontWeight: "900", letterSpacing: 0.6 },
  formatTrack: { height: 7, borderRadius: 999, backgroundColor: "rgba(96,165,250,0.45)", overflow: "hidden" },
  formatFilm: { height: 7, borderRadius: 999, backgroundColor: "#FFD76A" },
  statsRow: { flexDirection: "row", gap: 7, marginTop: 17 },
  statBox: { flex: 1, minHeight: 62, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.055)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  statNum: { color: "#fff", fontSize: 15, fontWeight: "900", marginTop: 2 },
  statLabel: { color: "rgba(255,255,255,0.44)", fontSize: 7.5, fontWeight: "900", letterSpacing: 0.6, marginTop: 1 },
  favoriteSection: { marginTop: 18 },
  favoriteEyebrow: { color: "rgba(255,255,255,0.42)", fontSize: 8, fontWeight: "900", letterSpacing: 1, marginBottom: 8 },
  favoriteRow: { flexDirection: "row", gap: 8 },
  favoriteItem: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 13, padding: 7, backgroundColor: "rgba(255,255,255,0.055)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  favoritePoster: { width: 37, height: 55, borderRadius: 7 },
  posterFallback: { backgroundColor: "rgba(255,255,255,0.09)" },
  favoriteCopy: { flex: 1, minWidth: 0 },
  favoriteLabel: { color: "#FFD76A", fontSize: 6.8, fontWeight: "900", letterSpacing: 0.55 },
  favoriteTitle: { color: "#fff", fontSize: 9.5, lineHeight: 13, fontWeight: "800", marginTop: 3 },
  footerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 20 },
  footer: { color: "rgba(255,255,255,0.46)", fontSize: 9.5, fontWeight: "700" },
  footerAccent: { color: "#FFD76A", fontSize: 9.5, fontWeight: "800" },
});
