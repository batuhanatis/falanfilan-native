import React from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";
import { Star } from "lucide-react-native";
import { FONTS, upperTR } from "../../theme/fonts";

// Profildeki "Favori Film / Favori Dizi" kartı: solda küçük afiş, üstte daktilo harfli etiket.
export default function FavCard({ label, movie, c, onPress }) {
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={{ flex: 1, flexDirection: "row", gap: 8, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 8, alignItems: "center" }}>
      {movie.poster ? (
        <Image source={{ uri: movie.poster }} style={{ width: 40, height: 58, borderRadius: 8 }} />
      ) : (
        <View style={{ width: 40, height: 58, borderRadius: 8, backgroundColor: c.surface2 }} />
      )}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
          <Star size={10} color={c.accent} fill={c.accent} />
          <Text style={{ fontSize: 10, fontFamily: FONTS.monoMedium, color: c.accent, letterSpacing: 0.6 }}>{upperTR(label)}</Text>
        </View>
        <Text style={{ fontSize: 13, fontWeight: "600", color: c.text, marginTop: 3 }} numberOfLines={2}>{movie.title}</Text>
      </View>
    </TouchableOpacity>
  );
}
