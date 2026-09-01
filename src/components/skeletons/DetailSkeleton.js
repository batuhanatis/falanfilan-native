import React from "react";
import { StyleSheet, View } from "react-native";
import { SkeletonBlock } from "../Skeleton";

// DetailScreen'in kendisi zaten route.params üzerinden gelen film/dizi verisiyle ANINDA açılıyor
// (poster/başlık için ayrı bir ağ isteği yok) — asıl "boşluk" ikinci planda gelen verilerde:
// oyuncu/benzer içerik satırları (extra) ve yorumlar. İkisi de kendi yükleme bayraklarına göre
// (extraLoading, commentsLoading) ayrı ayrı gösteriliyor.
export function DetailExtraSkeleton() {
  return (
    <View style={{ marginTop: 18 }}>
      <SkeletonBlock width={70} height={9} />
      <View style={styles.row}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ alignItems: "center", gap: 6 }}>
            <SkeletonBlock width={56} height={56} radius={999} />
            <SkeletonBlock width={48} height={8} />
          </View>
        ))}
      </View>
      <SkeletonBlock width={110} height={9} style={{ marginTop: 18 }} />
      <View style={styles.row}>
        {[0, 1, 2].map((i) => (
          <SkeletonBlock key={i} width={90} height={132} radius={10} />
        ))}
      </View>
    </View>
  );
}

export function CommentsSkeleton() {
  return (
    <View>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.commentRow}>
          <SkeletonBlock width={26} height={26} radius={999} />
          <View style={{ flex: 1, gap: 5 }}>
            <SkeletonBlock width="30%" height={9} />
            <SkeletonBlock width="75%" height={10} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12, marginTop: 8 },
  commentRow: { flexDirection: "row", gap: 8, marginBottom: 12, alignItems: "flex-start" },
});
