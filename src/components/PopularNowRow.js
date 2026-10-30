import React, { useEffect, useRef } from "react";
import { View, Text, Image, Animated, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import { FONTS } from "../theme/fonts";

// Şerit bir film makarası parçası gibi çiziliyor: koyu bant, üstte ve altta delikler, her afiş
// bir kare. Delikler her karenin kendi içinde çiziliyor ki şeritle birlikte kaysınlar.
const STRIP = { band: "#0c0b0a", hole: "#2f2a24" };
const HOLES = [0, 1, 2, 3, 4, 5];

// Ana Sayfa'nın en üstünde, kişiselleştirilmiş öneri akışından TAMAMEN bağımsız bir şerit —
// "Tümü" görünümünde en fazla 20 içeriği yatay gösterir; Film/Dizi filtrelerinde HomeScreen
// zaten 10'ar içerik gönderir. Tür filtresi dışında hiçbir kişisel sinyalden
// (beğeni, zevk vektörü vb.) etkilenmiyor — kasıtlı olarak öyle tasarlandı.
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
        <Text style={styles.title}>Şu an popüler</Text>
        <View style={styles.liveBadge}>
          <Animated.View style={[styles.liveDot, { opacity: pulse }]} />
          <Text style={styles.liveText}>CANLI</Text>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.strip}
        contentContainerStyle={styles.row}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onScrollEndDrag={onTouchEnd}
        onMomentumScrollEnd={onTouchEnd}
      >
        {items.slice(0, 20).map((m) => (
          <TouchableOpacity key={m.id} style={styles.item} onPress={() => onPress(m)} activeOpacity={0.9} accessibilityLabel={m.title}>
            <View style={[styles.holes, styles.holesTop]}>{HOLES.map((h) => <View key={h} style={styles.hole} />)}</View>
            <View style={styles.posterWrap}>
              {m.poster ? (
                <Image source={{ uri: m.poster }} style={StyleSheet.absoluteFillObject} />
              ) : (
                <View style={[StyleSheet.absoluteFillObject, styles.posterFallback]} />
              )}
            </View>
            <View style={styles.caption}>
              {m.imdb ? <Text style={styles.rating}>{m.imdb}</Text> : null}
              <Text style={styles.itemTitle} numberOfLines={1}>{m.title}</Text>
            </View>
            <View style={[styles.holes, styles.holesBottom]}>{HOLES.map((h) => <View key={h} style={styles.hole} />)}</View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    wrap: { marginBottom: 4 },
    titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
    title: { fontSize: 26, fontFamily: FONTS.marquee, color: c.text },
    liveBadge: { flexDirection: "row", alignItems: "center", gap: 6 },
    liveDot: { width: 7, height: 7, borderRadius: 999, backgroundColor: c.danger },
    liveText: { fontSize: 11, fontFamily: FONTS.monoMedium, color: c.danger, letterSpacing: 1 },
    strip: { marginHorizontal: -16, backgroundColor: STRIP.band },
    row: { paddingHorizontal: 12 },
    item: { width: 108, paddingHorizontal: 6, paddingVertical: 16 },
    holes: { position: "absolute", left: 0, right: 0, flexDirection: "row", justifyContent: "space-around" },
    holesTop: { top: 5 },
    holesBottom: { bottom: 5 },
    hole: { width: 8, height: 5, borderRadius: 1.5, backgroundColor: STRIP.hole },
    posterWrap: { width: 96, aspectRatio: 2 / 3, borderRadius: 4, overflow: "hidden", backgroundColor: "#1c1a24" },
    posterFallback: { backgroundColor: "#1c1a24" },
    caption: { marginTop: 7, minHeight: 32 },
    rating: { fontSize: 11, fontFamily: FONTS.monoMedium, color: "#d4a94a" },
    itemTitle: { fontSize: 12, fontWeight: "600", color: "#f2ede2", marginTop: 2 },
  });
}
