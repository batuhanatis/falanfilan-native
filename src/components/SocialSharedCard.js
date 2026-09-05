import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Crown, Eye, Flame, Heart, ListVideo, Quote, Sparkles, Users } from "lucide-react-native";
import { avatarOr } from "../utils/avatar";
import { verdictFor } from "../utils/blendVerdict";
import RatingShareCard from "./RatingShareCard";

function firstName(value) {
  return String(value || "").trim().split(/\s+/)[0] || "Pellix";
}

function bounded(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
}

export default function SocialSharedCard({ payload, navigation, currentUserId }) {
  if (!payload) return null;

  if (payload.kind === "diary_rating") {
    const movie = payload.movie || null;
    const open = () => {
      if (movie?.id) navigation.navigate("Detail", { movie });
    };
    return (
      <RatingShareCard
        movie={movie}
        rating={payload.rating}
        note={payload.note}
        onPress={movie?.id ? open : undefined}
      />
    );
  }

  if (payload.kind === "poster_puzzle") {
    const open = () => navigation.navigate("DailyPosterPuzzle");
    return (
      <TouchableOpacity onPress={open} activeOpacity={0.9}>
        <LinearGradient colors={["#0B0B12", "#17122A", "#2B1760"]} style={styles.card}>
          <View style={styles.purpleGlow} />
          <View style={styles.cardTopRow}>
            <View>
              <Text style={styles.brand}>pellix</Text>
              <Text style={styles.cardType}>POSTER PUZZLE</Text>
            </View>
            <View style={styles.dailyBadge}><Text style={styles.dailyBadgeText}>GÜNÜN OYUNU</Text></View>
          </View>
          <View style={styles.puzzleIcon}><Eye size={22} color="#C4B5FD" /></View>
          <Text style={styles.puzzleTitle}>{payload.correct ? "Posteri çözdü" : "Poster bugün kazandı"}</Text>
          <Text style={styles.puzzleSquares}>{payload.squares || (payload.correct ? "🟩⬛⬛" : "🟥🟥🟥")}</Text>
          <Text style={styles.puzzleMeta}>
            {payload.correct ? `${Math.max(1, Number(payload.attempts || 1))}. denemede bildi` : "Bugün doğru cevabı bulamadı"}
          </Text>
          <View style={styles.playCta}><Text style={styles.playCtaText}>Cevabı görmeden sen de oyna →</Text></View>
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  if (payload.kind === "blend") {
    const me = payload.me || {};
    const friend = payload.friend || {};
    const percent = bounded(payload.matchPercent);
    const open = () => {
      const target = Number(friend.id) === Number(currentUserId) ? me : friend;
      if (!target?.id || Number(target.id) === Number(currentUserId)) return;
      navigation.navigate("Blend", {
        friendId: target.id,
        friendName: target.name,
        friendAvatar: target.avatarUrl,
      });
    };

    return (
      <TouchableOpacity onPress={open} activeOpacity={0.9}>
        <LinearGradient colors={["#090A11", "#11152B", "#24143D"]} style={styles.card}>
          <View style={styles.blueGlow} />
          <View style={styles.purpleGlow} />
          <View style={styles.cardTopRow}>
            <View>
              <Text style={styles.brand}>pellix</Text>
              <Text style={styles.cardType}>TASTE BLEND</Text>
            </View>
            <Sparkles size={17} color="#A78BFA" />
          </View>

          <View style={styles.blendPeopleRow}>
            <Avatar uri={me.avatarUrl} id={me.id} />
            <View style={styles.blendScoreWrap}>
              <Text style={styles.blendPercent}>%{percent}</Text>
              <Text style={styles.microLabel}>ZEVK UYUMU</Text>
            </View>
            <Avatar uri={friend.avatarUrl} id={friend.id} />
          </View>
          <Text style={styles.blendNames} numberOfLines={1}>{firstName(me.name)} × {firstName(friend.name)}</Text>
          <Text style={styles.verdictText}>{verdictFor(percent)}</Text>

          <View style={styles.miniSignalRow}>
            <View style={styles.miniSignal}>
              <Text style={styles.miniSignalValue}>{Number(payload.commonCount || 0)}</Text>
              <Text style={styles.miniSignalLabel}>ORTAK FAVORİ</Text>
            </View>
            <View style={styles.miniSignal}>
              <Text style={styles.miniSignalValue} numberOfLines={1}>{payload.topGenre || "Karışık"}</Text>
              <Text style={styles.miniSignalLabel}>ORTAK DAMAR</Text>
            </View>
          </View>

          {!!payload.posters?.length && (
            <View style={styles.posterRow}>
              {payload.posters.slice(0, 4).map((uri, index) => (
                uri ? <Image key={`${uri}-${index}`} source={{ uri }} style={styles.poster} /> : null
              ))}
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  if (payload.kind === "friend_quiz") {
    const friend = payload.friend || {};
    const percent = bounded(payload.percent ?? (payload.total ? (payload.score / payload.total) * 100 : 0));
    const open = () => {
      if (!friend?.id || Number(friend.id) === Number(currentUserId)) return;
      navigation.navigate("OtherProfile", { userId: friend.id });
    };
    return (
      <TouchableOpacity onPress={open} activeOpacity={0.9}>
        <LinearGradient colors={["#3B1B66", "#8B296F", "#C45A29"]} style={styles.card}>
          <Text style={styles.eyebrow}>ARKADAŞINI TANIYOR MUSUN?</Text>
          <Avatar uri={friend.avatarUrl} id={friend.id} large />
          <Text style={styles.profileName}>{friend.name}</Text>
          <View style={styles.centerScore}>
            <Text style={styles.scoreNumber}>%{percent}</Text>
            <Text style={styles.microLabel}>TANIMA SKORU</Text>
          </View>
          <Text style={styles.subtitle}>{Number(payload.score || 0)}/{Number(payload.total || 0)} doğru cevap</Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  if (payload.kind === "who_said_it") {
    const open = () => navigation.navigate("PellixPlay", { initialGame: "who_said_it" });
    return (
      <TouchableOpacity onPress={open} activeOpacity={0.9}>
        <LinearGradient colors={["#3C1811", "#651D43", "#38205D"]} style={styles.card}>
          <Text style={styles.eyebrow}>SAHNEYİ HATIRLA, KARAKTERİ BUL</Text>
          <Quote size={24} color="rgba(255,255,255,0.82)" style={{ marginTop: 14 }} />
          <View style={styles.centerScore}>
            <Text style={styles.scoreNumber}>{Number(payload.score || 0)}/{Number(payload.total || 0)}</Text>
            <Text style={styles.microLabel}>{payload.isDaily ? "GÜNÜN CHALLENGE'I" : "DOĞRU CEVAP"}</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  if (payload.kind === "character_quiz") {
    const character = payload.character || {};
    const open = () => navigation.navigate("PellixPlay", { initialGame: "character_quiz" });
    return (
      <TouchableOpacity onPress={open} activeOpacity={0.9}>
        <LinearGradient colors={[character.color || "#4C1D95", "#711A5D", "#15121D"]} style={styles.card}>
          <Text style={styles.eyebrow}>HANGİ KARAKTERSİN?</Text>
          {character.actorPhoto ? (
            <View style={{ marginTop: 13 }}>
              <Image source={{ uri: character.actorPhoto }} style={styles.avatarLarge} />
              <View style={styles.charEmojiBadge}><Text style={{ fontSize: 13 }}>{character.emoji}</Text></View>
            </View>
          ) : (
            <Text style={{ fontSize: 34, marginTop: 12 }}>{character.emoji}</Text>
          )}
          <Text style={styles.profileName}>{character.name}</Text>
          <Text style={styles.subtitle}>{character.title}</Text>
          <View style={[styles.centerScore, { marginTop: 10 }]}>
            <Text style={styles.scoreNumber}>%{bounded(payload.matchPercent)}</Text>
            <Text style={styles.microLabel}>UYUM</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  const openProfile = () => {
    if (Number(payload.userId) === Number(currentUserId)) {
      navigation.navigate("MainTabs", { screen: "Profile" });
    } else if (payload.userId) {
      navigation.navigate("OtherProfile", { userId: payload.userId });
    }
  };
  const hasTasteDNA = !!payload.tasteDNA;
  const genres = Array.isArray(payload.tasteDNA?.genres) ? payload.tasteDNA.genres.slice(0, 3) : [];
  const filmPercent = bounded(payload.tasteDNA?.filmPercent ?? 50);

  return (
    <TouchableOpacity onPress={openProfile} activeOpacity={0.9}>
      <LinearGradient colors={["#0A0A0F", "#171326", "#2B1845"]} style={styles.card}>
        <View style={styles.purpleGlow} />
        <View style={styles.cardTopRow}>
          <View>
            <Text style={styles.brand}>pellix</Text>
            <Text style={styles.cardType}>TASTE ID</Text>
          </View>
          <View style={styles.profileBadgeRow}>
            {Number(payload.streak || 0) > 0 && (
              <View style={styles.tinyBadge}>
                <Flame size={9} color="#FDBA74" />
                <Text style={styles.tinyBadgeText}>{payload.streak} HAFTA</Text>
              </View>
            )}
            {payload.isPremium && (
              <View style={[styles.tinyBadge, styles.tinyPremium]}>
                <Crown size={9} color="#17120A" fill="#17120A" />
                <Text style={styles.tinyPremiumText}>PREMIUM</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.profileIdentity}>
          <Avatar uri={payload.avatarUrl} id={payload.userId} large />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.profileName, { textAlign: "left", marginTop: 0 }]} numberOfLines={1}>{payload.name}</Text>
            {!!payload.username && <Text style={styles.username}>@{payload.username}</Text>}
            <Text style={styles.profileSignal}>
              {hasTasteDNA ? `${Number(payload.tasteDNA?.signalCount || 0)} zevk sinyali` : "Pellix profil kartı"}
            </Text>
          </View>
        </View>

        {genres.length > 0 && (
          <View style={styles.socialGenreList}>
            {genres.map((genre, index) => (
              <View key={`${genre?.name}-${index}`} style={styles.socialGenreRow}>
                <Text style={styles.socialGenreName} numberOfLines={1}>{genre?.name}</Text>
                <View style={styles.socialGenreTrack}>
                  <LinearGradient colors={["#FFD76A", "#A78BFA"]} style={[styles.socialGenreFill, { width: `${Math.max(8, bounded(genre?.percent))}%` }]} />
                </View>
                <Text style={styles.socialGenrePercent}>%{bounded(genre?.percent)}</Text>
              </View>
            ))}
          </View>
        )}

        {hasTasteDNA && (
          <View style={styles.formatMini}>
            <Text style={styles.formatText}>FİLM %{filmPercent}</Text>
            <View style={styles.formatTrack}><View style={[styles.formatFill, { width: `${filmPercent}%` }]} /></View>
            <Text style={styles.formatText}>DİZİ %{100 - filmPercent}</Text>
          </View>
        )}

        <View style={styles.statsRow}>
          <Stat icon={Heart} value={payload.likeCount} label="Beğeni" />
          <Stat icon={Users} value={payload.friendCount} label="Arkadaş" />
          <Stat icon={ListVideo} value={payload.listCount} label="Liste" />
        </View>

        {(payload.favoriteMovie?.title || payload.favoriteShow?.title) && (
          <Text style={styles.favorites} numberOfLines={2}>
            {[payload.favoriteMovie?.title, payload.favoriteShow?.title].filter(Boolean).join(" · ")}
          </Text>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

function Avatar({ uri, id, large = false }) {
  return <Image source={{ uri: uri || avatarOr(null, id) }} style={large ? styles.avatarLarge : styles.avatar} />;
}

function Stat({ icon: Icon, value, label }) {
  return (
    <View style={styles.stat}>
      <Icon size={12} color="rgba(255,255,255,0.66)" />
      <Text style={styles.statValue}>{Number(value || 0)}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 12, borderRadius: 21, padding: 17, alignItems: "center", overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  blueGlow: { position: "absolute", width: 170, height: 170, borderRadius: 999, backgroundColor: "rgba(14,165,233,0.12)", top: -105, left: -80 },
  purpleGlow: { position: "absolute", width: 180, height: 180, borderRadius: 999, backgroundColor: "rgba(139,92,246,0.15)", right: -85, bottom: -115 },
  cardTopRow: { width: "100%", flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  brand: { color: "#fff", fontSize: 15, lineHeight: 17, fontWeight: "900" },
  cardType: { color: "rgba(255,255,255,0.42)", fontSize: 7.2, fontWeight: "900", letterSpacing: 1.1, marginTop: 1 },
  dailyBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: "rgba(255,215,106,0.10)", borderWidth: 1, borderColor: "rgba(255,215,106,0.18)" },
  dailyBadgeText: { color: "#FFD76A", fontSize: 7, fontWeight: "900", letterSpacing: 0.6 },
  puzzleIcon: { width: 46, height: 46, borderRadius: 16, marginTop: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.06)" },
  puzzleTitle: { color: "#fff", fontSize: 21, fontWeight: "900", marginTop: 9 },
  puzzleSquares: { fontSize: 28, letterSpacing: 4, marginTop: 15 },
  puzzleMeta: { color: "rgba(255,255,255,0.58)", fontSize: 10, fontWeight: "700", marginTop: 7 },
  playCta: { marginTop: 15, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: "rgba(167,139,250,0.11)", borderWidth: 1, borderColor: "rgba(167,139,250,0.18)" },
  playCtaText: { color: "#DDD6FE", fontSize: 9.5, fontWeight: "800" },
  blendPeopleRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 11, marginTop: 17 },
  blendScoreWrap: { alignItems: "center", minWidth: 70 },
  blendPercent: { color: "#fff", fontSize: 29, fontWeight: "900", lineHeight: 32 },
  microLabel: { color: "rgba(255,255,255,0.48)", fontSize: 7, fontWeight: "900", letterSpacing: 0.65, textAlign: "center" },
  blendNames: { color: "#fff", fontSize: 15, fontWeight: "900", marginTop: 10 },
  verdictText: { color: "#FFE8A3", fontSize: 10, fontWeight: "800", marginTop: 4, textAlign: "center" },
  miniSignalRow: { width: "100%", flexDirection: "row", gap: 7, marginTop: 13 },
  miniSignal: { flex: 1, minHeight: 45, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "rgba(255,255,255,0.045)", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", paddingHorizontal: 6 },
  miniSignalValue: { color: "#fff", fontSize: 11.5, fontWeight: "900", maxWidth: "100%" },
  miniSignalLabel: { color: "rgba(255,255,255,0.38)", fontSize: 6.4, fontWeight: "900", letterSpacing: 0.5, marginTop: 2 },
  posterRow: { flexDirection: "row", gap: 6, marginTop: 13 },
  poster: { width: 47, height: 69, borderRadius: 7, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.11)" },
  eyebrow: { color: "rgba(255,255,255,0.62)", fontSize: 8.5, fontWeight: "900", letterSpacing: 1.1 },
  avatar: { width: 57, height: 57, borderRadius: 999, borderWidth: 2, borderColor: "rgba(255,255,255,0.72)" },
  avatarLarge: { width: 68, height: 68, borderRadius: 999, borderWidth: 2.5, borderColor: "rgba(255,255,255,0.80)", marginTop: 11 },
  charEmojiBadge: { position: "absolute", right: -3, bottom: 3, width: 25, height: 25, borderRadius: 13, backgroundColor: "rgba(0,0,0,0.48)", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(255,255,255,0.62)" },
  profileName: { color: "#fff", fontSize: 18, fontWeight: "900", marginTop: 9, textAlign: "center" },
  subtitle: { color: "rgba(255,255,255,0.65)", fontSize: 9.5, marginTop: 3, textAlign: "center" },
  centerScore: { alignItems: "center", marginTop: 11 },
  scoreNumber: { color: "#fff", fontSize: 29, fontWeight: "900" },
  profileBadgeRow: { flexDirection: "row", gap: 4 },
  tinyBadge: { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 4, backgroundColor: "rgba(249,115,22,0.11)" },
  tinyBadgeText: { color: "#FDBA74", fontSize: 6.5, fontWeight: "900" },
  tinyPremium: { backgroundColor: "#FFD76A" },
  tinyPremiumText: { color: "#17120A", fontSize: 6.5, fontWeight: "900" },
  profileIdentity: { width: "100%", flexDirection: "row", alignItems: "center", gap: 11, marginTop: 13 },
  username: { color: "rgba(255,255,255,0.55)", fontSize: 9.5, marginTop: 1 },
  profileSignal: { color: "rgba(255,255,255,0.38)", fontSize: 8, marginTop: 3 },
  socialGenreList: { width: "100%", gap: 6, marginTop: 14 },
  socialGenreRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  socialGenreName: { width: 55, color: "rgba(255,255,255,0.76)", fontSize: 8.5, fontWeight: "800" },
  socialGenreTrack: { flex: 1, height: 4, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" },
  socialGenreFill: { height: 4, borderRadius: 999 },
  socialGenrePercent: { width: 25, color: "rgba(255,255,255,0.45)", fontSize: 7.5, fontWeight: "800", textAlign: "right" },
  formatMini: { width: "100%", flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
  formatText: { color: "rgba(255,255,255,0.42)", fontSize: 6.7, fontWeight: "900" },
  formatTrack: { flex: 1, height: 5, borderRadius: 999, backgroundColor: "rgba(96,165,250,0.40)", overflow: "hidden" },
  formatFill: { height: 5, borderRadius: 999, backgroundColor: "#FFD76A" },
  statsRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 18, marginTop: 14 },
  stat: { alignItems: "center", minWidth: 46 },
  statValue: { color: "#fff", fontSize: 13, fontWeight: "900", marginTop: 2 },
  statLabel: { color: "rgba(255,255,255,0.46)", fontSize: 7.5, marginTop: 1 },
  favorites: { color: "rgba(255,255,255,0.66)", fontSize: 9, fontWeight: "700", textAlign: "center", marginTop: 12 },
});
