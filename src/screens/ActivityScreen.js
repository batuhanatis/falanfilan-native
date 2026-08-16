import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useScrollToTop } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Flame, Heart, PartyPopper, Plus, Sparkles, Users } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import TopBar from "../components/TopBar";
import SocialFeedCard from "../components/SocialFeedCard";
import SocialPostComposer from "../components/SocialPostComposer";
import NudgeCard from "../components/NudgeCard";
import BlendFriendPickerSheet from "../components/BlendFriendPickerSheet";

const DAILY_QUESTIONS = [
  "Herkesin sevdiği ama senin sevmediğin film hangisi?",
  "Sonu seni en çok şaşırtan film veya dizi hangisi?",
  "Tekrar tekrar izleyebileceğin tek bir yapım seçsen hangisi olurdu?",
  "Bir arkadaşına gözün kapalı önereceğin dizi hangisi?",
  "Sence gereğinden az değer gören film hangisi?",
  "İlk 10 dakikasında seni yakalayan yapım hangisiydi?",
  "Bir karakterin hayatını yaşama şansın olsa kimi seçerdin?",
  "Sence devam filmi orijinalinden daha iyi olan yapım hangisi?",
  "Soundtrack'i yüzünden tekrar açtığın film hangisi?",
  "Bir gecede bitirdiğin en iyi dizi hangisi?",
  "Keşke hafızamdan silip ilk kez tekrar izlesem dediğin yapım hangisi?",
  "Seni en çok sinirlendiren final hangisiydi?",
];

function getDailyQuestion() {
  const now = new Date();
  const dayKey = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86400000);
  return DAILY_QUESTIONS[Math.abs(dayKey) % DAILY_QUESTIONS.length];
}

function localDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function expandActivityItems(items) {
  return (items || []).flatMap((item) => {
    if (item.kind !== "activity" || !Array.isArray(item.movies) || item.movies.length <= 1) {
      return [{ ...item, feedKey: String(item.id) }];
    }
    return item.movies.map((movie) => ({
      ...item,
      id: `${item.id}:${movie.id}`,
      feedKey: `${item.id}:${movie.id}`,
      activityCount: 1,
      movies: [movie],
    }));
  });
}

export default function ActivityScreen({ navigation }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = useMemo(() => makeStyles(c), [c]);
  const listRef = useRef(null);
  useScrollToTop(listRef);
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerType, setComposerType] = useState("thought");
  const [composerContext, setComposerContext] = useState(null);
  const [dailyQuestion, setDailyQuestion] = useState(() => getDailyQuestion());
  const [blendPickerNudge, setBlendPickerNudge] = useState(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const fallbackQuestion = getDailyQuestion();
    const [feedResult, questionResult] = await Promise.allSettled([
      api.socialFeed(auth.token),
      api.dailyQuestion(localDateKey()),
    ]);
    if (feedResult.status === "fulfilled") setFeed(expandActivityItems(feedResult.value.results));
    else setFeed([]);
    setDailyQuestion(
      questionResult.status === "fulfilled" && questionResult.value?.question
        ? questionResult.value.question
        : fallbackQuestion
    );
    setLoading(false);
  }, [auth.token]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const unsub = navigation.addListener("focus", () => load(true));
    return unsub;
  }, [navigation, load]);

  async function refresh() {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }

  function openComposer(type, context = null) {
    setComposerType(type);
    setComposerContext(context);
    setComposerOpen(true);
  }

  function handleFeedChanged(event) {
    if (event?.type !== "deleted") return;
    setFeed((items) => items.filter((item) => Number(item.post?.id) !== Number(event.postId)));
  }

  // Sunucu, bir nudge'ı akışa dahil ettiği anda kendi tarafında zaten kısa süreliğine
  // bastırıyor (bkz. backend nudge_dismissals) — burada sadece bu ekrandan anında kaldırmak
  // için yerel state'i güncelliyoruz, ayrı bir ağ isteği gerekmiyor.
  function dismissNudge(nudgeId) {
    setFeed((items) => items.filter((item) => item.id !== nudgeId));
  }

  const header = (
    <View>
      <View style={styles.topActions}>
        <TouchableOpacity style={styles.topActionTouch} onPress={() => navigation.navigate("GroupParty")} activeOpacity={0.88}>
          <LinearGradient colors={["#FF3D81", "#8B5CF6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.topActionCard}>
            <View style={styles.topActionIcon}><PartyPopper size={19} color="#fff" /></View>
            <View><Text style={styles.topActionEyebrow}>BİRLİKTE SEÇ</Text><Text style={styles.topActionTitle}>MatchParty</Text></View>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity style={styles.topActionTouch} onPress={() => navigation.navigate("TasteMate")} activeOpacity={0.88}>
          <LinearGradient colors={["#8B5CF6", "#2563EB"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.topActionCard}>
            <View style={styles.topActionIcon}><Users size={18} color="#fff" /></View>
            <View><Text style={styles.topActionEyebrow}>KEŞFET</Text><Text style={styles.topActionTitle}>TasteMatch</Text></View>
            <Sparkles size={12} color="#FFE66D" style={styles.topActionSparkle} />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.dailyCard} onPress={() => openComposer("thought", dailyQuestion)} activeOpacity={0.86}>
        <View style={styles.dailyIcon}><Flame size={18} color="#F97316" /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.dailyEyebrow}>GÜNÜN SORUSU</Text>
          <Text style={styles.dailyQuestion}>{dailyQuestion}</Text>
          <Text style={styles.dailyCta}>Yazı veya film/diziyle cevapla →</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.feedTitleRow}>
        <View>
          <Text style={styles.feedEyebrow}>SOSYAL AKIŞ</Text>
          <Text style={styles.feedTitle}>Arkadaşların ne konuşuyor?</Text>
        </View>
        <Heart size={18} color={c.accent2} />
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <TopBar
        centerLabel="Aktivite"
        leftAction={{
          icon: <Plus size={20} color={c.text} />,
          onPress: () => openComposer("thought"),
          accessibilityLabel: "Paylaşım oluştur",
        }}
      />
      {loading && feed.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={c.accent} />
          <Text style={styles.loadingText}>Akışın hazırlanıyor...</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={feed}
          keyExtractor={(item) => item.feedKey || String(item.id)}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.accent} colors={[c.accent]} />}
          ListHeaderComponent={header}
          renderItem={({ item }) =>
            item.kind === "nudge" ? (
              <NudgeCard
                item={item}
                navigation={navigation}
                onOpenPicker={setBlendPickerNudge}
                onDismiss={() => dismissNudge(item.id)}
              />
            ) : (
              <SocialFeedCard item={item} navigation={navigation} onChanged={handleFeedChanged} />
            )
          }
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Akışın henüz sakin</Text>
              <Text style={styles.emptyText}>Arkadaşların paylaşım yaptıkça, içerik beğendikçe ve listeler oluşturdukça burada göreceksin. İlk Taste Post’u sen başlatabilirsin.</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => openComposer("thought")}>
                <Text style={styles.emptyBtnText}>İlk paylaşımı yap</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      <SocialPostComposer
        visible={composerOpen}
        presentation="island"
        initialType={composerType}
        initialContext={composerContext}
        onClose={() => { setComposerOpen(false); setComposerContext(null); }}
        onCreated={() => load(true)}
      />

      {blendPickerNudge && (
        <BlendFriendPickerSheet
          movie={blendPickerNudge.movie}
          highlightFriends={blendPickerNudge.friends}
          navigation={navigation}
          onClose={() => setBlendPickerNudge(null)}
        />
      )}
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    loadingText: { color: c.dim, fontSize: 12, marginTop: 9 },
    content: { paddingHorizontal: 14, paddingBottom: 28 },
    popularSection: { marginTop: 14, marginBottom: 14 },
    sectionHead: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 10 },
    feedEyebrow: { color: c.accent, fontWeight: "900", fontSize: 9.5, letterSpacing: 0.8 },
    sectionTitle: { color: c.text, fontWeight: "900", fontSize: 17, marginTop: 2 },
    sectionCount: { color: c.dim, fontSize: 10.5 },
    popularRow: { gap: 9, paddingRight: 10 },
    popularItem: { width: 92 },
    popularPoster: { width: 92, height: 136, borderRadius: 12, backgroundColor: c.surface2 },
    popularTitle: { color: c.text, fontSize: 10.5, fontWeight: "700", marginTop: 5 },
    popularSkeleton: { height: 140, alignItems: "center", justifyContent: "center", backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border },
    topActions: { flexDirection: "row", gap: 9, marginBottom: 12 },
    topActionTouch: { flex: 1, borderRadius: 16, shadowColor: "#8B5CF6", shadowOpacity: 0.2, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
    topActionCard: { height: 68, borderRadius: 16, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 9, overflow: "hidden" },
    topActionIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: "rgba(255,255,255,0.18)", borderWidth: 1, borderColor: "rgba(255,255,255,0.24)", alignItems: "center", justifyContent: "center" },
    topActionEyebrow: { color: "rgba(255,255,255,0.7)", fontSize: 7.5, fontWeight: "900", letterSpacing: 0.9 },
    topActionTitle: { color: "#fff", fontSize: 13, fontWeight: "900", marginTop: 2 },
    topActionSparkle: { position: "absolute", top: 8, right: 9 },
    dailyCard: { flexDirection: "row", gap: 11, alignItems: "flex-start", backgroundColor: c.surface, borderWidth: 1, borderColor: "#F97316", borderRadius: 18, padding: 13, marginBottom: 12 },
    dailyIcon: { width: 38, height: 38, borderRadius: 999, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" },
    dailyEyebrow: { color: "#F97316", fontSize: 9.5, fontWeight: "900", letterSpacing: 0.7 },
    dailyQuestion: { color: c.text, fontSize: 13, fontWeight: "850", lineHeight: 18, marginTop: 3 },
    dailyCta: { color: c.accent, fontSize: 10.5, fontWeight: "800", marginTop: 7 },
    feedTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 20, marginBottom: 10 },
    feedTitle: { color: c.text, fontWeight: "900", fontSize: 17, marginTop: 2 },
    emptyCard: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 18, padding: 20, alignItems: "center", marginBottom: 20 },
    emptyTitle: { color: c.text, fontWeight: "900", fontSize: 15 },
    emptyText: { color: c.dim, fontSize: 11.5, lineHeight: 17, textAlign: "center", marginTop: 6 },
    emptyBtn: { marginTop: 14, backgroundColor: c.accent, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 9 },
    emptyBtnText: { color: c.bg, fontWeight: "900", fontSize: 11.5 },
  });
}
