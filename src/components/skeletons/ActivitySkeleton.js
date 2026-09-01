import React from "react";
import { StyleSheet, View } from "react-native";
import { useAppTheme } from "../../context/ThemeContext";
import { SkeletonBlock } from "../Skeleton";

// ActivityScreen ilk açılırken (feed henüz gelmeden) gösteriliyor — story şeridi, bir "hero"
// kart (SocialFeedCard'ın poster ağırlıklı hali) ve kompakt aktivite satırları (SocialActivityGroup)
// ile AYNI boyutlarda bloklar, gerçek içerik gelince yerlerini birebir alıyor (sıçrama olmasın diye).
export default function ActivitySkeleton() {
  const { c } = useAppTheme();
  const styles = makeStyles(c);
  return (
    <View style={styles.wrap}>
      <View style={styles.storyRow}>
        {[0, 1, 2, 3, 4].map((i) => (
          <SkeletonBlock key={i} width={60} height={60} radius={999} />
        ))}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <SkeletonBlock width={40} height={40} radius={999} />
          <View style={{ flex: 1, gap: 6 }}>
            <SkeletonBlock width="55%" height={11} />
            <SkeletonBlock width="35%" height={9} />
          </View>
        </View>
        <SkeletonBlock width="100%" height={220} radius={14} style={{ marginTop: 12 }} />
      </View>

      <View style={styles.group}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.row, i < 2 && styles.rowDivider]}>
            <SkeletonBlock width={40} height={40} radius={999} />
            <View style={{ flex: 1, gap: 6 }}>
              <SkeletonBlock width="70%" height={10} />
              <SkeletonBlock width="45%" height={9} />
            </View>
            <SkeletonBlock width={40} height={58} radius={7} />
          </View>
        ))}
      </View>
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    wrap: { paddingTop: 4 },
    storyRow: { flexDirection: "row", gap: 14, marginBottom: 16 },
    card: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 18, padding: 14, marginBottom: 14 },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
    group: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 14, overflow: "hidden" },
    row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 13, paddingVertical: 12 },
    rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
  });
}
