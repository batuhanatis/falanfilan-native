import React, { useEffect, useRef, useState } from "react";
import { Animated, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Info, Trash2, X } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import RetryImage from "./RetryImage";
import { avatarOr } from "../utils/avatar";

const DURATION = 5000;

function relativeTime(value) {
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return "az önce";
  if (min < 60) return `${min} dk`;
  return `${Math.floor(min / 60)} sa`;
}

// Tam ekran story izleyici — Instagram'daki gibi: üstte segment bazlı ilerleme çubuğu (kişinin
// KAÇ story'si varsa o kadar segment), otomatik ilerleme, ekranın solu/sağı önceki/sonraki'ne
// dokunarak geçiş. Bir story ekrana geldiği an /api/social/feed/seen'e 'story-<id>' anahtarıyla
// bildiriliyor — ActivityScreen'deki toplu "seen" mekanizmasından bağımsız, çünkü story'ler
// scroll ile değil açık bir kullanıcı eylemiyle (dokunma) görülüyor.
export default function StoryViewer({ groups, startGroupIndex, navigation, onClose }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(c, insets);
  const [groupIndex, setGroupIndex] = useState(startGroupIndex || 0);
  const [storyIndex, setStoryIndex] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const animRef = useRef(null);
  const seenSent = useRef(new Set());

  const group = groups[groupIndex];
  const story = group?.stories?.[storyIndex];

  function advance(dir) {
    if (!group) return;
    const nextStoryIndex = storyIndex + dir;
    if (nextStoryIndex >= 0 && nextStoryIndex < group.stories.length) {
      setStoryIndex(nextStoryIndex);
      return;
    }
    const nextGroupIndex = groupIndex + dir;
    if (nextGroupIndex >= 0 && nextGroupIndex < groups.length) {
      setGroupIndex(nextGroupIndex);
      setStoryIndex(dir > 0 ? 0 : groups[nextGroupIndex].stories.length - 1);
      return;
    }
    onClose?.();
  }

  useEffect(() => {
    if (!story) return;
    if (!seenSent.current.has(story.id)) {
      seenSent.current.add(story.id);
      api.markFeedSeen(auth.token, [story.id]).catch(() => seenSent.current.delete(story.id));
    }
    progress.setValue(0);
    animRef.current = Animated.timing(progress, { toValue: 1, duration: DURATION, useNativeDriver: false });
    animRef.current.start(({ finished }) => { if (finished) advance(1); });
    return () => animRef.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIndex, storyIndex]);

  async function deleteMine() {
    if (!story || !group.isOwn) return;
    try {
      await api.socialDeleteStory(auth.token, story.storyId);
      advance(1);
    } catch {}
  }

  function openDetail() {
    if (story?.movie) navigation.navigate("Detail", { movie: story.movie });
  }

  if (!story) return null;

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        {!!story.movie?.poster && (
          <Image source={{ uri: story.movie.poster }} style={StyleSheet.absoluteFillObject} resizeMode="cover" blurRadius={3} />
        )}
        <LinearGradient
          colors={["rgba(0,0,0,0.8)", "transparent", "rgba(0,0,0,0.88)"]}
          locations={[0, 0.35, 1]}
          style={StyleSheet.absoluteFillObject}
        />

        <View style={styles.tapZones}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => advance(-1)} />
          <TouchableOpacity style={{ flex: 2 }} activeOpacity={1} onPress={() => advance(1)} />
        </View>

        <View style={styles.top}>
          <View style={styles.segRow}>
            {group.stories.map((s, i) => (
              <View key={s.id} style={styles.segTrack}>
                <Animated.View
                  style={[
                    styles.segFill,
                    {
                      width:
                        i < storyIndex
                          ? "100%"
                          : i > storyIndex
                          ? "0%"
                          : progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
                    },
                  ]}
                />
              </View>
            ))}
          </View>
          <View style={styles.headerRow}>
            <RetryImage source={{ uri: avatarOr(group.user.avatar_url) }} style={styles.headerAvatar} />
            <View style={{ flex: 1 }}>
              <Text style={styles.headerName}>{group.isOwn ? "Sen" : group.user.name}</Text>
              <Text style={styles.headerTime}>{relativeTime(story.created_at)}</Text>
            </View>
            {group.isOwn && (
              <TouchableOpacity style={styles.iconBtn} onPress={deleteMine} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Trash2 size={17} color="#fff" />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.iconBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={19} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.center} pointerEvents="box-none">
          {!!story.movie?.poster && <Image source={{ uri: story.movie.poster }} style={styles.poster} resizeMode="contain" />}
        </View>

        <View style={styles.bottom} pointerEvents="box-none">
          {!!story.note && <Text style={styles.note}>{story.note}</Text>}
          {!!story.movie && (
            <TouchableOpacity style={styles.detailBtn} onPress={openDetail}>
              <Info size={14} color={c.bg} />
              <Text style={styles.detailText} numberOfLines={1}>{story.movie.title} · Detay</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(c, insets) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: "#000" },
    tapZones: { ...StyleSheet.absoluteFillObject, flexDirection: "row" },
    top: { position: "absolute", top: insets.top + 8, left: 12, right: 12 },
    segRow: { flexDirection: "row", gap: 4 },
    segTrack: { flex: 1, height: 2.5, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.3)", overflow: "hidden" },
    segFill: { height: "100%", backgroundColor: "#fff" },
    headerRow: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 12 },
    headerAvatar: { width: 32, height: 32, borderRadius: 999, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.5)" },
    headerName: { color: "#fff", fontWeight: "800", fontSize: 13 },
    headerTime: { color: "rgba(255,255,255,0.7)", fontSize: 10.5, marginTop: 1 },
    iconBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
    center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingTop: 70, paddingBottom: 110 },
    poster: { width: "100%", height: "100%", borderRadius: 16 },
    bottom: { position: "absolute", bottom: insets.bottom + 22, left: 16, right: 16, alignItems: "center" },
    note: { color: "#fff", fontSize: 13.5, fontWeight: "600", textAlign: "center", marginBottom: 10, lineHeight: 19 },
    detailBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fff", borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, maxWidth: "90%" },
    detailText: { color: c.bg, fontWeight: "800", fontSize: 12.5 },
  });
}
