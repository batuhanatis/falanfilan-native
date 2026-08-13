import React from "react";
import { View, Image, Text, StyleSheet } from "react-native";
import { ListVideo } from "lucide-react-native";
import { watchlistFallbackColor } from "../utils/listCover";

// WL1 — tek, paylaşılan "liste kimliği" görseli. Öncelik sırası: kullanıcı bir emoji seçtiyse
// (bilinçli bir kimlik tercihi) her zaman o + rengi gösterilir; seçmediyse ilk içeriğin posteri;
// o da yoksa (liste boşsa) id'den türetilmiş bir renk + jenerik ikon.
export default function WatchlistCover({ list, style, emojiSize = 26 }) {
  const color = list?.coverColor || watchlistFallbackColor(list);

  if (list?.coverEmoji) {
    return (
      <View style={[styles.wrap, { backgroundColor: color }, style]}>
        <Text style={{ fontSize: emojiSize }}>{list.coverEmoji}</Text>
      </View>
    );
  }
  if (list?.previewPoster) {
    return <Image source={{ uri: list.previewPoster }} style={[styles.wrap, style]} />;
  }
  return (
    <View style={[styles.wrap, styles.center, { backgroundColor: color }, style]}>
      <ListVideo size={emojiSize * 0.7} color="#fff" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: "hidden" },
  center: { alignItems: "center", justifyContent: "center" },
});
