import { t as translateUI } from "../i18n/core";
import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { Check, Eye, ChevronLeft } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { diaryApi } from "../api/diary";
import { api } from "../api/client";
import DetailScreen from "./DetailScreen";
import DiaryEntryModal from "../components/DiaryEntryModal";
import LiveRoomBanner from "../components/LiveRoomBanner";

// Mevcut DetailScreen'in gesture/poster-panel davranışına dokunmadan Diary aksiyonunu üst katman
// olarak ekliyoruz. Backend henüz deploy edilmemişse /api/diary çağrısı başarısız olur ve buton
// kendini gizler; böylece native OTA, API rollout'undan önce bile eski kullanıcı akışını bozmaz.
export default function DetailScreenV2(props) {
  const movie = props.route?.params?.movie;
  // Linkten (open.pellix.app/u/film/<id>) gelince elde yalnızca kimlik var: içerik bir kez
  // çekiliyor, ekran tam veriyle açılıyor (DetailScreen ilk değerlerini movie'den alıyor).
  if (movie?.id && !movie.title) return <DetailLoader {...props} />;
  return <DetailWithDiary {...props} />;
}

function DetailLoader({ route, navigation }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const insets = useSafeAreaInsets();
  const id = route?.params?.movie?.id;
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    api.movieById(auth.token, id)
      .then((fresh) => {
        if (cancelled) return;
        if (fresh?.id && fresh?.title) navigation.setParams({ movie: fresh });
        else setFailed(true);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [id, auth.token]);
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center", padding: 24 }}>
      <TouchableOpacity
        onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("MainTabs"))}
        style={{ position: "absolute", top: insets.top + 8, left: 12, padding: 8 }}
        accessibilityRole="button"
        accessibilityLabel={translateUI("Geri")}
      >
        <ChevronLeft size={26} color={c.text} />
      </TouchableOpacity>
      {failed ? (
        <Text style={{ color: c.dim, fontSize: 14, textAlign: "center" }}>{translateUI("Bu içerik açılamadı. Bağlantını kontrol edip tekrar dene.")}</Text>
      ) : (
        <ActivityIndicator color={c.accent} />
      )}
    </View>
  );
}

function DetailWithDiary(props) {
  const movie = props.route?.params?.movie;
  const { navigation } = props;
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
          accessibilityLabel={entry ? translateUI("Pellix Diary kaydını düzenle") : translateUI("İzledim olarak işaretle")}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : entry ? (
            <Check size={14} color="#fff" strokeWidth={2.8} />
          ) : (
            <Eye size={14} color="#fff" />
          )}
          <Text style={styles.diaryPillText}>{entry ? translateUI("İzlendi") : translateUI("İzledim")}</Text>
        </TouchableOpacity>
      )}

      {/* Bölüm yayınındaki canlı sohbet odasına giriş (admin panelinden açılan odalar). */}
      {!!movie?.id && <LiveRoomBanner movieId={movie.id} navigation={navigation} />}

      <DiaryEntryModal
        visible={modalOpen}
        movie={movie}
        entry={entry}
        onClose={() => setModalOpen(false)}
        onSaved={(next) => { setEntry(next); setAvailable(true); }}
        onRemoved={() => setEntry(null)}
        onOpenDiary={() => navigation.navigate("Diary")}
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
