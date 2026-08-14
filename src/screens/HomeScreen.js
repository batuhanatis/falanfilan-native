import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Heart, MessageCircle, Plus, Sparkles, Swords } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import TopBar from "../components/TopBar";
import PlayHubCard from "../components/PlayHubCard";
import SocialFeedCard from "../components/SocialFeedCard";
import SocialPostComposer from "../components/SocialPostComposer";

function interleave(a = [], b = [], limit = 20) {
  const out = [];
  for (let i = 0; out.length < limit && (i < a.length || i < b.length); i++) {
    if (i < a.length) out.push(a[i]);
    if (out.length < limit && i < b.length) out.push(b[i]);
  }
  return out;
}

export default function HomeScreen({ navigation }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [feed, setFeed] = useState([]);
  const [popular, setPopular] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerType, setComposerType] = useState("thought");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const [feedResult, movieTrending, tvTrending] = await Promise.allSettled([
      api.socialFeed(auth.token),
      api.trending(auth.token, "movie"),
      api.trending(auth.token, "tv"),
    ]);
    if (feedResult.status === "fulfilled") setFeed(feedResult.value.results || []);
    if (movieTrending.status === "fulfilled" || tvTrending.status === "fulfilled") {
      const movies = movieTrending.status === "fulfilled" ? movieTrending.value.results || [] : [];
      const shows = tvTrending.status === "fulfilled" ? tvTrending.value.results || [] : [];
      setPopular(interleave(movies, shows, 20));
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

  function openComposer(type) {
    setComposerType(type);
    setComposerOpen(true);
  }

  const header = (
    <View>
      <PopularNowRow items={popular} c={c} styles={styles} navigation={navigation} />

      <View style={styles.composerCard}>
        <TouchableOpacity style={styles.composerPrompt} onPress={() => openComposer("thought")} activeOpacity={0.85}>
          <View style={styles.composerPlus}><Plus size={17} color={c.bg} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.composerTitle}>Zevkin hakkında bir şey paylaş</Text>
            <Text style={styles.composerSub}>Bir yorum, öneri ya da küçük bir karşılaştırma başlat.</Text>
          </View>
        </TouchableOpacity>
        <View style={styles.quickRow}>
          <TouchableOpacity style={styles.quickBtn} onPress={() => openComposer("recommend")}>
            <Sparkles size={14} color={c.accent} />
            <Text style={styles.quickText}>Öner</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={() => openComposer("poll")}>
            <Swords size={14} color={c.accent} />
            <Text style={styles.quickText}>Anket</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={() => openComposer("thought")}>
            <MessageCircle size={14} color={c.accent} />
            <Text style={styles.quickText}>Bir şey söyle</Text>
          </TouchableOpacity>
        </View>
      </View>

      <PlayHubCard navigation={navigation} />

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
      <TopBar centerLabel="Ana Sayfa" />
      {loading && feed.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={c.accent} />
          <Text style={styles.loadingText}>Akışın hazırlanıyor...</Text>
        </View>
      ) : (
        <FlatList
          data={feed}
          keyExtractor={(item) => String(item.id)}
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
        onClose={() => setComposerOpen(false)}
        onCreated={() => load(true)}
      />
    </View>
  );
}

function PopularNowRow({ items, c, styles, navigation }) {
  return (
    <View style={styles.popularSection}>
      <View style={styles.sectionHead}>
        <View>
          <Text style={styles.feedEyebrow}>ŞU AN POPÜLER</Text>
          <Text style={styles.sectionTitle}>Herkes bunları konuşuyor</Text>
        </View>
        <Text style={styles.sectionCount}>{items.length ? `${items.length} içerik` : ""}</Text>
      </View>
      {items.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.popularRow}>
          {items.map((item, index) => (
            <TouchableOpacity key={`${item.id}-${index}`} style={styles.popularItem} onPress={() => navigation.navigate("Detail", { movie: item })} activeOpacity={0.86}>
              {item.poster ? <Image source={{ uri: item.poster }} style={styles.popularPoster} /> : <View style={[styles.popularPoster, { backgroundColor: c.surface2 }]} />}
              <View style={styles.rankBadge}><Text style={styles.rankText}>{index + 1}</Text></View>
              <Text style={styles.popularTitle} numberOfLines={1}>{item.title}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.popularSkeleton}><ActivityIndicator color={c.accent} /></View>
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
    rankBadge: { position: "absolute", left: 6, top: 6, minWidth: 23, height: 23, paddingHorizontal: 5, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.68)", alignItems: "center", justifyContent: "center" },
    rankText: { color: "#fff", fontWeight: "900", fontSize: 10 },
    popularTitle: { color: c.text, fontSize: 10.5, fontWeight: "700", marginTop: 5 },
    popularSkeleton: { height: 140, alignItems: "center", justifyContent: "center", backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border },
    composerCard: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 18, padding: 13, marginBottom: 12 },
    composerPrompt: { flexDirection: "row", alignItems: "center", gap: 10 },
    composerPlus: { width: 38, height: 38, borderRadius: 999, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" },
    composerTitle: { color: c.text, fontSize: 13, fontWeight: "800" },
    composerSub: { color: c.dim, fontSize: 10.5, marginTop: 2, lineHeight: 14 },
    quickRow: { flexDirection: "row", gap: 7, marginTop: 11 },
    quickBtn: { flex: 1, minHeight: 34, borderRadius: 999, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, flexDirection: "row", gap: 5, alignItems: "center", justifyContent: "center" },
    quickText: { color: c.text, fontSize: 10.5, fontWeight: "800" },
    feedTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 20, marginBottom: 10 },
    feedTitle: { color: c.text, fontWeight: "900", fontSize: 17, marginTop: 2 },
    emptyCard: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 18, padding: 20, alignItems: "center", marginBottom: 20 },
    emptyTitle: { color: c.text, fontWeight: "900", fontSize: 15 },
    emptyText: { color: c.dim, fontSize: 11.5, lineHeight: 17, textAlign: "center", marginTop: 6 },
    emptyBtn: { marginTop: 14, backgroundColor: c.accent, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 9 },
    emptyBtnText: { color: c.bg, fontWeight: "900", fontSize: 11.5 },
  });
}
