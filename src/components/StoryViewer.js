import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Animated, FlatList, Image, Keyboard, KeyboardAvoidingView, Modal, PanResponder, Platform,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Check, ChevronDown, Eye, Info, Send, Trash2, X } from "lucide-react-native";
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
export default function StoryViewer({ groups, startGroupIndex, navigation, onStorySeen, onClose }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(c, insets);
  const [groupIndex, setGroupIndex] = useState(startGroupIndex || 0);
  const [storyIndex, setStoryIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [replySent, setReplySent] = useState(false);
  const [replyError, setReplyError] = useState("");
  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewers, setViewers] = useState([]);
  const [viewersLoading, setViewersLoading] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const animRef = useRef(null);
  const seenSent = useRef(new Set());
  const replyInputRef = useRef(null);
  const sentTimer = useRef(null);
  const sheetAnim = useRef(new Animated.Value(320)).current;

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
    if (!story || paused) return;
    if (!seenSent.current.has(story.id)) {
      seenSent.current.add(story.id);
      // Ekranda GÖRÜNMESİ yeterli — arkadaşın story'si kendi story'miz DEĞİLSE hemen "görüldü"
      // olarak işaretliyoruz. Sunucuya giden istek tamamlanmasını BEKLEMEDEN, StoryBar'daki
      // halkanın rengini/sırasını anında güncelleyebilsin diye onStorySeen'i senkron çağırıyoruz
      // — ağ gecikmesi yüzünden "izledim ama hâlâ renkli görünüyor" yarış durumu yaşanmasın diye.
      if (!group.isOwn) onStorySeen?.(story.id);
      api.markFeedSeen(auth.token, [story.id]).catch(() => seenSent.current.delete(story.id));
    }
    progress.setValue(0);
    animRef.current = Animated.timing(progress, { toValue: 1, duration: DURATION, useNativeDriver: false });
    animRef.current.start(({ finished }) => { if (finished) advance(1); });
    return () => animRef.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIndex, storyIndex, paused]);

  useEffect(() => () => clearTimeout(sentTimer.current), []);

  function openViewers() {
    if (!story || !group.isOwn) return;
    setPaused(true);
    setViewersOpen(true);
    setViewersLoading(true);
    sheetAnim.setValue(320);
    Animated.spring(sheetAnim, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 4 }).start();
    api.storyViewers(auth.token, story.storyId)
      .then((data) => setViewers(data.results || []))
      .catch(() => setViewers([]))
      .finally(() => setViewersLoading(false));
  }

  function closeViewers() {
    Animated.timing(sheetAnim, { toValue: 320, duration: 180, useNativeDriver: true }).start(() => {
      setViewersOpen(false);
      setPaused(false);
    });
  }

  // ÖNEMLİ: PanResponder.create sadece BİR KEZ (useRef ile) oluşturuluyor — handler'ları
  // oluşturulduğu andaki (mount zamanındaki) group/story değerlerini KALICI olarak kapatıyor
  // (closure). groupIndex/storyIndex zamanla değiştiği için (arkadaş değişince ya da AYNI kendi
  // story grubunda birden fazla story arasında geçince), handler'ın DOĞRUDAN group/story'yi
  // okuması eski/yanlış bir story'ye işaret ederdi. Bunun yerine her render'da güncellenen bir
  // ref üzerinden en GÜNCEL değerlere bakıyoruz.
  const latestRef = useRef({});
  latestRef.current = { isOwn: group?.isOwn, openViewers: () => openViewers() };

  // Şerit yukarı doğru net bir şekilde sürüklenirse, dokunarak ilerleme/geri gitme alanlarının
  // önüne geçmeden bir eyleme geçiyoruz — eşik aşılana kadar responder'ı hiç talep etmiyoruz, bu
  // yüzden normal dokunmalar (tapZones) etkilenmiyor. Kendi story'nde bu, izleyici listesini
  // açıyor (Instagram'daki gibi) — arkadaşının story'sinde ise klavyeyi açıp yanıt kutusuna
  // odaklanıyor.
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gesture) => gesture.dy < -28 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderGrant: () => (latestRef.current.isOwn ? latestRef.current.openViewers() : replyInputRef.current?.focus()),
    })
  ).current;

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

  async function submitReply() {
    const text = replyText.trim();
    if (!text || !story || replySending) return;
    setReplySending(true);
    setReplyError("");
    try {
      await api.storyReply(auth.token, story.storyId, text);
      setReplyText("");
      Keyboard.dismiss();
      setPaused(false);
      setReplySent(true);
      sentTimer.current = setTimeout(() => setReplySent(false), 1600);
    } catch (e) {
      setReplyError(e.message || "Yanıt gönderilemedi.");
    }
    setReplySending(false);
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

        <View style={styles.tapZones} {...panResponder.panHandlers}>
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

        <View style={[styles.bottom, styles.bottomWithReply]} pointerEvents="box-none">
          {!!story.note && <Text style={styles.note}>{story.note}</Text>}
          {!!story.movie && (
            <TouchableOpacity style={styles.detailBtn} onPress={openDetail}>
              <Info size={14} color={c.bg} />
              <Text style={styles.detailText} numberOfLines={1}>{story.movie.title} · Detay</Text>
            </TouchableOpacity>
          )}
        </View>

        {group.isOwn ? (
          <View style={styles.replyBarWrap} pointerEvents="box-none">
            <TouchableOpacity style={styles.viewersPill} onPress={openViewers} activeOpacity={0.85}>
              <Eye size={14} color="#fff" />
              <Text style={styles.viewersPillText}>
                {story.viewCount > 0 ? `${story.viewCount} görüntüleme` : "Henüz görüntüleyen yok"}
              </Text>
              <ChevronDown size={13} color="rgba(255,255,255,0.7)" style={{ transform: [{ rotate: "180deg" }] }} />
            </TouchableOpacity>
          </View>
        ) : (
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.replyBarWrap}
            pointerEvents="box-none"
          >
            {replySent ? (
              <View style={styles.replySentPill}>
                <Check size={13} color="#fff" />
                <Text style={styles.replySentText}>Yanıtın gönderildi</Text>
              </View>
            ) : (
              <View style={styles.replyBar}>
                <TextInput
                  ref={replyInputRef}
                  style={styles.replyInput}
                  placeholder="Yanıt gönder…"
                  placeholderTextColor="rgba(255,255,255,0.55)"
                  value={replyText}
                  onChangeText={setReplyText}
                  onFocus={() => setPaused(true)}
                  onBlur={() => setPaused(false)}
                  maxLength={300}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.replySendBtn, (!replyText.trim() || replySending) && { opacity: 0.4 }]}
                  onPress={submitReply}
                  disabled={!replyText.trim() || replySending}
                >
                  <Send size={15} color="#000" />
                </TouchableOpacity>
              </View>
            )}
            {!!replyError && <Text style={styles.replyErrorText}>{replyError}</Text>}
          </KeyboardAvoidingView>
        )}

        {viewersOpen && (
          <View style={styles.viewersOverlay}>
            <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={closeViewers} />
            <Animated.View style={[styles.viewersSheet, { transform: [{ translateY: sheetAnim }] }]}>
              <View style={styles.viewersHandle} />
              <View style={styles.viewersTitleRow}>
                <Eye size={14} color="#fff" />
                <Text style={styles.viewersTitle}>
                  {viewers.length > 0 ? `${viewers.length} kişi görüntüledi` : "Görüntüleyenler"}
                </Text>
              </View>
              {viewersLoading ? (
                <ActivityIndicator size="small" color={c.accent} style={{ marginTop: 20 }} />
              ) : viewers.length === 0 ? (
                <Text style={styles.viewersEmpty}>Bu story'i henüz kimse görmedi.</Text>
              ) : (
                <FlatList
                  data={viewers}
                  keyExtractor={(v) => String(v.id)}
                  style={{ maxHeight: 320 }}
                  renderItem={({ item }) => (
                    <View style={styles.viewerRow}>
                      <RetryImage source={{ uri: avatarOr(item.avatar_url) }} style={styles.viewerAvatar} />
                      <Text style={styles.viewerName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.viewerTime}>{relativeTime(item.seen_at)}</Text>
                    </View>
                  )}
                />
              )}
            </Animated.View>
          </View>
        )}
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
    bottomWithReply: { bottom: insets.bottom + 78 },
    note: { color: "#fff", fontSize: 13.5, fontWeight: "600", textAlign: "center", marginBottom: 10, lineHeight: 19 },
    detailBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fff", borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, maxWidth: "90%" },
    detailText: { color: c.bg, fontWeight: "800", fontSize: 12.5 },
    replyBarWrap: { position: "absolute", left: 14, right: 14, bottom: insets.bottom + 12 },
    replyBar: { flexDirection: "row", alignItems: "flex-end", gap: 8, backgroundColor: "rgba(255,255,255,0.14)", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)", borderRadius: 22, paddingLeft: 15, paddingRight: 5, paddingVertical: 5 },
    replyInput: { flex: 1, color: "#fff", fontSize: 13, maxHeight: 80, paddingVertical: 6 },
    replySendBtn: { width: 34, height: 34, borderRadius: 999, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
    replyErrorText: { color: "#FF6B6B", fontSize: 11, fontWeight: "700", textAlign: "center", marginTop: 6 },
    replySentPill: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "rgba(34,197,94,0.85)", borderRadius: 999, paddingVertical: 10, alignSelf: "center", paddingHorizontal: 16 },
    replySentText: { color: "#fff", fontWeight: "800", fontSize: 12.5 },
    viewersPill: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: "rgba(255,255,255,0.14)", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)", borderRadius: 22, paddingHorizontal: 16, paddingVertical: 11 },
    viewersPillText: { color: "#fff", fontWeight: "700", fontSize: 12.5 },
    viewersOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
    viewersSheet: { backgroundColor: "#171420", borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 10, paddingHorizontal: 18, paddingBottom: insets.bottom + 18, maxHeight: 420 },
    viewersHandle: { width: 36, height: 4, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.25)", alignSelf: "center", marginBottom: 14 },
    viewersTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
    viewersTitle: { color: "#fff", fontWeight: "800", fontSize: 13.5 },
    viewersEmpty: { color: "rgba(255,255,255,0.55)", fontSize: 12.5, textAlign: "center", paddingVertical: 24 },
    viewerRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
    viewerAvatar: { width: 36, height: 36, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.1)" },
    viewerName: { flex: 1, color: "#fff", fontWeight: "700", fontSize: 12.5 },
    viewerTime: { color: "rgba(255,255,255,0.5)", fontSize: 10.5 },
  });
}
