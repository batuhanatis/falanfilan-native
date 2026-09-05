import React from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { Sparkles, ChevronRight, Star } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import IslandModal from "./IslandModal";

export default function RecommendationWhyModal({ visible, movie, reasons = [], onClose, onOpenDetail }) {
  const { c } = useAppTheme();
  const styles = makeStyles(c);

  if (!movie) return null;

  const personalizedCount = reasons.filter((r) => r.personalized).length;
  const shownReasons = reasons.slice(0, 6);

  return (
    <IslandModal
      visible={visible}
      onClose={onClose}
      title="Bunu sana neden önerdik?"
      icon={Sparkles}
      gradientColors={["#7C3AED", "#5B21B6", "#312E81"]}
      subtitle={movie.title}
    >
      <View style={styles.movieRow}>
        {movie.poster ? (
          <Image source={{ uri: movie.poster }} style={styles.poster} />
        ) : (
          <View style={[styles.poster, { backgroundColor: c.surface2 }]} />
        )}
        <View style={styles.movieCopy}>
          <Text style={styles.movieTitle} numberOfLines={2}>{movie.title}</Text>
          <View style={styles.metaRow}>
            <Star size={11} color={c.accent} fill={c.accent} />
            <Text style={styles.metaText}>{movie.imdb || "—"}</Text>
            {!!movie.year && <Text style={styles.metaText}>· {movie.year}</Text>}
            {!!movie.runtime && <Text style={styles.metaText}>· {movie.runtime}</Text>}
          </View>
          <Text style={styles.summaryText}>
            {personalizedCount > 0
              ? `Pellix bu seçim için ${personalizedCount} kişisel sinyal buldu.`
              : "Zevk profilin henüz gelişiyor; bu yüzden yalnızca doğrulayabildiğimiz sinyalleri gösteriyoruz."}
          </Text>
        </View>
      </View>

      <View style={styles.reasonList}>
        {shownReasons.map((reason, index) => (
          <View key={`${reason.title}-${index}`} style={styles.reasonCard}>
            <View style={styles.reasonHeader}>
              <View style={[styles.dot, !reason.personalized && styles.dotNeutral]} />
              <Text style={[styles.source, !reason.personalized && styles.sourceNeutral]}>{reason.source}</Text>
            </View>
            <Text style={styles.reasonTitle}>{reason.title}</Text>
            <Text style={styles.reasonDetail}>{reason.detail}</Text>
          </View>
        ))}
      </View>

      <View style={styles.trustBox}>
        <Sparkles size={14} color="#A78BFA" />
        <Text style={styles.trustText}>
          Bu açıklamalar yalnızca gerçek beğenilerin, profil tercihlerin, açık filtrelerin ve içeriğin ölçülebilir özelliklerinden üretilir. Elimizde olmayan bir sinyali uydurmuyoruz.
        </Text>
      </View>

      <TouchableOpacity style={styles.detailButton} onPress={onOpenDetail} activeOpacity={0.86}>
        <Text style={styles.detailButtonText}>İçeriği Gör</Text>
        <ChevronRight size={16} color="#14121a" />
      </TouchableOpacity>
    </IslandModal>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    movieRow: { flexDirection: "row", gap: 13, alignItems: "center" },
    poster: { width: 64, height: 96, borderRadius: 12, backgroundColor: c.surface2 },
    movieCopy: { flex: 1, minWidth: 0 },
    movieTitle: { color: c.text, fontSize: 17, lineHeight: 21, fontWeight: "900" },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6, flexWrap: "wrap" },
    metaText: { color: c.dim, fontSize: 10.5, fontWeight: "700" },
    summaryText: { color: c.dim, fontSize: 11, lineHeight: 16, marginTop: 8 },

    reasonList: { gap: 9, marginTop: 18 },
    reasonCard: { backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 15, padding: 13 },
    reasonHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 5 },
    dot: { width: 7, height: 7, borderRadius: 999, backgroundColor: "#8B5CF6" },
    dotNeutral: { backgroundColor: c.dim },
    source: { color: "#A78BFA", fontSize: 8.5, fontWeight: "900", letterSpacing: 0.7 },
    sourceNeutral: { color: c.dim },
    reasonTitle: { color: c.text, fontSize: 12.5, fontWeight: "800" },
    reasonDetail: { color: c.dim, fontSize: 11, lineHeight: 16, marginTop: 4 },

    trustBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 14, borderRadius: 13, backgroundColor: "rgba(124,58,237,0.10)", borderWidth: 1, borderColor: "rgba(124,58,237,0.20)", padding: 11 },
    trustText: { flex: 1, color: c.dim, fontSize: 10, lineHeight: 15 },

    detailButton: { minHeight: 46, marginTop: 14, borderRadius: 14, backgroundColor: c.accent, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
    detailButtonText: { color: "#14121a", fontSize: 12.5, fontWeight: "900" },
  });
}
