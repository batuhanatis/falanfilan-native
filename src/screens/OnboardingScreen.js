import React, { useState, useEffect } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { Heart } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

export default function OnboardingScreen() {
  const { c } = useAppTheme();
  const { auth, markOnboardingComplete } = useAuth();
  const [movies, setMovies] = useState([]);
  const [picked, setPicked] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const styles = makeStyles(c);

  useEffect(() => {
    (async () => {
      const [movieRes, tvRes] = await Promise.all([
        api.movies(auth.token, "movie", 1).catch(() => ({ results: [] })),
        api.movies(auth.token, "tv", 1).catch(() => ({ results: [] })),
      ]);
      setMovies([...(movieRes.results || []), ...(tvRes.results || [])].slice(0, 24));
      setLoading(false);
    })();
  }, []);

  function toggle(id) {
    setPicked((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
    api.recordInteraction(auth.token, id, "like").catch(() => {});
  }

  const count = picked.size;
  const done = count >= 5;

  async function finish() {
    await markOnboardingComplete();
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: 60 }}>
      <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
        <Text style={styles.title}>Zevkini tanıyalım, {auth?.name?.split(" ")[0] || ""}</Text>
        <Text style={styles.subtitle}>Sana özel öneriler üretebilmemiz için en az 5 film/dizi beğen.</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.min(count / 5, 1) * 100}%` }]} />
        </View>
        <Text style={styles.progressLabel}>{count}/5</Text>
      </View>

      <FlatList
        data={movies}
        keyExtractor={(item) => String(item.id)}
        numColumns={3}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => {
          const isPicked = picked.has(item.id);
          return (
            <TouchableOpacity style={styles.posterWrap} onPress={() => toggle(item.id)} activeOpacity={0.85}>
              {item.poster ? (
                <Image source={{ uri: item.poster }} style={[styles.poster, isPicked && styles.posterPicked]} />
              ) : (
                <View style={[styles.poster, { backgroundColor: c.surface2 }]} />
              )}
              <View style={[styles.heartBadge, isPicked && { backgroundColor: c.accent2 }]}>
                <Heart size={12} color="#fff" fill={isPicked ? "#fff" : "none"} />
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <View style={styles.footer}>
        <TouchableOpacity style={styles.skipBtn} onPress={finish}>
          <Text style={styles.skipText}>Atla</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.continueBtn, !done && { backgroundColor: c.surface2 }]} disabled={!done} onPress={finish}>
          <Text style={[styles.continueText, !done && { color: c.dim }]}>
            {done ? "Devam Et" : `${5 - count} beğeni daha`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.bg },
    title: { color: c.text, fontSize: 19, fontWeight: "700" },
    subtitle: { color: c.dim, fontSize: 12, marginTop: 4 },
    progressTrack: { height: 6, borderRadius: 999, backgroundColor: c.surface2, marginTop: 12, overflow: "hidden" },
    progressFill: { height: "100%", backgroundColor: c.accent },
    progressLabel: { color: c.dim, fontSize: 11, marginTop: 4, textAlign: "right" },
    posterWrap: { flex: 1 / 3, aspectRatio: 2 / 3, margin: 4, position: "relative" },
    poster: { width: "100%", height: "100%", borderRadius: 10 },
    posterPicked: { opacity: 0.75 },
    heartBadge: {
      position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: 999,
      backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center",
    },
    footer: { flexDirection: "row", gap: 8, padding: 16, borderTopWidth: 1, borderTopColor: c.border },
    skipBtn: { paddingHorizontal: 18, justifyContent: "center", borderRadius: 14, borderWidth: 1, borderColor: c.border },
    skipText: { color: c.dim, fontWeight: "700", fontSize: 13 },
    continueBtn: { flex: 1, backgroundColor: c.accent, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
    continueText: { color: c.bg, fontWeight: "800", fontSize: 14 },
  });
}
