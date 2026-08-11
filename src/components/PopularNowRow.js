import React from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { Star, Flame } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";

// Ana Sayfa'nın en üstünde, kişiselleştirilmiş öneri akışından TAMAMEN bağımsız bir şerit —
// sadece "şu an popüler" 10 içeriği, Netflix'in "Top 10"una benzer şekilde sıra numaralarıyla
// yatay gösteriyor. Tür filtresi dışında hiçbir kişisel sinyalden (beğeni, zevk vektörü vb.)
// etkilenmiyor — kasıtlı olarak öyle tasarlandı.
export default function PopularNowRow({ items, onPress }) {
  const { c } = useAppTheme();
  const styles = makeStyles(c);
  if (!items || items.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <Flame size={14} color={c.accent} />
        <Text style={styles.title}>Şu An Popüler</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.slice(0, 10).map((m, i) => (
          <TouchableOpacity key={m.id} style={styles.item} onPress={() => onPress(m)} activeOpacity={0.9}>
            <View style={styles.posterWrap}>
              {m.poster ? (
                <Image source={{ uri: m.poster }} style={StyleSheet.absoluteFillObject} />
              ) : (
                <View style={[StyleSheet.absoluteFillObject, styles.posterFallback]} />
              )}
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>{i + 1}</Text>
              </View>
              <View style={styles.ratingBadge}>
                <Star size={8} color={c.accent} fill={c.accent} />
                <Text style={styles.ratingText}>{m.imdb}</Text>
              </View>
            </View>
            <Text style={styles.itemTitle} numberOfLines={1}>{m.title}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    wrap: { marginBottom: 20 },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
    title: { fontSize: 13, fontWeight: "800", color: c.text },
    row: { gap: 10, paddingRight: 8 },
    item: { width: 96 },
    posterWrap: {
      width: 96, aspectRatio: 2 / 3, borderRadius: 12, overflow: "hidden", backgroundColor: c.surface2,
    },
    posterFallback: { backgroundColor: c.surface2 },
    rankBadge: {
      position: "absolute", top: 6, left: 6, minWidth: 20, height: 20, borderRadius: 999, paddingHorizontal: 5,
      backgroundColor: c.accent, alignItems: "center", justifyContent: "center",
    },
    rankText: { fontSize: 10.5, fontWeight: "900", color: c.bg },
    ratingBadge: {
      position: "absolute", bottom: 6, right: 6,
      flexDirection: "row", alignItems: "center", gap: 3,
      backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 999,
    },
    ratingText: { fontSize: 9, fontWeight: "800", color: "#fff" },
    itemTitle: { fontSize: 11, fontWeight: "700", color: c.text, marginTop: 6 },
  });
}
