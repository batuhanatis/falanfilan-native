import { t as translateUI } from "../i18n/core";
import React from "react";
import { View, Text, ImageBackground, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Crown, Flame, Heart, ListVideo, Sparkles, Users } from "lucide-react-native";
import { avatarOr } from "../utils/avatar";
import RetryImage from "./RetryImage";
import { FONTS } from "../theme/fonts";

// Salon: koyu kart, üstten altın ışık, Big Shoulders isim ve sayılar, DM Mono künye.
const GOLD = "#c9a44c";
const CREAM = "#f3ead8";
const DIM = "#8c8579";

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
      <LinearGradient colors={["rgba(201,164,76,0.2)", "rgba(201,164,76,0)"]} style={styles.wash} pointerEvents="none" />

      <View style={styles.topRow}>
        <View>
          <Text style={styles.logo}>PELLIX</Text>
          <Text style={styles.cardType}>{translateUI("TASTE ID")}</Text>
        </View>
        <View style={styles.badgeRow}>
          {Number(streak) > 0 && (
            <View style={styles.streakBadge}>
              <Flame size={10} color={GOLD} />
              <Text style={styles.streakText}>{streak}{translateUI(" HAFTA")}</Text>
            </View>
          )}
          {isPremium && (
            <View style={styles.premiumBadge}>
              <Crown size={10} color="#1a150c" fill="#1a150c" />
              <Text style={styles.premiumBadgeText}>{translateUI("PREMIUM")}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.identityRow}>
        <RetryImage source={{ uri: avatarOr(avatarUrl, userId) }} style={styles.avatar} />
        <View style={styles.identityCopy}>
          <Text style={styles.name} numberOfLines={1}>{name || translateUI("Pellix kullanıcısı")}</Text>
          {!!username && <Text style={styles.username}>{translateUI("@")}{username}</Text>}
          <Text style={styles.signalText}>
            {signalCount > 0 ? translateUI("{0} beğeni sinyalinden oluşuyor", {0: signalCount}) : translateUI("İzleyici profilin oluşuyor")}
          </Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Sparkles size={12} color={GOLD} />
          <Text style={styles.sectionTitle}>{translateUI("İZLEME DNA'SI")}</Text>
        </View>
        <Text style={styles.sectionHint}>{translateUI("Pellix seni böyle tanıyor")}</Text>
      </View>

      {genres.length > 0 ? (
        <View style={styles.genreList}>
          {genres.map((genre, index) => {
            const percent = clampPercent(genre?.percent);
            return (
              <View key={`${genre?.name || "genre"}-${index}`} style={styles.genreRow}>
                <Text style={styles.genreName} numberOfLines={1}>{genre?.name || translateUI("Karışık")}</Text>
                <View style={styles.genreTrack}>
                  <View style={[styles.genreFill, { width: `${Math.max(8, percent)}%` }]} />
                </View>
                <Text style={styles.genrePercent}>{translateUI("%")}{percent}</Text>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyTaste}>
          <Text style={styles.emptyTasteText}>{translateUI("Birkaç seçim daha yaptıkça izleyici imzan burada belirginleşecek.")}</Text>
        </View>
      )}

      <View style={styles.formatBlock}>
        <View style={styles.formatLabels}>
          <Text style={styles.formatLabel}>{translateUI("FİLM %")}{filmPercent}</Text>
          <Text style={styles.formatLabel}>{translateUI("DİZİ %")}{showPercent}</Text>
        </View>
        <View style={styles.formatTrack}>
          <View style={[styles.formatFilm, { width: `${filmPercent}%` }]} />
        </View>
      </View>

      <View style={styles.statsRow}>
        <Stat icon={Heart} value={likeCount} label={translateUI("BEĞENİ")} />
        <Stat icon={Users} value={friendCount} label={translateUI("ARKADAŞ")} />
        <Stat icon={ListVideo} value={listCount} label={translateUI("LİSTE")} />
      </View>

      {hasFavorites && (
        <View style={styles.favoriteSection}>
          <Text style={styles.favoriteEyebrow}>{translateUI("İMZA SEÇİMLERİ")}</Text>
          <View style={styles.favoriteRow}>
            {favoriteMovie && <FavoriteItem item={favoriteMovie} label={translateUI("FAVORİ FİLM")} />}
            {favoriteShow && <FavoriteItem item={favoriteShow} label={translateUI("FAVORİ DİZİ")} />}
          </View>
        </View>
      )}

      <View style={styles.footerRow}>
        <Text style={styles.footer}>{username ? `open.pellix.app/u/${username}` : "pellix.app"}</Text>
        <Text style={styles.footerAccent}>{translateUI("Kendini keşfet")}</Text>
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
    <View style={[styles.card, styles.cardPlain]}>
      {content}
    </View>
  );
}

function Stat({ icon: Icon, value, label }) {
  return (
    <View style={styles.statBox}>
      <Icon size={13} color={GOLD} />
      <Text style={styles.statNum}>{Number(value || 0)}</Text>
      <Text style={styles.statLabel}>{translateUI(label)}</Text>
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
        <Text style={styles.favoriteLabel}>{translateUI(label)}</Text>
        <Text style={styles.favoriteTitle} numberOfLines={2}>{item?.title || translateUI("—")}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 320,
    minHeight: 555,
    borderRadius: 24,
    padding: 23,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(201,164,76,0.3)",
  },
  cardPlain: { backgroundColor: "#14121a" },
  cardImage: { borderRadius: 24 },
  wash: { position: "absolute", left: 0, right: 0, top: 0, height: 240 },
  topRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  logo: { fontFamily: FONTS.marquee, fontSize: 18, color: GOLD, lineHeight: 20, letterSpacing: 3 },
  cardType: { color: DIM, fontFamily: FONTS.monoMedium, fontSize: 8, letterSpacing: 1.6, marginTop: 2 },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  streakBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1, borderColor: "rgba(201,164,76,0.45)" },
  streakText: { color: GOLD, fontFamily: FONTS.monoMedium, fontSize: 7.5, letterSpacing: 0.5 },
  premiumBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: GOLD, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  premiumBadgeText: { fontFamily: FONTS.monoMedium, fontSize: 7.5, color: "#1a150c", letterSpacing: 0.5 },
  identityRow: { flexDirection: "row", alignItems: "center", gap: 13, marginTop: 22 },
  avatar: { width: 67, height: 67, borderRadius: 999, borderWidth: 2, borderColor: GOLD },
  identityCopy: { flex: 1, minWidth: 0 },
  name: { fontFamily: FONTS.marquee, fontSize: 28, lineHeight: 30, color: CREAM },
  username: { color: GOLD, fontFamily: FONTS.monoMedium, fontSize: 10.5, marginTop: 1 },
  signalText: { color: DIM, fontSize: 9.5, marginTop: 5 },
  sectionHeader: { marginTop: 23 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionTitle: { color: GOLD, fontFamily: FONTS.monoMedium, fontSize: 9, letterSpacing: 1.2 },
  sectionHint: { color: DIM, fontSize: 9.5, marginTop: 3 },
  genreList: { gap: 9, marginTop: 12 },
  genreRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  genreName: { width: 68, color: CREAM, fontSize: 10.5, fontWeight: "800" },
  genreTrack: { flex: 1, height: 5, borderRadius: 999, overflow: "hidden", backgroundColor: "rgba(243,234,216,0.08)" },
  genreFill: { height: 5, borderRadius: 999, backgroundColor: GOLD },
  genrePercent: { width: 29, textAlign: "right", color: DIM, fontFamily: FONTS.monoMedium, fontSize: 9 },
  emptyTaste: { marginTop: 12, borderRadius: 13, padding: 11, backgroundColor: "rgba(243,234,216,0.04)" },
  emptyTasteText: { color: DIM, fontSize: 10, lineHeight: 15 },
  formatBlock: { marginTop: 16 },
  formatLabels: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  formatLabel: { color: DIM, fontFamily: FONTS.monoMedium, fontSize: 8.5, letterSpacing: 0.6 },
  formatTrack: { height: 7, borderRadius: 999, backgroundColor: "rgba(243,234,216,0.16)", overflow: "hidden" },
  formatFilm: { height: 7, borderRadius: 999, backgroundColor: GOLD },
  statsRow: { flexDirection: "row", gap: 7, marginTop: 17 },
  statBox: { flex: 1, minHeight: 62, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(243,234,216,0.04)", borderWidth: 1, borderColor: "rgba(243,234,216,0.08)" },
  statNum: { color: CREAM, fontFamily: FONTS.marquee, fontSize: 22, marginTop: 2 },
  statLabel: { color: DIM, fontFamily: FONTS.monoMedium, fontSize: 7.5, letterSpacing: 0.6, marginTop: 1 },
  favoriteSection: { marginTop: 18 },
  favoriteEyebrow: { color: GOLD, fontFamily: FONTS.monoMedium, fontSize: 8, letterSpacing: 1.2, marginBottom: 8 },
  favoriteRow: { flexDirection: "row", gap: 8 },
  favoriteItem: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 13, padding: 7, backgroundColor: "rgba(243,234,216,0.04)", borderWidth: 1, borderColor: "rgba(201,164,76,0.2)" },
  favoritePoster: { width: 37, height: 55, borderRadius: 7 },
  posterFallback: { backgroundColor: "rgba(243,234,216,0.08)" },
  favoriteCopy: { flex: 1, minWidth: 0 },
  favoriteLabel: { color: GOLD, fontFamily: FONTS.monoMedium, fontSize: 7, letterSpacing: 0.6 },
  favoriteTitle: { color: CREAM, fontFamily: FONTS.marquee, fontSize: 13, lineHeight: 14, marginTop: 3 },
  footerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 20 },
  footer: { color: DIM, fontFamily: FONTS.monoMedium, fontSize: 9 },
  footerAccent: { color: GOLD, fontFamily: FONTS.monoMedium, fontSize: 9, letterSpacing: 0.8 },
});
