import React, { useEffect, useRef } from "react";
import { View, Text, Image, Animated, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { Star, Flame } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";

// Ana Sayfa'nın en üstünde, kişiselleştirilmiş öneri akışından TAMAMEN bağımsız bir şerit —
// sadece "şu an popüler" 10 içeriği yatay gösteriyor. Tür filtresi dışında hiçbir kişisel
// sinyalden (beğeni, zevk vektörü vb.) etkilenmiyor — kasıtlı olarak öyle tasarlandı.
export default function PopularNowRow({ items, onPress, onTouchStart, onTouchEnd }) {
  const { c } = useAppTheme();
  const styles = makeStyles(c);

  // HM5 — bu veri gerçekten CANLI (Trakt'ın o an izlenen içeriklerine dayanıyor) ama bu hiç
  // iletilmiyordu, sabit bir alev ikonundan farksız duruyordu. Küçük, nabız atan bir "CANLI"
  // rozeti bunu görünür kılıyor.
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  if (!items || items.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <Flame size={14} color={c.accent} />
        <Text style={styles.title}>Şu An Popüler</Text>
        <View style={styles.liveBadge}>
          <Animated.View style={[styles.liveDot, { opacity: pulse }]} />
          <Text style={styles.liveText}>CANLI</Text>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onScrollEndDrag={onTouchEnd}
        onMomentumScrollEnd={onTouchEnd}
      >
        {items.slice(0, 10).map((m) => (
          <TouchableOpacity key={m.id} style={styles.item} onPress={() => onPress(m)} activeOpacity={0.9}>
            <View style={styles.posterWrap}>
              {m.poster ? (
                <Image source={{ uri: m.poster }} style={StyleSheet.absoluteFillObject} />
              ) : (
                <View style={[StyleSheet.absoluteFillObject, styles.posterFallback]} />
              )}
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
    liveBadge: {
      flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: `${c.danger}1a`,
      paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 999, marginLeft: 2,
    },
    liveDot: { width: 5, height: 5, borderRadius: 999, backgroundColor: c.danger },
    liveText: { fontSize: 8.5, fontWeight: "800", color: c.danger, letterSpacing: 0.4 },
    row: { gap: 10, paddingRight: 8 },
    item: { width: 96 },
    posterWrap: {
      width: 96, aspectRatio: 2 / 3, borderRadius: 12, overflow: "hidden", backgroundColor: c.surface2,
    },
    posterFallback: { backgroundColor: c.surface2 },
    ratingBadge: {
      position: "absolute", bottom: 6, right: 6,
      flexDirection: "row", alignItems: "center", gap: 3,
      backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 999,
    },
    ratingText: { fontSize: 9, fontWeight: "800", color: "#fff" },
    itemTitle: { fontSize: 11, fontWeight: "700", color: c.text, marginTop: 6 },
  });
}
