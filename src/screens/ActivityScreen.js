import { t as translateUI } from "../i18n/core";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useScrollToTop } from "@react-navigation/native";
import { ChevronRight, Compass, Plus, Puzzle, Trophy, Users } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import TopBar from "../components/TopBar";
import SocialFeedCard from "../components/SocialFeedCard";
import SocialActivityGroup from "../components/SocialActivityGroup";
import SocialPostComposer from "../components/SocialPostComposer";
import NudgeCard from "../components/NudgeCard";
import BlendFriendPickerSheet from "../components/BlendFriendPickerSheet";
import StoryBar from "../components/StoryBar";
import ActivitySkeleton from "../components/skeletons/ActivitySkeleton";
import { FONTS } from "../theme/fonts";

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
  "Bir filmi izlemeden önce 'bu bana göre değil' deyip sonra bayıldığın yapım hangisiydi?",
  "Herkesin izlediğini söylediği ama senin hâlâ izlemediğin yapım hangisi?",
  "İzlerken ağladığın bir sahne hangi film veya diziye ait?",
  "En çok güldüğün sahne hangi yapımdaydı?",
  "Bittiğine hâlâ inanamadığın bir dizi finali hangisiydi?",
  "Sence erken bitirilmesi en büyük kayıp olan dizi hangisi?",
  "Fragmanı filmin/dizinin kendisinden daha iyiydi — hangisi için böyle düşünüyorsun?",
  "En sevdiğin kötü karakter (villain) hangisi?",
  "Kitaptan uyarlanan hangi film veya dizi, kitabından daha iyiydi?",
  "Bir sezonu diğerlerinden çok daha iyi olan dizi hangisi?",
  "Her sezon biraz daha kötüleşen bir dizi var mı, hangisi?",
  "En sevdiğin replik hangi film veya diziden?",
  "Afişine bayılıp izleyince hayal kırıklığına uğradığın yapım hangisiydi?",
  "Sence en haksız yere düşük puan almış film hangisi?",
  "Bir karakterin tarzını/kıyafetini kopyalamak istediğin yapım hangisi?",
  "İzlediğin en ürkütücü film hangisiydi?",
  "Uzun süre aklından çıkmayan bir final sahnesi hangisine ait?",
  "Bir filmi ya da diziyi sırf bir oyuncu için izlediğin oldu mu, kimdi?",
  "Senin için 'rahatlatıcı, her zaman dönülen' yapım hangisi?",
  "İlk izlediğinde pek anlamadığın ama yıllar sonra tekrar izleyince bayıldığın yapım hangisi?",
  "Bir filmin hangi sahnesinde, iyi anlamda, gerçekten şaşırdın?",
  "En sevdiğin açılış sahnesi/bölümü hangi yapıma ait?",
  "Remake'i orijinalinden daha iyi bulduğun bir yapım var mı, hangisi?",
  "Gerçek hayatta arkadaşın olmasını istediğin bir karakter kim?",
  "İçinde yaşamak isteyeceğin bir film/dizi evreni hangisi?",
  "Bir film ya da diziyi izlerken uyuyakaldığın oldu mu, hangisiydi?",
  "Küçükken izleyip şimdi 'buna nasıl izin verilmiş' dediğin bir yapım var mı?",
  "En sevdiğin dönemden (yıllardan) bir film hangisi?",
  "Bir oyuncunun en iyi performansını sence hangi film veya dizide izledin?",
  "Sence gereğinden çok övülen bir film veya dizi hangisi?",
  "Başkası önerdiği için izleyip sonunda sen de sevdiğin bir yapım oldu mu?",
  "Bittiğinde hemen başa sarıp tekrar izlediğin bir film/dizi var mı, hangisiydi?",
  "En sevdiğin arkadaş grubu/takım hangi dizide?",
  "Bir karakterin hikâye gelişimini (arkını) en çok hangi yapımda beğendin?",
  "Sence en iyi ikili (ship) hangi film veya dizide?",
  "Elinden telefonu bile bırakamadan izlediğin en son yapım neydi?",
  "En sevdiğin mini dizi (kısa, tek sezonluk) hangisi?",
  "Sence en güçlü bölüm-sonu merakı (cliffhanger) hangi dizide vardı?",
  "Hatırladığın en eski film/dizi izleme anın nedir?",
  "Bu hafta izlediğin en iyi şey neydi?",
  "Bir yapımı yanlış zamanda/modda izleyip tadını çıkaramadığın oldu mu, hangisiydi?",
  "Sence yetenekli ama hak ettiği ilgiyi görmeyen bir oyuncu kim?",
  "Bir yönetmenin en iyi işi sence hangisi?",
  "Farklı iki film/dizi evreninin kesişmesini istesen, hangi ikisi olurdu?",
  "Bir karakterle kendini en çok nerede özdeşleştirdin?",
  "Seni bir konuya bakışını değiştiren bir film veya dizi oldu mu, hangisi?",
  "İzlerken gerçekten 'burada olmak isterdim' dediğin bir mekân hangi yapımdaydı?",
  "Bir filmi/diziyi vizyona girdiğinde, sinemada izlemeyi çok isterdim dediğin hangisi?",
  "Bir dizi izlerken 'bu hafta bölüm ne zaman gelecek' diye sayılı gün beklediğin son yapım neydi?",
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

function groupActivities(items) {
  const result = [];
  let run = [];
  function flush() {
    if (!run.length) return;
    const first = run[0];
    const key = `group-${first.feedKey || first.id}`;
    result.push({ kind: "activity-group", id: key, feedKey: key, items: run });
    run = [];
  }
  for (const item of items) {
    if (item.kind === "activity") run.push(item);
    else { flush(); result.push(item); }
  }
  flush();
  return result;
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
  const [stories, setStories] = useState({ myStories: [], friends: [] });
  const [myAvatar, setMyAvatar] = useState(null);
  // Haftalık görevler ve Pellix Play ana sayfadan buraya taşındı (ana sayfa kalabalık olmasın);
  // günün sorusu gibi akışın aralarına kart olarak giriyorlar.
  const [questData, setQuestData] = useState(null);
  // Günün sorusu bir klaket: cevaplamaya dokununca üst çıta çarpıyor, sonra yazma ekranı açılıyor.
  const clap = useRef(new Animated.Value(0)).current;

  const refreshQuests = useCallback(() => {
    api.quests(auth.token).then(setQuestData).catch(() => {});
  }, [auth.token]);

  // Görevler, kullanıcı başka ekranlarda bir şey yaptıkça ilerliyor — sekmeye her dönüşte tazele.
  useEffect(() => {
    const unsub = navigation.addListener("focus", refreshQuests);
    return unsub;
  }, [navigation, refreshQuests]);

  const refreshStories = useCallback(async () => {
    try {
      const data = await api.socialStories(auth.token);
      setStories({ myStories: data.myStories || [], friends: data.friends || [] });
    } catch {}
  }, [auth.token]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const fallbackQuestion = getDailyQuestion();
    const [feedResult, questionResult, storiesResult, meResult, questsResult] = await Promise.allSettled([
      api.socialFeed(auth.token),
      api.dailyQuestion(localDateKey()),
      api.socialStories(auth.token),
      api.me(auth.token),
      api.quests(auth.token),
    ]);
    if (questsResult.status === "fulfilled") setQuestData(questsResult.value);
    if (feedResult.status === "fulfilled") setFeed(groupActivities(expandActivityItems(feedResult.value.results)));
    else setFeed([]);
    setDailyQuestion(
      questionResult.status === "fulfilled" && questionResult.value?.question
        ? questionResult.value.question
        : fallbackQuestion
    );
    if (storiesResult.status === "fulfilled") {
      setStories({ myStories: storiesResult.value.myStories || [], friends: storiesResult.value.friends || [] });
    }
    if (meResult.status === "fulfilled") setMyAvatar(meResult.value.avatarUrl || null);
    setLoading(false);
  }, [auth.token]);

  useEffect(() => { load(); }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }

  const seenPending = useRef(new Set());
  const seenSent = useRef(new Set());
  const flushSeen = useCallback(() => {
    const ids = [...seenPending.current].filter((id) => !seenSent.current.has(id));
    if (!ids.length) return;
    seenPending.current.clear();
    ids.forEach((id) => seenSent.current.add(id));
    api.markFeedSeen(auth.token, ids).catch(() => {
      ids.forEach((id) => seenSent.current.delete(id));
    });
  }, [auth.token]);

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    for (const v of viewableItems) {
      const it = v.item;
      if (!it || ["nudge", "daily-question", "feature-shortcuts", "play-card", "quests-card"].includes(it.kind)) continue;
      if (it.kind === "activity-group") {
        it.items.forEach((sub) => { if (sub.feedKey) seenPending.current.add(sub.feedKey); });
      } else {
        const key = it.feedKey || it.id;
        if (key) seenPending.current.add(key);
      }
    }
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60, minimumViewTime: 500 }).current;

  useEffect(() => {
    const timer = setInterval(flushSeen, 4000);
    return () => {
      clearInterval(timer);
      flushSeen();
    };
  }, [flushSeen]);

  useEffect(() => {
    const unsub = navigation.addListener("blur", flushSeen);
    return unsub;
  }, [navigation, flushSeen]);

  function openComposer(type, context = null) {
    setComposerType(type);
    setComposerContext(context);
    setComposerOpen(true);
  }

  function handleFeedChanged(event) {
    if (event?.type !== "deleted") return;
    setFeed((items) => items.filter((item) => Number(item.post?.id) !== Number(event.postId)));
  }

  function dismissNudge(nudgeId) {
    setFeed((items) => items.filter((item) => item.id !== nudgeId));
  }

  // Sosyal ekran artık feature promosyonlarıyla başlamıyor. Önce story'ler ve gerçek arkadaş
  // içeriği geliyor; günlük soru 2. içerikten sonra, MatchParty/TasteMate kısayolları biraz daha
  // aşağıda feed'in doğal parçaları olarak görünüyor.
  const feedData = useMemo(() => {
    if (!feed.length) return [];
    const result = [...feed];
    result.splice(Math.min(2, result.length), 0, { kind: "daily-question", id: "daily-question", feedKey: "daily-question" });
    // Pellix Play ve haftalık görevler daha aşağıda, arkadaş içeriğinin arasına serpiştirilmiş.
    // Akış kısaysa sona ekleniyorlar ki hiç görünmemezlik olmasın.
    result.splice(Math.min(6, result.length), 0, { kind: "play-card", id: "play-card", feedKey: "play-card" });
    result.splice(Math.min(11, result.length), 0, { kind: "quests-card", id: "quests-card", feedKey: "quests-card" });
    return result;
  }, [feed, dailyQuestion]);

  function renderPlayCard() {
    return (
      <View style={styles.tileRow}>
        <TouchableOpacity style={styles.tile} onPress={() => navigation.navigate("DailyPosterPuzzle")} activeOpacity={0.86}>
          <Puzzle size={20} color={c.accent} />
          <Text style={styles.tileTitle}>{translateUI("Poster Puzzle")}</Text>
          <Text style={styles.tileSub}>{translateUI("Günün oyunu, 1 dakikalık tahmin")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tile} onPress={() => navigation.navigate("PellixPlay")} activeOpacity={0.86}>
          <ChevronRight size={20} color={c.accent} />
          <Text style={styles.tileTitle}>{translateUI("Tüm oyunlar")}</Text>
          <Text style={styles.tileSub}>{translateUI("Pellix Play")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderQuestsCard() {
    const quests = questData?.quests || [];
    const done = quests.filter((q) => q.completed).length;
    const percent = quests.length ? Math.round((done / quests.length) * 100) : 0;
    return (
      <TouchableOpacity style={styles.questsCard} onPress={() => navigation.navigate("WeeklyQuests")} activeOpacity={0.86}>
        <Trophy size={20} color={c.accent} />
        <View style={{ flex: 1 }}>
          <Text style={styles.tileTitle}>{quests.length ? translateUI("{0}/{1} görev", {0: done,1: quests.length}) : translateUI("Haftalık görevler")}</Text>
          {quests.length > 0 && (
            <View style={styles.questsTrack}><View style={[styles.questsFill, { width: `${percent}%` }]} /></View>
          )}
          <Text style={styles.tileSub}>{translateUI("Bu haftanın görevlerine bak")}</Text>
        </View>
        <ChevronRight size={16} color={c.dim} />
      </TouchableOpacity>
    );
  }

  function answerDailyQuestion() {
    clap.setValue(1);
    Animated.spring(clap, { toValue: 0, friction: 5, tension: 220, useNativeDriver: true }).start();
    setTimeout(() => openComposer("thought", dailyQuestion), 260);
  }

  function renderDailyQuestionCard() {
    const rotate = clap.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-14deg"] });
    return (
      <View style={styles.slate}>
        <Animated.View style={[styles.slateTop, { transform: [{ translateX: -170 }, { rotate }, { translateX: 170 }] }]}>
          {Array.from({ length: 14 }, (_, i) => <View key={i} style={[styles.slateStripe, i % 2 ? styles.slateStripeDark : null]} />)}
        </Animated.View>
        <View style={styles.slateBody}>
          <View style={styles.slateMeta}>
            <Text style={styles.slateMetaText}>{translateUI("GÜNÜN SORUSU")}</Text>
            <Text style={styles.slateMetaText}>{translateUI("SAHNE ")}{new Date().getDate()}{translateUI(" · ÇEKİM 1")}</Text>
          </View>
          <Text style={styles.slateQuestion}>{dailyQuestion}</Text>
          <TouchableOpacity style={styles.slateBtn} onPress={answerDailyQuestion} activeOpacity={0.85} accessibilityRole="button">
            <Text style={styles.slateBtnText}>{translateUI("Yazıyla ya da bir filmle cevapla")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function renderFeatureShortcuts() {
    return (
      <View style={styles.tileRow}>
        <TouchableOpacity style={styles.tile} onPress={() => navigation.navigate("GroupParty")} activeOpacity={0.86}>
          <Users size={20} color={c.accent} />
          <Text style={styles.tileTitle}>{translateUI("MatchParty")}</Text>
          <Text style={styles.tileSub}>{translateUI("Arkadaşınla aynı filmleri kaydırın, ortak olanı bulun")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tile} onPress={() => navigation.navigate("TasteMate")} activeOpacity={0.86}>
          <Compass size={20} color={c.accent} />
          <Text style={styles.tileTitle}>{translateUI("TasteMate")}</Text>
          <Text style={styles.tileSub}>{translateUI("Senin gibi izleyen insanları bul")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const header = (
    <View>
      <View style={styles.storySection}>
        <StoryBar
          myAvatar={myAvatar}
          myStories={stories.myStories}
          friends={stories.friends}
          navigation={navigation}
          onChanged={refreshStories}
        />
      </View>

      {renderFeatureShortcuts()}

    </View>
  );

  return (
    <View style={styles.root}>
      <TopBar
        centerLabel="Sosyal"
        leftAction={{
          icon: <Plus size={20} color={c.text} />,
          onPress: () => openComposer("thought"),
          accessibilityLabel: translateUI("Paylaşım oluştur"),
        }}
      />
      {loading && feed.length === 0 ? (
        <View style={styles.content}>
          <ActivitySkeleton />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={feedData}
          keyExtractor={(item) => item.feedKey || String(item.id)}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.accent} colors={[c.accent]} />}
          ListHeaderComponent={header}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          renderItem={({ item }) => {
            if (item.kind === "daily-question") return renderDailyQuestionCard();
            if (item.kind === "play-card") return renderPlayCard();
            if (item.kind === "quests-card") return renderQuestsCard();
            if (item.kind === "feature-shortcuts") return renderFeatureShortcuts();
            if (item.kind === "nudge") {
              return (
                <NudgeCard
                  item={item}
                  navigation={navigation}
                  onOpenPicker={setBlendPickerNudge}
                  onDismiss={() => dismissNudge(item.id)}
                />
              );
            }
            if (item.kind === "activity-group") {
              return <SocialActivityGroup items={item.items} navigation={navigation} />;
            }
            return <SocialFeedCard item={item} navigation={navigation} onChanged={handleFeedChanged} />;
          }}
          ListEmptyComponent={
            <View>
              {renderDailyQuestionCard()}
              {renderPlayCard()}
              {renderQuestsCard()}
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>{translateUI("Akışın henüz sakin")}</Text>
                <Text style={styles.emptyText}>{translateUI("Arkadaşların paylaşım yaptıkça, içerik beğendikçe ve listeler oluşturdukça burada göreceksin. İlk Taste Post’u sen başlatabilirsin.")}</Text>
                <TouchableOpacity style={styles.emptyBtn} onPress={() => openComposer("thought")}>
                  <Text style={styles.emptyBtnText}>{translateUI("İlk paylaşımı yap")}</Text>
                </TouchableOpacity>
              </View>
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
    content: { paddingHorizontal: 14, paddingBottom: 28 },
    storySection: { marginTop: 12 },
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
    tileRow: { flexDirection: "row", gap: 10, marginTop: 10, marginBottom: 14 },
    tile: { flex: 1, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, padding: 14, gap: 4 },
    tileTitle: { color: c.text, fontSize: 22, fontFamily: FONTS.marquee, marginTop: 4 },
    tileSub: { color: c.dim, fontSize: 12.5, lineHeight: 17 },
    questsCard: { flexDirection: "row", gap: 12, alignItems: "center", borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, padding: 14, marginTop: 4, marginBottom: 14 },
    questsTrack: { height: 4, borderRadius: 999, backgroundColor: c.surface2, marginTop: 6, marginBottom: 6, overflow: "hidden" },
    questsFill: { height: 4, borderRadius: 999, backgroundColor: c.accent },
    // Klaket iki temada da kendi renginde: koyu tahta, krem-siyah çizgili çıta.
    slate: { borderRadius: 10, overflow: "hidden", backgroundColor: "#1e1d1b", borderWidth: 1, borderColor: "#34312c", marginTop: 4, marginBottom: 16 },
    slateTop: { height: 26, flexDirection: "row", borderBottomWidth: 3, borderBottomColor: "#0d0b0a", overflow: "hidden" },
    slateStripe: { width: 28, height: 40, marginTop: -7, backgroundColor: "#efe4cc", transform: [{ skewX: "-40deg" }] },
    slateStripeDark: { backgroundColor: "#161311" },
    slateBody: { padding: 14, paddingTop: 12 },
    slateMeta: { flexDirection: "row", justifyContent: "space-between", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#34312c" },
    slateMetaText: { fontFamily: FONTS.monoMedium, fontSize: 10.5, letterSpacing: 0.9, color: "#b7ab95" },
    slateQuestion: { fontFamily: FONTS.marqueeBold, fontSize: 25, lineHeight: 28, color: "#efe4cc", marginTop: 12, marginBottom: 14 },
    slateBtn: { alignSelf: "flex-start", minHeight: 40, justifyContent: "center", paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: "#4a453d" },
    slateBtnText: { color: "#efe4cc", fontSize: 13, fontWeight: "600" },
    feedTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4, marginBottom: 10 },
    feedTitle: { color: c.text, fontWeight: "900", fontSize: 17, marginTop: 2 },
    emptyCard: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 18, padding: 20, alignItems: "center", marginBottom: 20 },
    emptyTitle: { color: c.text, fontWeight: "900", fontSize: 15 },
    emptyText: { color: c.dim, fontSize: 11.5, lineHeight: 17, textAlign: "center", marginTop: 6 },
    emptyBtn: { marginTop: 14, backgroundColor: c.accent, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 9 },
    emptyBtnText: { color: c.bg, fontWeight: "900", fontSize: 11.5 },
  });
}
