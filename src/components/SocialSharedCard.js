import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Heart, ListVideo, Users, Quote } from "lucide-react-native";
import { avatarOr } from "../utils/avatar";

export default function SocialSharedCard({ payload, navigation, currentUserId }) {
  if (!payload) return null;

  if (payload.kind === "blend") {
    const me = payload.me || {};
    const friend = payload.friend || {};
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
        <LinearGradient colors={["#171129", "#48206D", "#C32C75"]} style={styles.card}>
          <Text style={styles.eyebrow}>TASTE BLEND</Text>
          <View style={styles.peopleRow}>
            <Avatar uri={me.avatarUrl} id={me.id} />
            <View style={styles.percentWrap}>
              <Text style={styles.percent}>%{Math.round(Number(payload.matchPercent || 0))}</Text>
              <Text style={styles.compatibility}>ZEVK UYUMU</Text>
            </View>
            <Avatar uri={friend.avatarUrl} id={friend.id} />
          </View>
          <Text style={styles.names} numberOfLines={1}>{me.name} × {friend.name}</Text>
          <Text style={styles.subtitle}>
            {Number(payload.commonCount || 0)} ortak içerik{payload.topGenre ? ` · En çok ${payload.topGenre}` : ""}
          </Text>
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
    const percent = Math.round(Number(payload.percent ?? (payload.total ? (payload.score / payload.total) * 100 : 0)));
    const open = () => {
      if (!friend?.id || Number(friend.id) === Number(currentUserId)) return;
      navigation.navigate("OtherProfile", { userId: friend.id });
    };
    return (
      <TouchableOpacity onPress={open} activeOpacity={0.9}>
        <LinearGradient colors={["#4C1D95", "#EC4899", "#F59E0B"]} style={styles.card}>
          <Text style={styles.eyebrow}>ARKADAŞINI TANIYOR MUSUN?</Text>
          <Avatar uri={friend.avatarUrl} id={friend.id} large />
          <Text style={styles.profileName}>{friend.name}</Text>
          <View style={styles.percentWrap}>
            <Text style={styles.percent}>%{percent}</Text>
            <Text style={styles.compatibility}>TANIMA SKORU</Text>
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
        <LinearGradient colors={["#F97316", "#DB2777", "#7C3AED"]} style={styles.card}>
          <Text style={styles.eyebrow}>SAHNEYİ HATIRLA, KARAKTERİ BUL</Text>
          <Quote size={22} color="rgba(255,255,255,0.85)" style={{ marginTop: 12 }} />
          <View style={[styles.percentWrap, { marginTop: 12 }]}>
            <Text style={styles.percent}>{Number(payload.score || 0)}/{Number(payload.total || 0)}</Text>
            <Text style={styles.compatibility}>{payload.isDaily ? "GÜNÜN CHALLENGE'I" : "DOĞRU CEVAP"}</Text>
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

  return (
    <TouchableOpacity onPress={openProfile} activeOpacity={0.9}>
      <LinearGradient colors={payload.isPremium ? ["#2A1C05", "#6A450B", "#B7791F"] : ["#141424", "#28204A", "#5B21B6"]} style={styles.card}>
        <Text style={styles.eyebrow}>{payload.isPremium ? "PELLIX PREMIUM" : "PELLIX PROFİLİ"}</Text>
        <Avatar uri={payload.avatarUrl} id={payload.userId} large />
        <Text style={styles.profileName}>{payload.name}</Text>
        {!!payload.username && <Text style={styles.username}>@{payload.username}</Text>}
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
  const sizeStyle = large ? styles.avatarLarge : styles.avatar;
  return <Image source={{ uri: uri || avatarOr(null, id) }} style={sizeStyle} />;
}

function Stat({ icon: Icon, value, label }) {
  return (
    <View style={styles.stat}>
      <Icon size={13} color="rgba(255,255,255,0.78)" />
      <Text style={styles.statValue}>{Number(value || 0)}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 12, borderRadius: 18, padding: 18, alignItems: "center", overflow: "hidden" },
  eyebrow: { color: "rgba(255,255,255,0.62)", fontSize: 9, fontWeight: "900", letterSpacing: 1.4 },
  peopleRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 14 },
  avatar: { width: 62, height: 62, borderRadius: 999, borderWidth: 2, borderColor: "rgba(255,255,255,0.8)" },
  avatarLarge: { width: 76, height: 76, borderRadius: 999, borderWidth: 2.5, borderColor: "#fff", marginTop: 14 },
  percentWrap: { alignItems: "center" },
  percent: { color: "#fff", fontSize: 29, fontWeight: "900" },
  compatibility: { color: "rgba(255,255,255,0.6)", fontSize: 7.5, fontWeight: "900", letterSpacing: 0.7 },
  names: { color: "#fff", fontSize: 16, fontWeight: "900", marginTop: 12 },
  subtitle: { color: "rgba(255,255,255,0.72)", fontSize: 10.5, marginTop: 4 },
  posterRow: { flexDirection: "row", gap: 6, marginTop: 14 },
  poster: { width: 49, height: 72, borderRadius: 7, backgroundColor: "rgba(255,255,255,0.1)" },
  profileName: { color: "#fff", fontSize: 19, fontWeight: "900", marginTop: 10 },
  username: { color: "rgba(255,255,255,0.65)", fontSize: 11, marginTop: 2 },
  statsRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 20, marginTop: 15 },
  stat: { alignItems: "center", minWidth: 52 },
  statValue: { color: "#fff", fontSize: 15, fontWeight: "900", marginTop: 3 },
  statLabel: { color: "rgba(255,255,255,0.58)", fontSize: 8.5, marginTop: 1 },
  favorites: { color: "rgba(255,255,255,0.78)", fontSize: 10.5, fontWeight: "700", textAlign: "center", marginTop: 14 },
});
