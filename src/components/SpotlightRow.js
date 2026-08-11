import React from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, FlatList } from "react-native";
import { Star } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";

export default function SpotlightRow({ title, icon, items, navigation }) {
  const { c } = useAppTheme();
  const styles = makeStyles(c);
  if (!items || items.length === 0) return null;

  return (
    <View style={{ marginTop: 16 }}>
      <View style={styles.header}>
        {icon}
        <Text style={styles.title}>{title}</Text>
      </View>
      <FlatList
        data={items}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ gap: 10 }}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate("Detail", { movie: item })} activeOpacity={0.85}>
            {item.poster ? <Image source={{ uri: item.poster }} style={styles.poster} /> : <View style={[styles.poster, { backgroundColor: c.surface2 }]} />}
            <View style={styles.ratingBadge}>
              <Star size={9} color="#fff" fill="#fff" />
              <Text style={styles.ratingText}>{item.imdb}</Text>
            </View>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.cardMeta}>{item.year}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    header: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
    title: { fontSize: 13, fontWeight: "800", color: c.text },
    card: { width: 100 },
    poster: { width: 100, height: 148, borderRadius: 12, backgroundColor: c.surface2 },
    ratingBadge: {
      position: "absolute", top: 6, left: 6, flexDirection: "row", alignItems: "center", gap: 3,
      backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999,
    },
    ratingText: { fontSize: 9, fontWeight: "800", color: "#fff" },
    cardTitle: { fontSize: 11, fontWeight: "700", color: c.text, marginTop: 6 },
    cardMeta: { fontSize: 10, color: c.dim, marginTop: 1 },
  });
}
