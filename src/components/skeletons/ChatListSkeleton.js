import React from "react";
import { StyleSheet, View } from "react-native";
import { SkeletonBlock } from "../Skeleton";

// ChatListScreen'in "aktivite" sekmesi yüklenirken — kart, gerçek satırla (styles.card,
// 46x46 avatar) AYNI boyutlarda.
export default function ChatListSkeleton({ rows = 7 }) {
  return (
    <View style={{ padding: 16 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={styles.card}>
          <SkeletonBlock width={46} height={46} radius={999} />
          <View style={{ flex: 1, gap: 6 }}>
            <SkeletonBlock width="55%" height={12} />
            <SkeletonBlock width="35%" height={10} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, marginTop: 8 },
});
