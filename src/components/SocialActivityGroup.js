import React, { useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ListVideo } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { avatarOr } from "../utils/avatar";
import RetryImage from "./RetryImage";

function relativeTime(value) {
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return "az önce";
  if (min < 60) return `${min} dk`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} sa`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day} gün`;
  return new Date(value).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

function activityCopy(item) {
  if (item.activityType === "favorite_set") {
    return item.payload?.liked ? "favorisi yaptı" : "favorisini güncelledi";
  }
  if (item.activityType === "list_created") {
    return `"${item.payload?.list_name || "yeni liste"}" listesini oluşturdu`;
  }
  return "beğendi";
}

function ActivityRow({ item, navigation, isLast }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = makeStyles(c);
  const movie = item.movies?.[0] || null;
  // Sunucudan gelen ilk tepki/sayaç durumu — SocialFeedCard'daki ReactionButton'la aynı desen,
  // sadece burada tek varsayılan tepki (🔥) var, uzun-basılı seçici yok (bkz. tasarım kararı:
  // kompakt satırlar bunu hak etmiyor, tam kartlardaki picker'ı burada tekrarlamıyoruz).
  const [myReaction, setMyReaction] = useState(item.myReaction || null);
  const [reactionCounts, setReactionCounts] = useState(item.reactionCounts || {});
  const total = Object.values(reactionCounts || {}).reduce((s, v) => s + Number(v || 0), 0);

  function handlePress() {
    if (movie) navigation.navigate("Detail", { movie });
    else if (item.activityType === "list_created" && item.payload?.list_id) {
      navigation.navigate("WatchlistDetail", { watchlistId: item.payload.list_id, name: item.payload.list_name });
    }
  }

  function openProfile() {
    if (item.user?.id) navigation.navigate("OtherProfile", { userId: item.user.id });
  }

  async function toggleReaction() {
    if (!item.activityId) return;
    try {
      const data = await api.socialReact(auth.token, "activity", item.activityId, "fire");
      setMyReaction(data.myReaction || null);
      setReactionCounts(data.reactionCounts || {});
    } catch {}
  }

  return (
    <TouchableOpacity
      style={[styles.row, !isLast && styles.rowDivider]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <TouchableOpacity onPress={openProfile} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
        <RetryImage source={{ uri: avatarOr(item.user?.avatar_url) }} style={styles.avatar} />
      </TouchableOpacity>

      <Text style={styles.text} numberOfLines={2}>
        <Text style={styles.name}>{item.user?.name}</Text>
        <Text style={styles.action}> {activityCopy(item)}</Text>
        {!!movie && <Text style={styles.title}> · {movie.title}</Text>}
      </Text>

      {movie?.poster ? (
        <Image source={{ uri: movie.poster }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback]}>
          <ListVideo size={14} color={c.dim} />
        </View>
      )}

      <View style={styles.metaCol}>
        <TouchableOpacity style={styles.reactBtn} onPress={toggleReaction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.icon}>{myReaction ? "🔥" : "🤍"}</Text>
          {total > 0 && <Text style={[styles.reactCount, !!myReaction && { color: c.accent }]}>{total}</Text>}
        </TouchableOpacity>
        <Text style={styles.time}>{relativeTime(item.created_at)}</Text>
      </View>
    </TouchableOpacity>
  );
}

// Not/anket/oyun sonucu gibi GERÇEK içerik taşımayan, otomatik üretilen aktiviteleri (beğendi/
// favorisi yaptı/liste oluşturdu) tek bir grup kartı içinde kompakt satırlar halinde gösteriyor —
// bunlar SocialFeedCard'ın büyük "hero poster" kartını hak etmiyor, hiçbirinde kullanıcının
// yazdığı bir not yok. Gerçek içerikli paylaşımlar (post: düşünce/öneri/anket/kart) hâlâ
// SocialFeedCard ile büyük kart olarak gösteriliyor. Ardışık aktiviteleri tek gruba toplama
// mantığı ActivityScreen'deki groupActivities()'te.
export default function SocialActivityGroup({ items, navigation }) {
  const { c } = useAppTheme();
  const styles = makeStyles(c);
  return (
    <View style={styles.group}>
      {items.map((item, i) => (
        <ActivityRow key={item.feedKey || item.id} item={item} navigation={navigation} isLast={i === items.length - 1} />
      ))}
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    group: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 14,
      marginBottom: 12,
      overflow: "hidden",
    },
    row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 13, paddingVertical: 12 },
    rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    avatar: { width: 40, height: 40, borderRadius: 999, backgroundColor: c.surface2 },
    text: { flex: 1, fontSize: 12, color: c.text, lineHeight: 16 },
    name: { fontWeight: "800", color: c.text },
    action: { color: c.dim },
    title: { color: c.text, fontWeight: "600" },
    thumb: { width: 40, height: 58, borderRadius: 7, backgroundColor: c.surface2 },
    thumbFallback: { alignItems: "center", justifyContent: "center" },
    // ÖNEMLİ DÜZELTME: Tepki ikonu ile süre metnini dar bir sütunda alt alta ORTALAMAYA
    // çalışmak tuhaf duruyordu — emoji karakterinin görsel ağırlık merkezi ile "3 gün" gibi
    // değişken genişlikteki metnin ortası hiçbir zaman tam örtüşmüyordu. Artık ikisi ayrı ayrı
    // sağa yaslı, sütun posterle aynı yükseklikte (thumb: 58) — tepki üstte, süre altta, kendi
    // aralarında hizalanmaya çalışmıyorlar.
    metaCol: { alignItems: "flex-end", justifyContent: "space-between", height: 58 },
    reactBtn: { flexDirection: "row", alignItems: "center", gap: 3 },
    icon: { fontSize: 14 },
    reactCount: { fontSize: 10.5, color: c.dim, fontWeight: "700" },
    time: { fontSize: 10.5, color: c.dim },
  });
}
