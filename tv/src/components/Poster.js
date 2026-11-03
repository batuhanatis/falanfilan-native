import React, { memo, useRef } from "react";
import { Pressable, Image, View, Text, Animated, StyleSheet } from "react-native";
import { C, FONTS } from "../theme";

export const POSTER_W = 112;
export const POSTER_H = 168;

// Satırdaki afiş. Odaklanınca büyüyor ve altın çerçeve alıyor; odak bilgisini üst ekrana
// (kahraman alanı için) iletiyor.
function Poster({ movie, onFocusMovie, onOpen, hasTVPreferredFocus }) {
  const scale = useRef(new Animated.Value(1)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const animate = (to) => Animated.parallel([
    Animated.spring(scale, { toValue: to ? 1.1 : 1, friction: 7, tension: 140, useNativeDriver: true }),
    Animated.timing(ring, { toValue: to ? 1 : 0, duration: 140, useNativeDriver: true }),
  ]).start();
  return (
    <Pressable
      onPress={() => onOpen(movie)}
      onFocus={() => { animate(true); onFocusMovie(movie); }}
      onBlur={() => animate(false)}
      hasTVPreferredFocus={hasTVPreferredFocus}
      accessibilityRole="button"
      accessibilityLabel={`${movie.title}${movie.year ? `, ${movie.year}` : ""}`}
      style={styles.hit}
    >
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        {movie.poster
          ? <Image source={{ uri: movie.poster }} style={styles.img} />
          : <View style={[styles.img, styles.placeholder]}><Text style={styles.placeholderText} numberOfLines={3}>{movie.title}</Text></View>}
        <Animated.View pointerEvents="none" style={[styles.ring, { opacity: ring }]} />
      </Animated.View>
    </Pressable>
  );
}

export default memo(Poster);

const styles = StyleSheet.create({
  hit: { marginRight: 16, paddingVertical: 10 },
  card: { width: POSTER_W, height: POSTER_H, borderRadius: 8 },
  img: { width: POSTER_W, height: POSTER_H, borderRadius: 8, backgroundColor: C.surface2 },
  placeholder: { alignItems: "center", justifyContent: "center", padding: 10 },
  placeholderText: { color: C.dim, fontFamily: FONTS.marqueeBold, fontSize: 16, textAlign: "center" },
  ring: { ...StyleSheet.absoluteFillObject, borderRadius: 10, borderWidth: 3, borderColor: C.accent, margin: -3 },
});
