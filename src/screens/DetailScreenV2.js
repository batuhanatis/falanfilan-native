import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { Check, Eye } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { diaryApi } from "../api/diary";
import DetailScreen from "./DetailScreen";
import DiaryEntryModal from "../components/DiaryEntryModal";

// Mevcut DetailScreen'in gesture/poster-panel davranışına dokunmadan Diary aksiyonunu üst katman
// olarak ekliyoruz. Backend henüz deploy edilmemişse /api/diary çağrısı başarısız olur ve buton
// kendini gizler; böylece native OTA, API rollout'undan önce bile eski kullanıcı akışını bozmaz.
export default function DetailScreenV2(props) {
  const movie = props.route?.params?.movie;
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(c);

  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [entry, setEntry] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!movie?.id) {
      setLoading(false);
      setAvailable(false);
      return undefined;
    }
    setLoading(true);
    diaryApi.entry(auth.token, movie.id)
      .then((data) => {
        if (cancelled) return;
        setAvailable(true);
        setEntry(data.entry || null);
      })
      .catch(() => {
        if (cancelled) return;
        setAvailable(false);
        setEntry(null);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [auth.token, movie?.id]);

  return (
    <View style={{ flex: 1 }}>
      <DetailScreen {...props} />

      {available && (
        <TouchableOpacity
          style={[styles.diaryPill, { top: Math.max(insets.top + 8, 46) }, entry && styles.diaryPillActive]}
          onPress={() => setModalOpen(true)}
          activeOpacity={0.86}
          accessibilityRole="button"
          accessibilityLabel={entry ? "Pellix Diary kaydını düzenle" : "İzledim olarak işaretle"}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : entry ? (
            <Check size={14} color="#fff" strokeWidth={2.8} />
          ) : (
            <Eye size={14} color="#fff" />
          )}
          <Text style={styles.diaryPillText}>{entry ? "İzlendi" : "İzledim"}</Text>
        </TouchableOpacity>
      )}

      <DiaryEntryModal
        visible={modalOpen}
        movie={movie}
        entry={entry}
        onClose={() => setModalOpen(false)}
        onSaved={(next) => { setEntry(next); setAvailable(true); }}
        onRemoved={() => setEntry(null)}
      />
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    diaryPill: {
      position: "absolute", right: 14, zIndex: 120, elevation: 20,
      minHeight: 36, borderRadius: 999, paddingHorizontal: 12,
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
      backgroundColor: "rgba(12,10,18,0.72)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)",
      shadowColor: "#000", shadowOpacity: 0.24, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    },
    diaryPillActive: { backgroundColor: c.accent2, borderColor: c.accent2 },
    diaryPillText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  });
}
