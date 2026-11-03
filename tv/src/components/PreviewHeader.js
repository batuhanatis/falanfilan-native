import React, { memo, useEffect, useRef, useState } from "react";
import { View, Text, Animated, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { C, FONTS, SAFE_X, SAFE_Y, PREVIEW_H, upperTR } from "../theme";
import { platformLabel } from "../platforms";
import { focusStore } from "../focusStore";

// Satırlardayken en üstte odaktaki afişin kısa tanıtımı. Odak deposuna (focusStore) abone:
// afiş değiştikçe yalnızca bu şerit yeniden çiziliyor. Bulanıklık yok (TV'de işlemciyi yoruyor);
// afiş sağda, soldan karartılmış.
function PreviewHeader({ visible }) {
  const [movie, setMovie] = useState(focusStore.get());
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => focusStore.subscribe(setMovie), []);
  useEffect(() => {
    Animated.timing(fade, { toValue: visible ? 1 : 0, duration: 160, useNativeDriver: true }).start();
  }, [visible, fade]);

  const meta = movie ? [movie.genre, movie.type, movie.year, movie.imdb ? `IMDb ${movie.imdb}` : null].filter(Boolean).join("  ·  ") : "";
  // Marka adları düz büyük harf (NETFLIX, PRIME VIDEO), Türkçe İ değil.
  const platforms = (movie?.platforms || []).map((p) => platformLabel(p.name).name.toUpperCase()).join("  ·  ");

  return (
    <Animated.View pointerEvents="none" style={[styles.root, { opacity: fade }]}>
      {!!movie?.poster && (
        <View style={styles.art}>
          <Image source={movie.poster} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} cachePolicy="memory-disk" />
          <LinearGradient colors={[C.bg, "rgba(20,18,26,0.55)", "rgba(20,18,26,0.15)"]} locations={[0, 0.5, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          <LinearGradient colors={["rgba(20,18,26,0)", C.bg]} locations={[0.6, 1]} style={StyleSheet.absoluteFill} />
        </View>
      )}
      {!!movie && (
        <View style={styles.text}>
          <Text style={styles.meta} numberOfLines={1}>{upperTR(meta)}</Text>
          <Text style={styles.title} numberOfLines={1}>{movie.title}</Text>
          {!!movie.overview && <Text style={styles.overview} numberOfLines={2}>{movie.overview}</Text>}
          {!!platforms && <Text style={styles.platforms} numberOfLines={1}>{platforms}</Text>}
        </View>
      )}
    </Animated.View>
  );
}

export default memo(PreviewHeader);

const styles = StyleSheet.create({
  root: { position: "absolute", top: 0, left: 0, right: 0, height: PREVIEW_H, backgroundColor: C.bg },
  art: { position: "absolute", top: 0, right: 0, bottom: 0, width: 300, opacity: 0.55 },
  text: { paddingHorizontal: SAFE_X, paddingTop: SAFE_Y + 4, maxWidth: 640 },
  meta: { fontFamily: FONTS.monoMedium, color: C.accent, fontSize: 12, letterSpacing: 1.5 },
  title: { fontFamily: FONTS.marquee, color: C.text, fontSize: 44, lineHeight: 48, marginTop: 4 },
  overview: { color: C.text, opacity: 0.82, fontSize: 15, lineHeight: 21, marginTop: 4 },
  platforms: { fontFamily: FONTS.monoMedium, color: C.dim, fontSize: 12, letterSpacing: 1.5, marginTop: 8 },
});
