import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useScrollToTop } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowRight, Flame, Heart, MessageCircle, Plus, Sparkles, Swords, Users } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import TopBar from "../components/TopBar";
import SocialFeedCard from "../components/SocialFeedCard";
import SocialPostComposer from "../components/SocialPostComposer";

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
  const dailyQuestion = useMemo(() => getDailyQuestion(), []);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api.socialFeed(auth.token);
      setFeed(expandActivityItems(data.results));
    } catch {
      setFeed([]);
    }
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

  const header = (
    <View>
      <LinearGradient
        colors={[c.accent, "#7C3AED", c.accent2 || c.accent]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.composerGlow}
      >
        <View style={styles.composerCard}>
          <TouchableOpacity style={styles.composerPrompt} onPress={() => openComposer("thought")} activeOpacity={0.85}>
            <LinearGradient colors={[c.accent, "#7C3AED"]} style={styles.composerPlus}>
              <Plus size={17} color="#fff" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.composerTitle}>Ne izliyorsun, ne düşünüyorsun?</Text>
              <Text style={styles.composerSub}>Bir film öner, fikrini söyle veya arkadaşlarına sor.</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.quickRow}>
            <TouchableOpacity style={[styles.quickBtn, { borderColor: c.accent }]} onPress={() => openComposer("recommend")}>
              <Sparkles size={14} color={c.accent} />
              <Text style={[styles.quickText, { color: c.accent }]}>Öner</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.quickBtn, { borderColor: "#8B5CF6" }]} onPress={() => openComposer("poll")}>
              <Swords size={14} color="#8B5CF6" />
              <Text style={[styles.quickText, { color: "#8B5CF6" }]}>Kapıştır</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.quickBtn, { borderColor: c.accent2 || "#EC4899" }]} onPress={() => openComposer("thought")}>
              <MessageCircle size={14} color={c.accent2 || "#EC4899"} />
              <Text style={[styles.quickText, { color: c.accent2 || "#EC4899" }]}>Fikrini söyle</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <TouchableOpacity onPress={() => navigation.navigate("TasteMate")} activeOpacity={0.88} style={styles.tasteMateTouch}>
        <LinearGradient
          colors={["#FF3D81", "#8B5CF6", "#2563EB"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.tasteMateCard}
        >
          <View style={styles.tasteBlobOne} />
          <View style={styles.tasteBlobTwo} />
          <View style={styles.tasteMateIcon}><Users size={17} color="#fff" /></View>
          <View style={styles.tasteMateCopy}>
            <View style={styles.tasteMateLabelRow}>
              <Sparkles size={10} color="#FFE66D" />
              <Text style={styles.tasteMateEyebrow}>TASTEMATCH</Text>
            </View>
            <Text style={styles.tasteMateTitle}>Seninle aynı kafada kim var?</Text>
          </View>
          <View style={styles.tasteMateCta}><ArrowRight size={16} color="#fff" /></View>
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity style={styles.dailyCard} onPress={() => openComposer("thought", dailyQuestion)} activeOpacity={0.86}>
        <View style={styles.dailyIcon}><Flame size={18} color="#F97316" /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.dailyEyebrow}>GÜNÜN SORUSU</Text>
          <Text style={styles.dailyQuestion}>{dailyQuestion}</Text>
          <Text style={styles.dailyCta}>Cevabını paylaş →</Text>
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
      <TopBar centerLabel="Aktivite" />
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
          renderItem={({ item }) => <SocialFeedCard item={item} navigation={navigation} />}
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
        initialType={composerType}
        initialContext={composerContext}
        onClose={() => { setComposerOpen(false); setComposerContext(null); }}
        onCreated={() => load(true)}
      />
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
    composerGlow: { borderRadius: 20, padding: 1.25, marginBottom: 12 },
    composerCard: { backgroundColor: c.surface, borderRadius: 19, padding: 13 },
    composerPrompt: { flexDirection: "row", alignItems: "center", gap: 10 },
    composerPlus: { width: 40, height: 40, borderRadius: 999, alignItems: "center", justifyContent: "center" },
    composerTitle: { color: c.text, fontSize: 13, fontWeight: "800" },
    composerSub: { color: c.dim, fontSize: 10.5, marginTop: 2, lineHeight: 14 },
    quickRow: { flexDirection: "row", gap: 7, marginTop: 11 },
    quickBtn: { flex: 1, minHeight: 34, borderRadius: 999, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, flexDirection: "row", gap: 5, alignItems: "center", justifyContent: "center" },
    quickText: { color: c.text, fontSize: 10.5, fontWeight: "800" },
    tasteMateTouch: { borderRadius: 17, marginBottom: 12, shadowColor: "#8B5CF6", shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
    tasteMateCard: { height: 78, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 17, paddingHorizontal: 13, overflow: "hidden" },
    tasteBlobOne: { position: "absolute", width: 86, height: 86, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.12)", right: 36, top: -52 },
    tasteBlobTwo: { position: "absolute", width: 62, height: 62, borderRadius: 999, backgroundColor: "rgba(255,230,109,0.13)", left: -20, bottom: -38 },
    tasteMateIcon: { width: 39, height: 39, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.18)", borderWidth: 1, borderColor: "rgba(255,255,255,0.28)", alignItems: "center", justifyContent: "center" },
    tasteMateCopy: { flex: 1 },
    tasteMateLabelRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    tasteMateEyebrow: { color: "#FFE66D", fontSize: 8.5, fontWeight: "900", letterSpacing: 1 },
    tasteMateTitle: { color: "#fff", fontSize: 13.5, fontWeight: "900", marginTop: 3 },
    tasteMateCta: { width: 31, height: 31, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.2)", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)", alignItems: "center", justifyContent: "center" },
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
