import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ListVideo } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";

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

function activityIcon(item) {
  if (item.activityType === "favorite_set") return "💘";
  if (item.activityType === "list_created") return "🎬";
  return "❤️";
}

function ActivityRow({ item, navigation, isLast }) {
  const { c } = useAppTheme();
  const styles = makeStyles(c);
  const movie = item.movies?.[0] || null;

  function handlePress() {
    if (movie) navigation.navigate("Detail", { movie });
    else if (item.activityType === "list_created" && item.payload?.list_id) {
      navigation.navigate("WatchlistDetail", { watchlistId: item.payload.list_id, name: item.payload.list_name });
    }
  }

  return (
    <TouchableOpacity
      style={[styles.row, !isLast && styles.rowDivider]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {movie?.poster ? (
        <Image source={{ uri: movie.poster }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback]}>
          <ListVideo size={14} color={c.dim} />
        </View>
      )}
      <Text style={styles.text} numberOfLines={1}>
        <Text style={styles.name}>{item.user?.name}</Text>
        <Text style={styles.action}> {activityCopy(item)}</Text>
        {!!movie && <Text style={styles.title}> · {movie.title}</Text>}
      </Text>
      <Text style={styles.icon}>{activityIcon(item)}</Text>
      {Number(item.commentCount) > 0 && <Text style={styles.commentDot}>💬 {item.commentCount}</Text>}
      <Text style={styles.time}>{relativeTime(item.created_at)}</Text>
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
    row: { flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 12, paddingVertical: 9 },
    rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    thumb: { width: 28, height: 40, borderRadius: 5, backgroundColor: c.surface2 },
    thumbFallback: { alignItems: "center", justifyContent: "center" },
    text: { flex: 1, fontSize: 12, color: c.text },
    name: { fontWeight: "800", color: c.text },
    action: { color: c.dim },
    title: { color: c.text, fontWeight: "600" },
    icon: { fontSize: 12 },
    commentDot: { fontSize: 10.5, color: c.dim },
    time: { fontSize: 10.5, color: c.dim },
  });
}
