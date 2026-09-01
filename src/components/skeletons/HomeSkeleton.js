import React from "react";
import { StyleSheet, View } from "react-native";
import { SkeletonBlock } from "../Skeleton";

// HomeScreen ilk açılırken (öneri listesi henüz gelmeden) — PopularNowRow'un yatay şeridi ve
// 2 sütunlu öneri ızgarasıyla AYNI boyutlarda bloklar, "İçerikler hazırlanıyor..." yazan tek
// spinner yerine.
export default function HomeSkeleton() {
  return (
    <View style={styles.wrap}>
      <View style={styles.popularRow}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.popularItem}>
            <SkeletonBlock width={96} height={144} radius={12} />
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={styles.card}>
            <SkeletonBlock width="100%" height={undefined} radius={14} style={styles.poster} />
            <SkeletonBlock width="80%" height={11} style={{ marginTop: 8 }} />
            <SkeletonBlock width="45%" height={9} style={{ marginTop: 5 }} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16 },
  popularRow: { flexDirection: "row", gap: 10, marginBottom: 22 },
  popularItem: { width: 96 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: { width: "47%" },
  poster: { aspectRatio: 2 / 3 },
});
