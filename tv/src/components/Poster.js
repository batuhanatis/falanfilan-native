import React, { memo, useRef } from "react";
import { Pressable, View, Text, Animated, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { C, FONTS } from "../theme";

export const POSTER_W = 112;
export const POSTER_H = 168;
export const POSTER_GAP = 16;

// Satırdaki afiş. Odaklanınca büyüyor ve altın çerçeve alıyor (yalnız transform/opacity, yerel
// sürücüyle). Görsel expo-image ile gösterildiği boyutta çözülüp önbellekte tutuluyor.
function Poster({ movie, rowIndex, index, onFocusItem, onOpenItem, hasTVPreferredFocus, nextFocusUp }) {
  const scale = useRef(new Animated.Value(1)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const animate = (to) => Animated.parallel([
    Animated.spring(scale, { toValue: to ? 1.1 : 1, friction: 7, tension: 160, useNativeDriver: true }),
    Animated.timing(ring, { toValue: to ? 1 : 0, duration: 120, useNativeDriver: true }),
  ]).start();
  return (
    <Pressable
      onPress={() => onOpenItem(movie, rowIndex)}
      onFocus={() => { animate(true); onFocusItem(movie, rowIndex, index); }}
      onBlur={() => animate(false)}
      hasTVPreferredFocus={hasTVPreferredFocus}
      {...(nextFocusUp ? { nextFocusUp } : null)}
      accessibilityRole="button"
      accessibilityLabel={`${movie.title}${movie.year ? `, ${movie.year}` : ""}`}
      style={styles.hit}
    >
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        {movie.poster
          ? <Image source={movie.poster} style={styles.img} contentFit="cover" recyclingKey={String(movie.id)} transition={120} cachePolicy="memory-disk" />
          : <View style={[styles.img, styles.placeholder]}><Text style={styles.placeholderText} numberOfLines={3}>{movie.title}</Text></View>}
        <Animated.View pointerEvents="none" style={[styles.ring, { opacity: ring }]} />
      </Animated.View>
    </Pressable>
  );
}

export default memo(Poster);

const styles = StyleSheet.create({
  hit: { marginRight: POSTER_GAP, paddingVertical: 10 },
  card: { width: POSTER_W, height: POSTER_H, borderRadius: 8 },
  img: { width: POSTER_W, height: POSTER_H, borderRadius: 8, backgroundColor: C.surface2 },
  placeholder: { alignItems: "center", justifyContent: "center", padding: 10 },
  placeholderText: { color: C.dim, fontFamily: FONTS.marqueeBold, fontSize: 16, textAlign: "center" },
  ring: { ...StyleSheet.absoluteFillObject, borderRadius: 10, borderWidth: 3, borderColor: C.accent, margin: -3 },
});
