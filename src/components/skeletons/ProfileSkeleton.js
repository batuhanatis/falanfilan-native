import React from "react";
import { StyleSheet, View } from "react-native";
import { SkeletonBlock } from "../Skeleton";

// ProfileScreen ilk açılırken — gerçek sayfanın kapak/avatar/istatistik/beğeni-ızgarası
// düzeniyle AYNI boyutlarda bloklar, veriler gelince aynı yerlere birebir oturuyor.
export default function ProfileSkeleton() {
  return (
    <View>
      <SkeletonBlock width="100%" height={100} radius={0} />
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <SkeletonBlock width={76} height={76} radius={999} />
          <View style={styles.statsRow}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={{ alignItems: "center", gap: 6 }}>
                <SkeletonBlock width={22} height={15} />
                <SkeletonBlock width={38} height={9} />
              </View>
            ))}
          </View>
        </View>
        <SkeletonBlock width="45%" height={16} style={{ marginTop: 14 }} />
        <SkeletonBlock width="30%" height={11} style={{ marginTop: 8 }} />
        <SkeletonBlock width="80%" height={11} style={{ marginTop: 8 }} />

        <View style={styles.actionsRow}>
          <SkeletonBlock width="100%" height={38} radius={11} style={{ flex: 1 }} />
          <SkeletonBlock width="100%" height={38} radius={11} style={{ flex: 1 }} />
        </View>

        <View style={styles.grid}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <SkeletonBlock key={i} width="31.5%" height={130} radius={8} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statsRow: { flexDirection: "row", gap: 22 },
  actionsRow: { flexDirection: "row", gap: 10, marginTop: 18 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 22 },
});
