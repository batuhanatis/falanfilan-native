import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Image, RefreshControl, ActivityIndicator } from "react-native";
import { Radio } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { FONTS, upperTR } from "../theme/fonts";
import LiveDot from "./salon/LiveDot";

// Sohbetler ekranındaki "Canlı" sekmesi: şu an açık canlı sohbet odaları (içerideki kişi
// sayısıyla, kalabalıktan sakine) ve altında yakında açılacaklar. Veriyi ChatListScreen çekiyor.

function startLabel(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const time = d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  const dayDiff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
  if (dayDiff <= 0) return `BUGÜN ${time}`;
  if (dayDiff === 1) return `YARIN ${time}`;
  return `${upperTR(d.toLocaleDateString("tr-TR", { day: "numeric", month: "long" }))} ${time}`;
}

export default function LiveRoomsList({ data, loading, refreshing, onRefresh, onOpen }) {
  const { c } = useAppTheme();
  const styles = makeStyles(c);
  const live = data?.live || [];
  const upcoming = data?.upcoming || [];

  if (loading && !data) {
    return <ActivityIndicator color={c.accent} style={{ marginTop: 40 }} />;
  }

  const rows = [
    ...live.map((room) => ({ key: `l${room.id}`, room, live: true })),
    ...(upcoming.length ? [{ key: "upcoming-label", label: true }] : []),
    ...upcoming.map((room) => ({ key: `u${room.id}`, room, live: false })),
  ];

  return (
    <FlatList
      data={rows}
      keyExtractor={(item) => item.key}
      contentContainerStyle={{ paddingBottom: 24 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} colors={[c.accent]} />}
      ListHeaderComponent={live.length ? <Text style={styles.sectionLabel}>ŞU AN AÇIK</Text> : null}
      ListEmptyComponent={(
        <View style={styles.empty}>
          <Radio size={26} color={c.dim} />
          <Text style={styles.emptyTitle}>Şu an açık oda yok</Text>
          <Text style={styles.emptyText}>Bölümler yayınlanırken burada canlı sohbet odaları açılıyor. Açılınca herkesle aynı anda konuşabilirsin.</Text>
        </View>
      )}
      renderItem={({ item }) => {
        if (item.label) return <Text style={[styles.sectionLabel, { marginTop: live.length ? 22 : 8 }]}>YAKINDA</Text>;
        const { room } = item;
        return (
          <TouchableOpacity
            style={styles.row}
            activeOpacity={0.75}
            onPress={() => onOpen(room)}
            accessibilityRole="button"
            accessibilityLabel={item.live
              ? `${room.title}${room.episodeLabel ? `, ${room.episodeLabel}` : ""}, canlı, içeride ${room.participants} kişi`
              : `${room.title}${room.episodeLabel ? `, ${room.episodeLabel}` : ""}, ${startLabel(room.startsAt)} açılacak`}
          >
            {room.poster
              ? <Image source={{ uri: room.poster }} style={styles.poster} />
              : <View style={[styles.poster, { backgroundColor: c.surface2 }]} />}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.title} numberOfLines={1}>{room.title}</Text>
              {!!room.episodeLabel && <Text style={styles.episode} numberOfLines={1}>{room.episodeLabel}</Text>}
              <View style={styles.metaRow}>
                {item.live && <LiveDot color={c.danger} />}
                <Text style={[styles.meta, item.live && { color: c.danger }]} numberOfLines={1}>
                  {item.live ? "CANLI" : startLabel(room.startsAt)}
                </Text>
              </View>
            </View>
            {item.live && (
              <View style={styles.countBox}>
                <Text style={styles.count}>{room.participants}</Text>
                <Text style={styles.countLabel}>KİŞİ</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      }}
    />
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    sectionLabel: { fontSize: 10.5, fontFamily: FONTS.monoMedium, color: c.dim, letterSpacing: 1, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
    row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
    poster: { width: 44, height: 66, borderRadius: 5 },
    title: { color: c.text, fontSize: 22, fontFamily: FONTS.marquee },
    episode: { color: c.text, fontSize: 13, marginTop: 1 },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
    meta: { color: c.dim, fontSize: 10.5, fontFamily: FONTS.monoMedium, letterSpacing: 0.8 },
    countBox: { alignItems: "center", minWidth: 52 },
    count: { color: c.text, fontSize: 24, fontFamily: FONTS.monoMedium },
    countLabel: { color: c.dim, fontSize: 9.5, fontFamily: FONTS.monoMedium, letterSpacing: 1 },
    empty: { alignItems: "center", paddingVertical: 48, paddingHorizontal: 32, gap: 8 },
    emptyTitle: { color: c.text, fontSize: 24, fontFamily: FONTS.marquee, marginTop: 4 },
    emptyText: { color: c.dim, fontSize: 13, lineHeight: 19, textAlign: "center" },
  });
}
